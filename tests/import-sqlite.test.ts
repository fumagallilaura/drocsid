import test from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, realpathSync, lstatSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { importSqlite } from '../scripts/import-sqlite.mjs';
import { postgresFixture } from './helpers/postgres.js';
import { ProtocolError } from '../shared/protocol.js';
import type { Message, Room } from '../shared/protocol.js';

const hasCode = (code: string) => (error: unknown) => error instanceof ProtocolError && error.code === code;
const digest = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const rooms: Room[] = [{ id: 'room-a', name: 'Geral', description: 'Encontro ☕' }, { id: 'room-b', name: 'Projetos', description: 'Ideias' }];

function legacyFixture(t: Pick<TestContext, 'after'>, modern = true) {
  const root = resolve('test-results/legacy-imports'); mkdirSync(root, { recursive: true });
  const directory = mkdtempSync(join(root, 'fixture-')), source = join(directory, 'conversa.sqlite'), preferences = join(directory, 'preferences.json');
  writeFileSync(preferences, JSON.stringify({ name: 'Ana', server: 'https://example.test', quality: '1080' }));
  const sqlite = new DatabaseSync(source);
  try {
    sqlite.exec(`CREATE TABLE rooms (id TEXT PRIMARY KEY,name TEXT NOT NULL,description TEXT NOT NULL);
      CREATE TABLE messages (id TEXT PRIMARY KEY,room TEXT NOT NULL,author TEXT NOT NULL,text TEXT NOT NULL,created INTEGER NOT NULL${modern ? ',authorId TEXT,operationId TEXT,sequence INTEGER' : ''});
      PRAGMA user_version=${modern ? 1 : 0};`);
    for (const item of rooms) sqlite.prepare('INSERT INTO rooms VALUES (?,?,?)').run(item.id, item.name, item.description);
    const data = [
      ['m-z', 'room-a', 'Ana', 'Mensagem & <script>literal</script>', 1000, 'old-ana', 'op-z', 30],
      ['m-a', 'room-a', 'Bia', 'Café ☕', 1000, null, null, 10],
      ['m-m', 'room-a', 'Ana', 'Ordem independente da data', 999999, 'other-guest', 'op-m', 20],
    ];
    const statement = sqlite.prepare(modern ? 'INSERT INTO messages VALUES (?,?,?,?,?,?,?,?)' : 'INSERT INTO messages VALUES (?,?,?,?,?)');
    for (const item of data) statement.run(...(modern ? item : item.slice(0,5)));
  } finally { sqlite.close(); }
  t.after(() => {
    if (dirname(realpathSync(directory)) !== realpathSync(root) || lstatSync(directory).isSymbolicLink()) throw new Error('Unsafe legacy test fixture');
    rmSync(directory, { recursive: true });
  });
  const expected: Message[] = [
    { id:'m-z',room:'room-a',author:'Ana',text:'Mensagem & <script>literal</script>',created:1000,authorId:modern?'old-ana':null,operationId:modern?'op-z':null,sequence:modern?30:1 },
    { id:'m-a',room:'room-a',author:'Bia',text:'Café ☕',created:1000,authorId:null,operationId:null,sequence:modern?10:2 },
    { id:'m-m',room:'room-a',author:'Ana',text:'Ordem independente da data',created:999999,authorId:modern?'other-guest':null,operationId:modern?'op-m':null,sequence:modern?20:3 },
  ].sort((a,b)=>a.sequence-b.sequence);
  return { source, preferences, expected };
}

test('MERGE-20: legacy SQLite imports preserve data and source bytes atomically', async t => {
  for (const modern of [false,true]) {
    const source = legacyFixture(t,modern), fixture = await postgresFixture(t), database = await fixture.open();
    const before = digest(source.source), prefsBefore = digest(source.preferences);
    assert.deepEqual(await importSqlite(source.source,database), { rooms:2,messages:3,reused:false });
    assert.deepEqual(await database.rooms(),rooms);
    assert.deepEqual(await database.history('room-a'),source.expected);
    assert.deepEqual(await database.history('room-b'),[]);
    assert.deepEqual(await importSqlite(source.source,database), { rooms:2,messages:3,reused:true });
    assert.deepEqual(await database.history('room-a'),source.expected);
    assert.equal((await fixture.inspect('SELECT count(*)::int AS count FROM drocsid.messages'))[0].count,3);
    assert.equal((await fixture.inspect('SELECT count(*)::int AS count FROM drocsid.legacy_imports'))[0].count,1);
    assert.equal(digest(source.source),before);
    assert.equal(digest(source.preferences),prefsBefore);
  }
});

test('MERGE-20/12: concurrent imports consume one snapshot without crediting guests to accounts', async t => {
  const source = legacyFixture(t), fixture = await postgresFixture(t), first = await fixture.open(), second = await fixture.open();
  const results = await Promise.all([importSqlite(source.source,first),importSqlite(source.source,second)]);
  assert.deepEqual(results.map(item=>item.reused).sort(),[false,true]);
  assert.deepEqual(await first.history('room-a'),source.expected);
  const original = source.expected.find(item=>item.operationId==='op-z'); assert.ok(original);
  const retry = { ...original,id:'retry',operationId:'op-z',ownerId:null,authorId:'new-guest-id' };
  assert.deepEqual(await second.saveMessage(retry),original);
  await assert.rejects(second.saveMessage({...retry,ownerId:'account-a',authorId:'account-a'}),hasCode('OPERATION_CONFLICT'));
  const next = await first.saveMessage({...retry,id:'new-message',operationId:'new-operation',text:'Depois da importação'});
  assert.ok(next.sequence>30);
  assert.deepEqual(await first.createRoom({id:'room-new',name:'Nova',description:''}),{id:'room-new',name:'Nova',description:''});
  assert.deepEqual(await first.rooms(),[...rooms,{id:'room-new',name:'Nova',description:''}]);
});

test('MERGE-20: conflicting room, message, operation or sequence never overwrites the target', async t => {
  const source = legacyFixture(t), before = digest(source.source);
  for (const conflict of ['room','id','operation','sequence']) {
    const fixture = await postgresFixture(t), database = await fixture.open();
    await database.createRoom({...rooms[0],name:conflict==='room'?'Outro grupo':rooms[0].name});
    if(conflict!=='room') await fixture.inspect(`INSERT INTO drocsid.messages(sequence,id,room,author,text,created,operation_id,receipt_owner)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [conflict==='sequence'?20:1,conflict==='id'?'m-z':'existing-id','room-a','Caio','Dado existente',11,conflict==='operation'?'op-z':'existing-op','account-c']);
    const previousRooms=await database.rooms(), previousMessages=await database.history('room-a');
    await assert.rejects(importSqlite(source.source,database),hasCode('OPERATION_CONFLICT'));
    assert.deepEqual(await database.rooms(),previousRooms); assert.deepEqual(await database.history('room-a'),previousMessages);
    assert.equal((await fixture.inspect('SELECT count(*)::int AS count FROM drocsid.legacy_imports'))[0].count,0);
  }
  assert.equal(digest(source.source),before);
});

test('MERGE-20: a previous import fingerprint never hides a later target conflict', async t => {
  const source=legacyFixture(t),fixture=await postgresFixture(t),database=await fixture.open(),before=digest(source.source);
  await importSqlite(source.source,database);
  await fixture.inspect('UPDATE drocsid.messages SET text=$1 WHERE id=$2',['Alteração no destino','m-z']);
  const changed=await database.history('room-a');
  await assert.rejects(importSqlite(source.source,database),hasCode('OPERATION_CONFLICT'));
  assert.deepEqual(await database.history('room-a'),changed);
  assert.equal((await fixture.inspect('SELECT count(*)::int AS count FROM drocsid.legacy_imports'))[0].count,1);
  assert.equal(digest(source.source),before);
});

test('MERGE-20: a database failure after room insertion rolls back the whole import', async t => {
  const source=legacyFixture(t),fixture=await postgresFixture(t),database=await fixture.open(),before=digest(source.source);
  await fixture.inspect(`CREATE SEQUENCE drocsid.import_attempts;
    CREATE FUNCTION drocsid.reject_test_import() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN PERFORM nextval('drocsid.import_attempts'); RAISE EXCEPTION 'test rejection'; END$$;
    CREATE TRIGGER reject_test_import BEFORE INSERT ON drocsid.messages FOR EACH ROW EXECUTE FUNCTION drocsid.reject_test_import();`);
  await assert.rejects(importSqlite(source.source,database),hasCode('PERSISTENCE_FAILED'));
  assert.deepEqual(await fixture.inspect('SELECT last_value,is_called FROM drocsid.import_attempts'),[{last_value:'1',is_called:true}]);
  assert.deepEqual(await database.rooms(),[]); assert.deepEqual(await database.history('room-a'),[]);
  assert.equal((await fixture.inspect('SELECT count(*)::int AS count FROM drocsid.legacy_imports'))[0].count,0);
  assert.equal(digest(source.source),before);
});

test('MERGE-20: future schema, unsafe integers and corrupt input are rejected without partial data', async t => {
  for(const invalid of ['future','integer','corrupt']) {
    const source=legacyFixture(t),fixture=await postgresFixture(t),database=await fixture.open();
    if(invalid==='corrupt')writeFileSync(source.source,'This is not SQLite');
    else { const sqlite=new DatabaseSync(source.source); try { if(invalid==='future')sqlite.exec('PRAGMA user_version=99');else sqlite.prepare('UPDATE messages SET created=? WHERE id=?').run(9007199254740992n,'m-z'); }finally{sqlite.close();} }
    const before=digest(source.source);
    await assert.rejects(importSqlite(source.source,database),hasCode('INVALID_LEGACY_DATABASE'));
    assert.deepEqual(await database.rooms(),[]); assert.deepEqual(await database.history('room-a'),[]);
    assert.equal(digest(source.source),before);
  }
});

test('MERGE-20/21: the explicit import CLI reports counts without printing credentials', async t => {
  const source=legacyFixture(t),fixture=await postgresFixture(t),database=await fixture.open(),url=new URL(fixture.url),before=digest(source.source);
  const child=spawnSync(process.execPath,['scripts/import-sqlite.mjs','--source',source.source],{env:{...process.env,DATABASE_URL:fixture.url},encoding:'utf8',windowsHide:true,timeout:8000});
  assert.equal(child.status,0); assert.deepEqual(JSON.parse(child.stdout),{rooms:2,messages:3,reused:false});
  assert.ok(!(child.stdout+child.stderr).includes(url.password)); assert.ok(!(child.stdout+child.stderr).includes(fixture.url));
  assert.deepEqual(await database.history('room-a'),source.expected); assert.equal(digest(source.source),before);
  const missing=spawnSync(process.execPath,['scripts/import-sqlite.mjs','--source',source.source],{env:{...process.env,DATABASE_URL:''},encoding:'utf8',windowsHide:true,timeout:8000});
  assert.equal(missing.status,1); assert.equal(missing.stdout,''); assert.match(missing.stderr,/INVALID_INPUT/); assert.equal(digest(source.source),before);
});
