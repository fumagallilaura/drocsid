import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDatabase } from '../server/database.js';
import type { Database } from '../server/database.js';
import { PROTOCOL_VERSION, ProtocolError, parseServerEvent } from '../shared/protocol.js';
import type { Message, Room } from '../shared/protocol.js';

type LegacyRoom = Room & { position: number };
type Snapshot = { rooms: LegacyRoom[]; messages: Message[] };
const invalid = () => new ProtocolError('INVALID_LEGACY_DATABASE', 'Banco SQLite legado inválido ou incompatível. Nenhum dado foi importado.');
const conflict = () => new ProtocolError('OPERATION_CONFLICT', 'O destino contém dados conflitantes. Nenhum dado foi importado.');

function integer(value: unknown): number {
  if (typeof value === 'bigint' && value >= 0n && value <= BigInt(Number.MAX_SAFE_INTEGER)) return Number(value);
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value;
  throw invalid();
}

function unique(values: readonly (string | number)[]) {
  if (new Set(values).size !== values.length) throw invalid();
}

function snapshot(source: string): Snapshot {
  let sqlite: DatabaseSync | undefined;
  try {
    sqlite = new DatabaseSync(source, { readOnly: true });
    sqlite.exec('BEGIN');
    const version = sqlite.prepare('PRAGMA user_version').get()?.user_version;
    if (version !== 0 && version !== 1) throw invalid();
    const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
    if (tables.length !== 2 || tables[0].name !== 'messages' || tables[1].name !== 'rooms') throw invalid();
    const columns = sqlite.prepare('PRAGMA table_info(messages)').all().map(row => row.name);
    const expected = ['id','room','author','text','created','authorId','operationId','sequence'];
    if (!expected.slice(0,5).every(name=>columns.includes(name)) || columns.some(name=>typeof name!=='string'||!expected.includes(name)) || (version===1&&columns.length!==expected.length)) throw invalid();
    const roomColumns = sqlite.prepare('PRAGMA table_info(rooms)').all().map(row=>row.name);
    if(roomColumns.length!==3||!['id','name','description'].every(name=>roomColumns.includes(name)))throw invalid();
    const roomQuery = sqlite.prepare('SELECT rowid AS position,id,name,description FROM rooms ORDER BY rowid'); roomQuery.setReadBigInts(true);
    const rooms = roomQuery.all().map(row => {
      const event = parseServerEvent(JSON.stringify({ v:PROTOCOL_VERSION,type:'room-created',requestId:'legacy',room:{id:row.id,name:row.name,description:row.description} }));
      if(event.type!=='room-created')throw invalid();
      return {...event.room,position:integer(row.position)};
    });
    const roomIds = new Set(rooms.map(room=>room.id));
    const messageQuery = sqlite.prepare('SELECT rowid AS legacy_rowid,* FROM messages ORDER BY rowid'); messageQuery.setReadBigInts(true);
    const messages = messageQuery.all().map(row => {
      const event = parseServerEvent(JSON.stringify({v:PROTOCOL_VERSION,type:'message-accepted',requestId:'legacy',message:{
        id:row.id,room:row.room,author:row.author,text:row.text,created:integer(row.created),
        authorId:row.authorId??null,operationId:row.operationId??null,sequence:integer(row.sequence??row.legacy_rowid),
      }}));
      if(event.type!=='message-accepted'||!roomIds.has(event.message.room))throw invalid();
      return event.message;
    }).sort((a,b)=>a.sequence-b.sequence);
    unique(rooms.map(room=>room.id)); unique(rooms.map(room=>room.position));
    unique(messages.map(message=>message.id)); unique(messages.map(message=>message.sequence));
    unique(messages.flatMap(message=>message.operationId===null?[]:[message.operationId]));
    return {rooms,messages};
  } catch { throw invalid(); }
  finally { sqlite?.close(); }
}

export async function importSqlite(source: string, database: Database) {
  const data = snapshot(source), fingerprint = createHash('sha256').update(JSON.stringify(data)).digest('hex');
  return database.transaction(async client => {
    await client.query('LOCK TABLE drocsid.rooms,drocsid.messages,drocsid.legacy_imports IN EXCLUSIVE MODE');
    const already = await client.query<Record<string,unknown>>('SELECT fingerprint FROM drocsid.legacy_imports WHERE fingerprint=$1',[fingerprint]);
    const existingRooms = (await client.query<Record<string,unknown>>('SELECT id,name,description,position FROM drocsid.rooms WHERE id=ANY($1::text[]) OR position=ANY($2::bigint[])', [data.rooms.map(room=>room.id),data.rooms.map(room=>room.position)])).rows;
    const byRoomId = new Map(existingRooms.map(row=>[row.id,row])), byPosition = new Map(existingRooms.map(row=>[row.position,row]));
    for(const room of data.rooms) {
      const existing=byRoomId.get(room.id);
      if(existing) { if(existing.name!==room.name||existing.description!==room.description||existing.position!==String(room.position))throw conflict(); }
      else if(byPosition.has(String(room.position)))throw conflict();
    }
    const existingMessages = (await client.query<Record<string,unknown>>(`SELECT * FROM drocsid.messages
      WHERE id=ANY($1::text[]) OR operation_id=ANY($2::text[]) OR sequence=ANY($3::bigint[])`,[data.messages.map(message=>message.id),data.messages.flatMap(message=>message.operationId===null?[]:[message.operationId]),data.messages.map(message=>message.sequence)])).rows;
    const byId=new Map(existingMessages.map(row=>[row.id,row])),byOperation=new Map(existingMessages.map(row=>[row.operation_id,row])),bySequence=new Map(existingMessages.map(row=>[row.sequence,row]));
    for(const message of data.messages) {
      const existing=byId.get(message.id);
      if(existing) {
        if(existing.room!==message.room||existing.author!==message.author||existing.text!==message.text||existing.created!==String(message.created)||existing.sequence!==String(message.sequence)||existing.author_id!==message.authorId||existing.operation_id!==message.operationId||existing.receipt_owner!==null)throw conflict();
      } else if(bySequence.has(String(message.sequence))||(message.operationId!==null&&byOperation.has(message.operationId)))throw conflict();
    }
    await client.query(`INSERT INTO drocsid.rooms(id,name,description,position)
      SELECT id,name,description,position FROM jsonb_to_recordset($1::jsonb) AS room(id TEXT,name TEXT,description TEXT,position BIGINT)
      ORDER BY position ON CONFLICT(id) DO NOTHING`,[JSON.stringify(data.rooms)]);
    await client.query(`INSERT INTO drocsid.messages(id,room,author,text,created,author_id,operation_id,sequence,receipt_owner)
      SELECT id,room,author,text,created,"authorId","operationId",sequence,NULL FROM jsonb_to_recordset($1::jsonb)
      AS message(id TEXT,room TEXT,author TEXT,text TEXT,created BIGINT,"authorId" TEXT,"operationId" TEXT,sequence BIGINT)
      ORDER BY sequence ON CONFLICT(id) DO NOTHING`,[JSON.stringify(data.messages)]);
    await client.query('INSERT INTO drocsid.legacy_imports(fingerprint) VALUES ($1) ON CONFLICT DO NOTHING',[fingerprint]);
    // PostgreSQL sequence counters are not transactional. Only advance them, after all inserts.
    if(data.rooms.length)await client.query("SELECT setval('drocsid.rooms_position_seq',GREATEST((SELECT last_value FROM drocsid.rooms_position_seq),(SELECT MAX(position) FROM drocsid.rooms)))");
    if(data.messages.length)await client.query("SELECT setval('drocsid.messages_sequence_seq',GREATEST((SELECT last_value FROM drocsid.messages_sequence_seq),(SELECT MAX(sequence) FROM drocsid.messages)))");
    return {rooms:data.rooms.length,messages:data.messages.length,reused:already.rows.length>0};
  });
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  let database: Database | undefined;
  try {
    const args=process.argv.slice(2);
    if(args.length!==2||args[0]!=='--source'||!args[1])throw new ProtocolError('INVALID_INPUT');
    database=await createDatabase();
    const result=await importSqlite(resolve(args[1]),database);
    await database.close();
    console.log(JSON.stringify(result));
  } catch(error) {
    console.error(JSON.stringify({phase:'legacy-import',code:error instanceof ProtocolError?error.code:'PERSISTENCE_FAILED'}));
    process.exitCode=1;
  } finally { await database?.close().catch(()=>{process.exitCode=1;}); }
}
