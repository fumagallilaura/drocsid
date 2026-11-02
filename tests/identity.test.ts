import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, scryptSync } from 'node:crypto';
import { createHook } from 'node:async_hooks';
import { Identity, IdentityError } from '../server/identity.js';
import { ProtocolError } from '../shared/protocol.js';
import type { Database } from '../server/database.js';
import { postgresFixture } from './helpers/postgres.js';

const password = 'uma senha longa e exclusiva';
const sha = (value: string) => createHash('sha256').update(value).digest('hex');
const status = (expected: number) => (error: unknown) => error instanceof IdentityError && error.status === expected;
async function accounts(database: Database) {
  for (const id of ['ana', 'bia', 'caio']) await database.query('INSERT INTO drocsid.accounts(id,username,password_hash) VALUES ($1,$1,$2)', [id, '$scrypt$131072$8$1$' + 'a'.repeat(32) + '$' + 'b'.repeat(128)]);
}

test('MERGE-05: registration stores salted scrypt hashes and unique identities', async t => {
  const fixture = await postgresFixture(t), database = await fixture.open();
  const identity = new Identity(database);
  const first = await identity.register('ana', password, '127.0.0.1');
  const second = await identity.register('bia', password, '127.0.0.1');
  assert.equal(first.user.username, 'ana'); assert.equal(second.user.username, 'bia');
  assert.notEqual(first.user.id, second.user.id);
  assert.match(first.token, /^[A-Za-z0-9_-]{43}$/); assert.notEqual(first.token, second.token);
  const rows = await database.query('SELECT id,username,password_hash FROM drocsid.accounts ORDER BY username');
  assert.equal(rows.length, 2);
  const salts: string[] = [];
  for (const row of rows) {
    assert.equal(typeof row.password_hash, 'string');
    const stored = String(row.password_hash);
    assert.match(stored, /^\$scrypt\$131072\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
    const parts = stored.split('$'); salts.push(parts[5]);
    assert.equal(scryptSync(password, Buffer.from(parts[5], 'hex'), 64, { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }).toString('hex'), parts[6]);
    assert.ok(!stored.includes(password));
  }
  assert.notEqual(salts[0], salts[1]);
  const sessions = await database.query('SELECT token_hash,user_id FROM drocsid.sessions ORDER BY user_id');
  assert.equal(sessions.length, 2);
  assert.ok(sessions.some(row => row.token_hash === sha(first.token) && row.user_id === first.user.id));
  assert.ok(!JSON.stringify([...rows, ...sessions]).includes(first.token));
  const duplicate = await Promise.allSettled([identity.register('duplicada', password, 'ip-a'), identity.register('duplicada', password, 'ip-b')]);
  assert.equal(duplicate.filter(item => item.status === 'fulfilled').length, 1);
  const rejected = duplicate.find(item => item.status === 'rejected');
  assert.ok(rejected?.status === 'rejected' && status(409)(rejected.reason));
  assert.equal((await database.query("SELECT id FROM drocsid.accounts WHERE username='duplicada'")).length, 1);
});

test('MERGE-05: invalid registration cannot create an account or session', async t => {
  const fixture = await postgresFixture(t), database = await fixture.open(), identity = new Identity(database);
  for (const [username, secret] of [['A', password], ['a', password], ['a'.repeat(33), password], ['normal', 'a'.repeat(14)], ['normal', 'a'.repeat(129)], [null, password], ['normal', null]]) {
    await assert.rejects(identity.register(username, secret, 'ip'), status(400));
  }
  assert.deepEqual(await database.query('SELECT id FROM drocsid.accounts'), []);
  assert.deepEqual(await database.query('SELECT token_hash FROM drocsid.sessions'), []);
});

test('MERGE-06: authentication failures and concurrency are bounded', async t => {
  const fixture = await postgresFixture(t), database = await fixture.open();
  let now = 2000000000000;
  const identity = new Identity(database, { now: () => now });
  const registered = await identity.register('ana', password, 'register');
  for (let attempt = 0; attempt < 5; attempt++) {
    const known = await identity.login('ana', 'senha errada mas longa', 'known').catch((error: unknown) => error);
    const missing = await identity.login('naoexiste', 'senha errada mas longa', 'missing').catch((error: unknown) => error);
    assert.ok(known instanceof IdentityError && missing instanceof IdentityError);
    assert.equal(known.status, 401); assert.equal(missing.status, 401);
    assert.equal(known.message, missing.message); assert.equal(known.code, missing.code);
  }
  await assert.rejects(identity.login('ana', password, 'other-ip'), status(429));
  await assert.rejects(identity.login('another', password, 'known'), status(429));
  now += 60000;
  const loggedIn = await identity.login('ana', password, 'known');
  assert.deepEqual(loggedIn.user, registered.user); assert.notEqual(loggedIn.token, registered.token);
  const anotherOwner = new Identity(database);
  let derivations = 0;
  const hook = createHook({ init(_id, type) { if (type === 'SCRYPTREQUEST') derivations++; } });
  hook.enable();
  const burst = await (async () => {
    try { return await Promise.allSettled([
      identity.register('one', password, 'burst-a'), anotherOwner.register('two', password, 'burst-b'),
      ...Array.from({ length: 8 }, (_, index) => identity.register(`extra${index}`, password, `burst-${index}`)),
    ]); }
    finally { hook.disable(); }
  })();
  assert.equal(derivations, 2, 'Only the two admitted requests may start a native scrypt job');
  assert.equal(burst.filter(item => item.status === 'fulfilled').length, 2);
  assert.equal(burst.filter(item => item.status === 'rejected' && status(429)(item.reason)).length, 8);
  assert.equal((await database.query("SELECT id FROM drocsid.accounts WHERE username LIKE 'extra%'")).length, 0);
});

test('MERGE-06: limiter capacity refuses new keys without discarding a blocked identity', async t => {
  const fixture = await postgresFixture(t), database = await fixture.open(), identity = new Identity(database);
  for (let index = 0; index < 5; index++) await assert.rejects(identity.login('blocked', null, 'blocked-ip'), status(401));
  let accepted = 0;
  for (let index = 0; index < 5000; index++) {
    try { await identity.login(`unknown${index}`, null, `ip-${index}`); assert.fail('Invalid login accepted'); }
    catch (error) { assert.ok(status(401)(error) || status(429)(error)); if (status(401)(error)) accepted++; }
  }
  assert.ok(accepted > 0 && accepted < 5000);
  await assert.rejects(identity.login('blocked', password, 'fresh-ip'), status(429));
  assert.deepEqual(await database.query('SELECT token_hash FROM drocsid.sessions'), []);
});

test('MERGE-07: expired or revoked sessions cannot be reused', async t => {
  const fixture = await postgresFixture(t), database = await fixture.open();
  let now = 2000000000000;
  const identity = new Identity(database, { now: () => now });
  const registered = await identity.register('ana', password, 'ip');
  let session = await identity.authenticate(registered.token);
  assert.deepEqual(session.user, registered.user);
  assert.deepEqual((await new Identity(await fixture.open(), { now: () => now }).authenticate(registered.token)).user, registered.user);
  assert.equal(session.id, sha(registered.token)); assert.equal(session.expiresAt, now + 86400000);
  now += 1799999;
  session = await identity.authenticate(registered.token);
  assert.equal(session.idleAt, now + 1800000);
  now += 1800000;
  await assert.rejects(identity.authenticate(registered.token), status(401));
  const second = await identity.login('ana', password, 'ip');
  const created = now;
  for (let hour = 0; hour < 24; hour++) for (let quarter = 0; quarter < 4; quarter++) {
    now = created + (hour * 4 + quarter) * 900000;
    assert.deepEqual((await identity.authenticate(second.token)).user, registered.user);
  }
  now = created + 86400000;
  await assert.rejects(identity.authenticate(second.token), status(401));
  const third = await identity.login('ana', password, 'ip');
  const ticket = await identity.createTicket(third.token);
  assert.equal(await identity.logout(third.token), sha(third.token));
  await assert.rejects(identity.authenticate(third.token), status(401));
  await assert.rejects(identity.consumeTicket(ticket.ticket), status(401));
  const restarted = new Identity(await fixture.open(), { now: () => now });
  await assert.rejects(restarted.authenticate(third.token), status(401));
  assert.equal((await database.query('SELECT token_hash FROM drocsid.sessions WHERE token_hash=$1', [sha(third.token)])).length, 0);
});

test('MERGE-08: websocket tickets are hashed, one-use and expire in thirty seconds', async t => {
  const fixture = await postgresFixture(t), database = await fixture.open();
  let now = 2000000000000;
  const identity = new Identity(database, { now: () => now });
  const account = await identity.register('ana', password, 'ip');
  await assert.rejects(identity.createTicket('missing'), status(401));
  const ticket = await identity.createTicket(account.token);
  assert.match(ticket.ticket, /^[A-Za-z0-9_-]{43}$/); assert.equal(ticket.expiresAt, now + 30000);
  assert.deepEqual(await database.query('SELECT ticket_hash,session_id FROM drocsid.ws_tickets'), [{ ticket_hash: sha(ticket.ticket), session_id: sha(account.token) }]);
  const consumed = await Promise.allSettled([identity.consumeTicket(ticket.ticket), identity.consumeTicket(ticket.ticket)]);
  const success = consumed.find(item => item.status === 'fulfilled');
  assert.ok(success?.status === 'fulfilled'); assert.deepEqual(success.value.user, account.user);
  assert.equal(consumed.filter(item => item.status === 'rejected' && status(401)(item.reason)).length, 1);
  const expired = await identity.createTicket(account.token); now += 30000;
  await assert.rejects(identity.consumeTicket(expired.ticket), status(401));
  const idle = await identity.createTicket(account.token); now += 1800000;
  await assert.rejects(identity.consumeTicket(idle.ticket), status(401));
  await assert.rejects(identity.consumeTicket(account.token), status(401));
});

test('MERGE-09: known foreign group identifiers never grant access', async t => {
  const fixture = await postgresFixture(t), database = await fixture.open(), identity = new Identity(database);
  await accounts(database);
  await database.createRoom({ id: 'legacy', name: 'Legado', description: 'Não publicar' });
  const a = await identity.createGroup('ana', 'Equipe A'), b = await identity.createGroup('bia', 'Equipe B');
  assert.deepEqual(await identity.groupsFor('ana'), [a]); assert.deepEqual(await identity.groupsFor('caio'), []);
  assert.deepEqual(await identity.roomsFor('ana'), a.rooms);
  assert.deepEqual(await identity.roomsFor('ana', b.id), []);
  assert.deepEqual(await identity.requireRoom('ana', a.rooms[0].id), a.rooms[0]);
  for (const id of [b.rooms[0].id, 'legacy', 'known-but-missing']) await assert.rejects(identity.requireRoom('ana', id), status(404));
  await assert.rejects(identity.createRoom('ana', b.id, 'forjada'), status(404));
  await assert.rejects(identity.createInvite('ana', b.id), status(404));
  assert.deepEqual(await identity.groupsFor('bia'), [b]);
});

test('MERGE-10: group creation and owner administration are atomic', async t => {
  const fixture = await postgresFixture(t), database = await fixture.open(), identity = new Identity(database);
  await accounts(database);
  const group = await identity.createGroup('ana', '  Equipe  ');
  assert.equal(group.name, 'Equipe'); assert.equal(group.ownerId, 'ana'); assert.equal(group.rooms.length, 1);
  assert.deepEqual(group.rooms[0], { id: group.rooms[0].id, name: 'geral', description: '' });
  assert.deepEqual(await database.query('SELECT group_id,user_id FROM drocsid.group_members'), [{ group_id: group.id, user_id: 'ana' }]);
  const invite = await identity.createInvite('ana', group.id);
  assert.equal((await identity.acceptInvite('bia', invite.code)).id, group.id);
  await assert.rejects(identity.createRoom('bia', group.id, 'restrita'), status(403));
  await assert.rejects(identity.createInvite('bia', group.id), status(403));
  const room = await identity.createRoom('ana', group.id, 'projetos');
  assert.deepEqual(await identity.roomsFor('bia'), [group.rooms[0], room]);
  const groupCount = (await database.query('SELECT id FROM drocsid.groups')).length;
  await database.query(`CREATE SEQUENCE drocsid.group_attempts;
    CREATE FUNCTION drocsid.reject_group_room() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM nextval('drocsid.group_attempts'); RAISE EXCEPTION 'injected'; END $$;
    CREATE TRIGGER reject_group_room BEFORE INSERT ON drocsid.rooms FOR EACH ROW EXECUTE FUNCTION drocsid.reject_group_room();`);
  await assert.rejects(identity.createGroup('caio', 'Parcial'), error => error instanceof ProtocolError && error.code === 'PERSISTENCE_FAILED');
  assert.deepEqual(await database.query('SELECT last_value::text,is_called FROM drocsid.group_attempts'), [{ last_value: '1', is_called: true }]);
  assert.equal((await database.query('SELECT id FROM drocsid.groups')).length, groupCount);
  assert.deepEqual(await identity.groupsFor('caio'), []);
  assert.equal((await database.rooms()).length, 2);
});

test('MERGE-11: invites expire and are consumed once atomically', async t => {
  const fixture = await postgresFixture(t), database = await fixture.open();
  let now = 2000000000000;
  const identity = new Identity(database, { now: () => now }); await accounts(database);
  const group = await identity.createGroup('ana', 'Equipe');
  const invite = await identity.createInvite('ana', group.id);
  assert.match(invite.code, /^[A-Za-z0-9_-]{43}$/); assert.equal(invite.expiresAt, now + 86400000);
  assert.deepEqual(await database.query('SELECT id,code_hash,group_id FROM drocsid.invites'), [{ id: invite.id, code_hash: sha(invite.code), group_id: group.id }]);
  const consumed = await Promise.allSettled([identity.acceptInvite('bia', invite.code), identity.acceptInvite('caio', invite.code)]);
  assert.equal(consumed.filter(item => item.status === 'fulfilled').length, 1);
  assert.equal(consumed.filter(item => item.status === 'rejected' && status(404)(item.reason)).length, 1);
  assert.equal((await database.query('SELECT user_id FROM drocsid.group_members WHERE group_id=$1', [group.id])).length, 2);
  await assert.rejects(identity.acceptInvite('ana', invite.code), status(404));
  const expired = await identity.createInvite('ana', group.id); now += 86400000;
  await assert.rejects(identity.acceptInvite('caio', expired.code), status(404));
  const revoked = await identity.createInvite('ana', group.id);
  await assert.rejects(identity.revokeInvite('caio', group.id, revoked.id), error => status(403)(error) || status(404)(error));
  await identity.revokeInvite('ana', group.id, revoked.id);
  await assert.rejects(identity.acceptInvite('caio', revoked.code), status(404));
});

test('MERGE-11: failed membership rolls back invitation consumption', async t => {
  const fixture = await postgresFixture(t), database = await fixture.open(), identity = new Identity(database); await accounts(database);
  const group = await identity.createGroup('ana', 'Equipe'), invite = await identity.createInvite('ana', group.id);
  await database.query(`CREATE SEQUENCE drocsid.invite_attempts;
    CREATE FUNCTION drocsid.reject_member() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM nextval('drocsid.invite_attempts'); RAISE EXCEPTION 'injected'; END $$;
    CREATE TRIGGER reject_member BEFORE INSERT ON drocsid.group_members FOR EACH ROW EXECUTE FUNCTION drocsid.reject_member();`);
  await assert.rejects(identity.acceptInvite('bia', invite.code), error => error instanceof ProtocolError && error.code === 'PERSISTENCE_FAILED');
  assert.deepEqual(await database.query('SELECT last_value::text,is_called FROM drocsid.invite_attempts'), [{ last_value: '1', is_called: true }]);
  assert.deepEqual(await identity.groupsFor('bia'), []);
  assert.deepEqual(await database.query('SELECT consumed_by FROM drocsid.invites WHERE id=$1', [invite.id]), [{ consumed_by: null }]);
  await database.query('DROP TRIGGER reject_member ON drocsid.group_members');
  assert.equal((await identity.acceptInvite('bia', invite.code)).id, group.id);
  assert.equal((await database.query('SELECT user_id FROM drocsid.group_members WHERE group_id=$1 AND user_id=$2', [group.id, 'bia'])).length, 1);
});

test('MERGE-07: session inspection never extends idle expiry and shutdown drains pending hashing', async t => {
  const fixture = await postgresFixture(t), database = await fixture.open();
  let now = 2000000000000;
  const identity = new Identity(database, { now: () => now });
  const registered = await identity.register('ana', password, 'ip'), session = await identity.authenticate(registered.token);
  now += 1799999;
  assert.equal((await identity.checkSession(session.id)).idleAt, session.idleAt);
  now++;
  await assert.rejects(identity.checkSession(session.id), status(401));
  const pending = identity.register('pending', password, 'ip');
  const rejected = assert.rejects(pending, error => error instanceof ProtocolError && error.code === 'SHUTTING_DOWN');
  await identity.close(); await rejected;
  await assert.rejects(identity.register('after', password, 'ip'), error => error instanceof ProtocolError && error.code === 'SHUTTING_DOWN');
  assert.equal((await database.query("SELECT id FROM drocsid.accounts WHERE username IN ('pending','after')")).length, 0);
  assert.deepEqual(await database.query('SELECT 42 AS value'), [{ value: 42 }]);
});

test('MERGE-05: failed initial session rolls back the new identity', async t => {
  const fixture = await postgresFixture(t), database = await fixture.open(), identity = new Identity(database);
  await database.query(`CREATE SEQUENCE drocsid.registration_attempts;
    CREATE FUNCTION drocsid.reject_session() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM nextval('drocsid.registration_attempts'); RAISE EXCEPTION 'injected'; END $$;
    CREATE TRIGGER reject_session BEFORE INSERT ON drocsid.sessions FOR EACH ROW EXECUTE FUNCTION drocsid.reject_session();`);
  await assert.rejects(identity.register('ana', password, 'ip'), error => error instanceof ProtocolError && error.code === 'PERSISTENCE_FAILED');
  assert.deepEqual(await database.query('SELECT last_value::text,is_called FROM drocsid.registration_attempts'), [{ last_value: '1', is_called: true }]);
  assert.deepEqual(await database.query('SELECT id FROM drocsid.accounts'), []);
  assert.deepEqual(await database.query('SELECT token_hash FROM drocsid.sessions'), []);
});

test('MERGE-19: identity migration upgrades a version-one database without changing legacy data', async t => {
  const fixture = await postgresFixture(t), database = await fixture.open();
  const legacyRoom = { id: 'old-room', name: 'Antiga', description: 'Preservar' };
  const legacy = { id: 'old-message', room: legacyRoom.id, author: 'Convidado', authorId: null, ownerId: null, operationId: 'old-operation', text: 'Mensagem antiga', created: 1700000000123 };
  await database.createRoom(legacyRoom); const stored = await database.saveMessage(legacy);
  const checksum = (await database.query('SELECT checksum FROM drocsid.schema_migrations WHERE version=1'))[0].checksum;
  await database.query(`DROP TABLE drocsid.invites,drocsid.group_rooms,drocsid.group_members,drocsid.groups,drocsid.ws_tickets,drocsid.sessions,drocsid.accounts;
    DELETE FROM drocsid.schema_migrations WHERE version=2;`);
  const upgraded = await fixture.open();
  assert.deepEqual(await upgraded.query('SELECT version FROM drocsid.schema_migrations ORDER BY version'), [{ version: 1 }, { version: 2 }]);
  assert.deepEqual(await upgraded.query('SELECT checksum FROM drocsid.schema_migrations WHERE version=1'), [{ checksum }]);
  assert.deepEqual(await upgraded.rooms(), [legacyRoom]); assert.deepEqual(await upgraded.history(legacyRoom.id), [stored]);
  assert.deepEqual(await upgraded.saveMessage({ ...legacy, id: 'retry-id' }), stored);
  assert.deepEqual(await new Identity(upgraded).groupsFor('new-account'), []);
});
