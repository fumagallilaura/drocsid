import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase, databaseConfig } from '../server/database.js';
import { ProtocolError } from '../shared/protocol.js';
import { postgresFixture } from './helpers/postgres.js';

const hasCode = (code: string) => (error: unknown) => error instanceof ProtocolError && error.code === code;
const room = { id: 'room-a', name: 'Estúdio', description: 'Planejamento e café ☕' };
const message = { id: 'message-a', room: room.id, author: 'Ana', authorId: 'account-a', ownerId: 'account-a', operationId: 'operation-a', text: 'Olá, grupo!', created: 1700000000123 };

test('MERGE-21: PostgreSQL configuration requires explicit credentials and verified remote TLS', () => {
  for (const value of [undefined, '', 'sqlite:db', 'postgres://localhost/test', 'postgres://user@localhost/test', 'postgres://user:secret@localhost/', 'postgres://user:secret@localhost/test#fragment']) {
    assert.throws(() => databaseConfig({ DATABASE_URL: value }), hasCode('INVALID_INPUT'));
  }
  const local = databaseConfig({ DATABASE_URL: 'postgres://user:fictional@127.0.0.1:5432/test' });
  assert.equal(local.ssl, false);
  assert.equal(local.max, 8);
  assert.equal(local.connectionTimeoutMillis, 3000);
  assert.equal(local.statement_timeout, 3000);
  const remote = databaseConfig({ DATABASE_URL: 'postgres://user:fictional@database.example/test' });
  assert.ok(remote.ssl && typeof remote.ssl === 'object');
  assert.equal(remote.ssl.rejectUnauthorized, true);
  const verified = databaseConfig({ DATABASE_URL: 'postgres://user:fictional@database.example/test?sslmode=verify-full' });
  assert.ok(verified.ssl && typeof verified.ssl === 'object');
  assert.equal(verified.ssl.rejectUnauthorized, true);
  for (const suffix of ['sslmode=disable', 'sslmode=require', 'sslmode=no-verify', 'sslrootcert=untrusted', 'host=127.0.0.1', 'user=override', 'options=-c%20statement_timeout%3D0']) {
    const secret = 'fictional-secret-that-must-not-be-reported';
    try { databaseConfig({ DATABASE_URL: `postgres://user:${secret}@database.example/test?${suffix}` }); assert.fail('Unsafe configuration accepted'); }
    catch (error) { assert.ok(hasCode('INVALID_INPUT')(error)); assert.ok(!String(error).includes(secret)); assert.ok(!JSON.stringify(error).includes(secret)); }
  }
});

test('MERGE-19: PostgreSQL commits, survives reconnect and rolls back incomplete work', async t => {
  const fixture = await postgresFixture(t);
  let database = await fixture.open();
  assert.deepEqual(await database.createRoom(room), room);
  const saved = await database.saveMessage(message);
  const { ownerId: _owner, ...wire } = message;
  assert.deepEqual(saved, { ...wire, sequence: 1 });
  await database.close();
  database = await fixture.open();
  assert.deepEqual(await database.rooms(), [room]);
  assert.deepEqual(await database.history(room.id), [saved]);
  await assert.rejects(database.transaction(async client => {
    await client.query('INSERT INTO drocsid.rooms (id,name,description) VALUES ($1,$2,$3)', ['rolled-back', 'Parcial', '']);
    await client.query('INSERT INTO drocsid.messages (id,room,author,text,created) VALUES ($1,$2,$3,$4,$5)', ['partial', 'rolled-back', 'Ana', 'incompleta', 1]);
    throw new ProtocolError('CANCELLED');
  }), hasCode('CANCELLED'));
  assert.deepEqual(await database.rooms(), [room]);
  assert.deepEqual(await database.history('rolled-back'), []);
  const next = await database.saveMessage({ ...message, id: 'message-b', operationId: 'operation-b', text: 'Depois do rollback' });
  assert.ok(next.sequence > saved.sequence);
  assert.deepEqual(await database.history(room.id), [saved, next]);
  await database.close();
  const sessions = await fixture.admin.query<{ count: string }>('SELECT count(*) FROM pg_stat_activity WHERE datname=$1', [fixture.name]);
  assert.equal(sessions.rows[0].count, '0');
});

test('MERGE-19/12: concurrent writers return one immutable receipt only to its owner', async t => {
  const fixture = await postgresFixture(t);
  const first = await fixture.open();
  const second = await fixture.open();
  await first.createRoom(room);
  const [a, b] = await Promise.all([first.saveMessage(message), second.saveMessage({ ...message, id: 'second-writer-id' })]);
  assert.deepEqual(a, b);
  assert.ok(['message-a', 'second-writer-id'].includes(a.id));
  assert.equal((await first.history(room.id)).length, 1);
  assert.deepEqual(await second.saveMessage({ ...message, author: 'Nome novo', id: 'retry' }), a);
  for (const changed of [
    { ownerId: 'account-b', authorId: 'account-b' },
    { text: 'conteúdo diferente' },
    { room: 'foreign-known-room' },
    { ownerId: null, authorId: 'guest' },
  ]) await assert.rejects(second.saveMessage({ ...message, ...changed }), hasCode('OPERATION_CONFLICT'));
  assert.deepEqual(await first.history(room.id), [a]);
  const pairs = await Promise.all(Array.from({ length: 12 }, (_, i) => (i % 2 ? first : second).saveMessage({ ...message, id: `message-${i}`, operationId: `concurrent-${i}`, text: `mensagem ${i}` })));
  assert.equal(new Set(pairs.map(item => item.sequence)).size, 12);
  assert.deepEqual((await first.history(room.id)).map(item => item.sequence), [a.sequence, ...pairs.map(item => item.sequence).sort((x,y) => x-y)]);
});

test('MERGE-19: history returns the last 200 messages in their insertion sequence', async t => {
  const fixture = await postgresFixture(t);
  const database = await fixture.open();
  await database.createRoom(room);
  const saved = [];
  for (let i = 0; i < 205; i++) saved.push(await database.saveMessage({ ...message, id: `message-${i}`, operationId: `operation-${i}`, text: `mensagem ${i}`, created: message.created - i }));
  assert.deepEqual(await database.history(room.id), saved.slice(-200));
  assert.deepEqual(await database.history('unknown'), []);
});

test('MERGE-19: concurrent migrations apply once and reject unknown or altered versions', async t => {
  const fixture = await postgresFixture(t);
  const databases = await Promise.all([fixture.open(), fixture.open()]);
  const database = databases[0];
  const versions = await database.query('SELECT version,checksum FROM drocsid.schema_migrations ORDER BY version');
  assert.equal(versions.length, 2);
  assert.deepEqual(versions.map(row => row.version), [1, 2]);
  assert.equal(versions[0].version, 1);
  assert.match(String(versions[0].checksum), /^[a-f0-9]{64}$/);
  assert.match(String(versions[1].checksum), /^[a-f0-9]{64}$/);
  await database.query('INSERT INTO drocsid.schema_migrations(version,checksum) VALUES ($1,$2)', [999, 'f'.repeat(64)]);
  await assert.rejects(createDatabase({ DATABASE_URL: fixture.url }), hasCode('INCOMPATIBLE_DATABASE'));
  assert.equal((await database.query('SELECT version FROM drocsid.schema_migrations WHERE version=999')).length, 1);
  await database.query('DELETE FROM drocsid.schema_migrations WHERE version=999');
  await database.query('UPDATE drocsid.schema_migrations SET checksum=$1 WHERE version=1', ['0'.repeat(64)]);
  await assert.rejects(createDatabase({ DATABASE_URL: fixture.url }), hasCode('INCOMPATIBLE_DATABASE'));
  assert.equal((await database.query('SELECT checksum FROM drocsid.schema_migrations WHERE version=1'))[0].checksum, '0'.repeat(64));
});

test('MERGE-19: closing interrupts active queries and refuses later work without pool leaks', async t => {
  const fixture = await postgresFixture(t);
  const database = await fixture.open();
  const started = Promise.withResolvers<void>();
  const waiting = database.transaction(async client => { started.resolve(); await client.query('SELECT pg_sleep(30)'); });
  const rejected = assert.rejects(waiting, hasCode('PERSISTENCE_FAILED'));
  await started.promise;
  const time = performance.now();
  const closing = database.close();
  assert.equal(database.close(), closing);
  await closing; await rejected;
  assert.ok(performance.now() - time < 1000);
  await assert.rejects(database.history(room.id), hasCode('SHUTTING_DOWN'));
  const sessions = await fixture.admin.query<{ count: string }>('SELECT count(*) FROM pg_stat_activity WHERE datname=$1', [fixture.name]);
  assert.equal(sessions.rows[0].count, '0');
});

test('MERGE-19: failed DDL rolls back every table and its migration record', async t => {
  const fixture = await postgresFixture(t);
  await fixture.inspect('CREATE SCHEMA drocsid; CREATE TABLE drocsid.messages (incompatible BOOLEAN)');
  await assert.rejects(fixture.open(), hasCode('PERSISTENCE_FAILED'));
  const tables = await fixture.inspect("SELECT tablename FROM pg_tables WHERE schemaname='drocsid' ORDER BY tablename");
  assert.deepEqual(tables, [{ tablename: 'messages' }]);
});

test('MERGE-19: shutting down one pool preserves another owner on the same database', async t => {
  const fixture = await postgresFixture(t);
  const ending = await fixture.open(), healthy = await fixture.open();
  const started = Promise.withResolvers<void>();
  const work = ending.transaction(async client => { started.resolve(); await client.query('SELECT pg_sleep(30)'); });
  const rejected = assert.rejects(work, hasCode('PERSISTENCE_FAILED'));
  await started.promise;
  const other = healthy.query('SELECT pg_sleep(0.4), 42 AS result');
  await ending.close(); await rejected;
  assert.equal((await other)[0].result, 42);
  assert.equal((await healthy.query('SELECT 43 AS result'))[0].result, 43);
});

test('MERGE-21: PostgreSQL never falls back to plaintext when verified TLS was required', async t => {
  const fixture = await postgresFixture(t);
  assert.deepEqual(await fixture.inspect('SHOW ssl'), [{ ssl: 'off' }]);
  const url = new URL(fixture.url); url.search = '?sslmode=verify-full';
  await assert.rejects(createDatabase({ DATABASE_URL: url.href }), error => {
    assert.ok(hasCode('PERSISTENCE_FAILED')(error));
    assert.ok(!String(error).includes(url.password));
    assert.ok(!JSON.stringify(error).includes(url.password));
    return true;
  });
  assert.deepEqual(await fixture.inspect("SELECT to_regclass('drocsid.schema_migrations')::text AS migration"), [{ migration: null }]);
  const database = await fixture.open();
  assert.deepEqual(await database.rooms(), []);
});
