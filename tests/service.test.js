import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { connect } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createService } from '../server/service.js';
import { client } from './helpers/client.js';

async function start(t, options={}) {
  const service=createService({dbPath:':memory:',iceServers:[],...options});
  await new Promise(resolve=>service.server.listen(0,'127.0.0.1',resolve));
  t.after(()=>service.close()); service.url=`ws://127.0.0.1:${service.server.address().port}/ws`; return service;
}

test('STAB-18/19/21/23/24/53: destination is explicit and commit receipt is idempotent', async t=>{
  const s=await start(t), a=await client(s.url), sameRoom=await client(s.url,'Bia'), other=await client(s.url,'Caio','cafe');
  const accepted=await a.request({type:'message',operationId:'stable-operation',text:'Persistir uma vez'});
  assert.equal(accepted.message.room,'geral'); assert.equal(accepted.message.operationId,'stable-operation'); assert.equal(accepted.message.authorId,a.id); assert.equal(accepted.message.sequence,1);
  const repeat=await a.request({type:'message',operationId:'stable-operation',text:'Persistir uma vez'});
  assert.deepEqual(repeat.message,accepted.message);
  await a.request({type:'join',name:'Ana',room:'cafe'});
  a.send({type:'message',room:'geral',operationId:'wrong-destination',text:'Não enviar'});
  assert.equal((await a.next('error')).code,'ROOM_MISMATCH');
  a.send({type:'message',operationId:'stable-operation',text:'outro conteúdo'});
  assert.equal((await a.next('error')).code,'OPERATION_CONFLICT');
  await a.request({type:'join',name:'Ana',room:'geral'});
  const history=await a.request({type:'join',name:'Ana',room:'geral'});
  assert.equal(history.messages.length,1); assert.equal(history.messages[0].id,accepted.message.id);
  await sameRoom.next('message'); assert.equal(sameRoom.events.filter(e=>e.type==='message').length,0);
  assert.equal(other.events.some(e=>e.type==='message'),false);
});

test('STAB-25/26/55: failed delivery after commit survives restart; locked write is not confirmed', async t=>{
  const dir=mkdtempSync(join(tmpdir(),'conversa-receipts-')), dbPath=join(dir,'test.sqlite');
  let s=await start(t,{dbPath});
  t.after(async()=>{await s.close();rmSync(dir,{recursive:true,force:true});});
  let a=await client(s.url);
  const socket=[...s.wss.clients][0], original=socket.send;
  socket.send=function(data,...rest){if(JSON.parse(data).type==='message')throw Error('delivery');return original.call(this,data,...rest);};
  const accepted=await a.request({type:'message',operationId:'durable',text:'Confirmada'});
  assert.equal(accepted.message.text,'Confirmada'); await s.close();
  s=await start(t,{dbPath}); a=await client(s.url);
  assert.equal((await a.request({type:'message',operationId:'durable',text:'Confirmada'})).message.id,accepted.message.id);
  const lock=new DatabaseSync(dbPath); lock.exec('BEGIN IMMEDIATE');
  a.send({type:'message',operationId:'must-not-commit',text:'Bloqueada'});
  assert.equal((await a.next('error')).code,'PERSISTENCE_FAILED'); lock.exec('ROLLBACK'); lock.close();
  const history=await a.request({type:'join',name:'Ana',room:'geral'});
  assert.deepEqual(history.messages.map(m=>m.text),['Confirmada']);
});

test('STAB-28/29/30/68: leave and stop-screen bypass exhausted action budgets',async t=>{
  const s=await start(t), a=await client(s.url), b=await client(s.url,'Bia');
  await a.request({type:'call-join'}); await b.request({type:'call-join'}); await a.request({type:'media',sharing:true});
  for(let i=0;i<110;i++) a.send({type:'signal',to:b.id,signal:{candidate:{candidate:'candidate'}}});
  await a.next('error',e=>e.code==='RATE_LIMITED');
  const stopped=await a.request({type:'media',sharing:false}); assert.equal(stopped.sharing,false);
  const left=await a.request({type:'call-leave'}); assert.equal(left.inCall,false); assert.equal(left.sharing,false);
  const repeated=await a.request({type:'call-leave'}); assert.equal(repeated.inCall,false); assert.equal(repeated.callId,a.callId);
  const presence=await b.next('presence',e=>e.members.some(m=>m.id===a.id&&!m.inCall));
  assert.equal(presence.members.find(m=>m.id===a.id).sharing,false);
  a.send({type:'call-join',callId:a.callId,generation:1}); assert.equal((await a.next('error',e=>e.code!=='RATE_LIMITED')).code,'INVALID_EVENT');
});

test('STAB-33/36/37: unknown upgrades are rejected and concurrent shutdown completes',async t=>{
  const s=await start(t), port=s.server.address().port, socket=connect(port,'127.0.0.1');
  await once(socket,'connect'); socket.write('GET /unused-upgrade HTTP/1.1\r\nHost: localhost\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n');
  const socketClosed=once(socket,'close'); let bytes;
  try { [bytes]=await once(socket,'data',{signal:AbortSignal.timeout(1500)}); }
  finally { socket.destroy(); }
  assert.match(bytes.toString(),/^HTTP\/1\.1 404/); await socketClosed;
  const idle=connect(port,'127.0.0.1'); await once(idle,'connect');
  const closed=once(idle,'close'), started=performance.now(); await Promise.all([s.close(),s.close()]); await closed;
  assert.ok(performance.now()-started<5000); assert.equal(s.server.listening,false);
});

test('STAB-40/41: malformed signals never reach a peer and errors keep correlation',async t=>{
  const s=await start(t), a=await client(s.url), b=await client(s.url,'Bia');
  await a.request({type:'call-join'}); await b.request({type:'call-join'});
  const requestId=a.send({type:'signal',to:b.id,signal:{candidate:17}}), error=await a.next('error');
  assert.equal(error.requestId,requestId); assert.equal(error.code,'INVALID_EVENT'); assert.equal(error.phase,'protocol');
  assert.equal(b.events.some(e=>e.type==='signal'),false);
  a.ws.send('{'); assert.equal((await a.next('error')).code,'INVALID_EVENT');
  a.ws.send(JSON.stringify({type:'join',name:'Ana',room:'geral'})); assert.equal((await a.next('error')).code,'INCOMPATIBLE_PROTOCOL');
});

test('STAB-53/54/55/61: legacy history keeps stable insertion order with an indexed page', async t=>{
  const dir=mkdtempSync(join(tmpdir(),'conversa-legacy-')), dbPath=join(dir,'old.sqlite');
  const db=new DatabaseSync(dbPath); db.exec('CREATE TABLE messages (id TEXT PRIMARY KEY, room TEXT NOT NULL, author TEXT NOT NULL, text TEXT NOT NULL, created INTEGER NOT NULL)');
  db.exec('BEGIN'); const insert=db.prepare('INSERT INTO messages VALUES (?,?,?,?,?)');
  for(let i=0;i<10000;i++)insert.run(String(i),'geral','Mesmo nome',`Mensagem ${i}`,1); db.exec('COMMIT'); db.close();
  const s=await start(t,{dbPath});
  t.after(async()=>{await s.close();rmSync(dir,{recursive:true,force:true});});
  const a=await client(s.url), history=await a.request({type:'join',name:'Ana',room:'geral'});
  assert.equal(history.messages.length,200); assert.equal(history.messages[0].text,'Mensagem 9800'); assert.equal(history.messages.at(-1).text,'Mensagem 9999');
  assert.equal(history.messages[0].authorId,null);
  const check=new DatabaseSync(dbPath), plan=check.prepare('EXPLAIN QUERY PLAN SELECT * FROM messages WHERE room=? ORDER BY sequence DESC LIMIT 200').all('geral');
  assert.equal(plan.some(row=>/TEMP B-TREE/.test(row.detail)),false); assert.equal(check.prepare('SELECT count(*) AS count FROM messages').get().count,10000); check.close();
});

test('STAB-51/52: connection cap refuses 25th and slow consumer cannot block healthy delivery',async t=>{
  const s=await start(t), clients=[];
  for(let i=0;i<24;i++)clients.push(await client(s.url,`Pessoa ${i}`));
  const {WebSocket}=await import('ws'), extra=new WebSocket(s.url);
  const status=await new Promise(resolve=>{extra.once('unexpected-response',(_req,res)=>{resolve(res.statusCode);res.resume();extra.terminate();});extra.on('error',()=>{});});
  assert.equal(status,503);
  const slow=[...s.wss.clients][0]; Object.defineProperty(slow,'bufferedAmount',{get:()=>1048577});
  const closed=once(clients[0].ws,'close'); const accepted=await clients[1].request({type:'message',text:'Ainda funciona'}); await closed;
  assert.equal(accepted.message.text,'Ainda funciona'); assert.equal((await clients[2].next('message')).message.id,accepted.message.id);
});

test('STAB-32: heartbeat releases silent participant within 60 seconds',async t=>{
  t.mock.timers.enable({apis:['setInterval','setTimeout','Date'],now:0});
  const clock={now:()=>Date.now(),setTimeout:(fn,ms)=>setTimeout(fn,ms),clearTimeout:id=>clearTimeout(id),setInterval:(fn,ms)=>setInterval(fn,ms),clearInterval:id=>clearInterval(id)};
  const s=await start(t,{clock}), a=await client(s.url,'Ana','geral',{autoPong:false}), b=await client(s.url,'Bia','geral',{autoPong:false});
  await a.request({type:'call-join'}); const closed=Promise.all([once(a.ws,'close'), ...[...s.wss.clients].map(ws=>once(ws,'close'))]);
  t.mock.timers.tick(60000); await closed;
  assert.equal(a.ws.readyState,3); assert.equal(s.wss.clients.size,0);
});

test('STAB-51: 100th room is accepted and 101st is refused without deleting rooms',async t=>{
  const s=await start(t), a=await client(s.url);
  for(let i=3;i<100;i++)await a.request({type:'create-room',name:`Sala ${i}`});
  const requestId=a.send({type:'create-room',name:'Excesso'}); assert.equal((await a.next('error',e=>e.requestId===requestId)).code,'INVALID_INPUT');
  assert.equal(a.events.filter(e=>e.type==='rooms').at(-1).rooms.length,100);
});

test('STAB-37/67: failed cleanup still closes remaining resources and diagnostic omits secret payloads',async t=>{
  const s=createService({dbPath:':memory:',iceServers:[]}); await new Promise(resolve=>s.server.listen(0,'127.0.0.1',resolve));
  t.after(()=>s.close().catch(()=>{}));
  const warnings=[],originalWarn=console.warn;console.warn=value=>warnings.push(JSON.parse(value));t.after(()=>{console.warn=originalWarn;});
  const originalClose=s.wss.close.bind(s.wss);s.wss.close=callback=>originalClose(()=>callback(new Error('SECRET_TOKEN and message text')));
  await assert.rejects(s.close(),e=>e.code==='SHUTDOWN_FAILED');
  assert.equal(s.server.listening,false);assert.equal(warnings[0].phase,'shutdown');assert.equal(warnings[0].code,'SHUTDOWN_FAILED');
  assert.equal(warnings[0].version,'0.1.1');assert.equal(JSON.stringify(warnings).includes('SECRET_TOKEN'),false);
});

test('MEDIA-24/28: leave delivered before a held join makes that generation terminal without touching a newer call',async t=>{
  const s=await start(t), a=await client(s.url), observer=await client(s.url,'Bia');
  const delayedJoin={type:'call-join',callId:'old',generation:1,muted:false};
  const left=await a.request({type:'call-leave',callId:'old',generation:1});
  assert.deepEqual({callId:left.callId,generation:left.generation,inCall:left.inCall,muted:left.muted,sharing:left.sharing},
    {callId:'old',generation:1,inCall:false,muted:true,sharing:false});
  const oldId=a.send(delayedJoin), refused=await a.next('error',e=>e.requestId===oldId);
  assert.equal(refused.code,'INVALID_EVENT'); assert.equal(refused.phase,'call-join');
  const admitted=await a.request({type:'call-join',callId:'new',generation:2,muted:false});
  assert.equal(admitted.generation,2); assert.equal(admitted.inCall,true);
  await a.request({type:'media',callId:'new',generation:2,sharing:true});
  const duplicate=await a.request({type:'call-join',callId:'new',generation:2,muted:true});
  assert.equal(duplicate.sharing,true); assert.equal(duplicate.muted,false);
  const repeated=await a.request({type:'call-leave',callId:'old',generation:1});
  assert.equal(repeated.generation,1); assert.equal(repeated.inCall,false);
  for(const type of ['call-join','call-leave','media','signal']) {
    const requestId=a.send({type,callId:'different-id',generation:2,muted:true,sharing:false,to:observer.id,toCallId:'none',signal:{candidate:{candidate:''}}});
    assert.equal((await a.next('error',e=>e.requestId===requestId)).code,'INVALID_EVENT');
  }
  const snapshot=await a.request({type:'media',callId:'new',generation:2,muted:false});
  assert.equal(snapshot.inCall,true); assert.equal(snapshot.sharing,true); assert.equal(snapshot.generation,2);
  const present=await observer.next('presence',e=>e.members.some(m=>m.callId==='new'&&m.sharing));
  assert.equal(present.members.filter(m=>m.inCall).length,1);
  const revisions=observer.events.filter(e=>e.type==='presence').map(e=>e.revision);
  assert.ok(revisions.every(Number.isSafeInteger));
  assert.ok(revisions.every((value,i)=>!i||value>revisions[i-1]));
});

test('MEDIA-25/26: saturated message, media and signaling budgets still allow stop and replacement at capacity',async t=>{
  const s=await start(t), people=[];
  for(let i=0;i<7;i++)people.push(await client(s.url,`Pessoa ${i}`));
  for(const p of people.slice(0,6))await p.request({type:'call-join'});
  const a=people[0], b=people[1], extra=people[6];
  const excess=extra.send({type:'call-join'}); assert.equal((await extra.next('error',e=>e.requestId===excess)).code,'CALL_FULL');
  for(const type of ['message','media','signal']) {
    for(let i=0;i<101;i++)a.send({type,text:'quota',muted:false,sharing:true,to:b.id,signal:{candidate:{candidate:''}}});
    await a.next('error',e=>e.code==='RATE_LIMITED'&&e.phase===type);
  }
  const started=performance.now(), stopped=await a.request({type:'media',sharing:false});
  assert.equal(stopped.sharing,false); assert.equal(stopped.inCall,true);
  const left=await a.request({type:'call-leave',generation:1});
  assert.equal(left.inCall,false); assert.equal(left.sharing,false); assert.equal(left.generation,1);
  const terminal=await b.next('presence',e=>e.members.find(m=>m.id===a.id)?.inCall===false);
  assert.equal(terminal.members.find(m=>m.id===a.id).sharing,false); assert.ok(performance.now()-started<1000);
  await extra.request({type:'call-join'});
  const replacement=await b.next('presence',e=>e.members.find(m=>m.id===extra.id)?.inCall);
  assert.equal(replacement.members.filter(m=>m.inCall).length,6);
});

test('MEDIA-27: heartbeat deadline follows an off-tick pong and clears timers on close',async t=>{
  let time=0,next=0;const jobs=new Map();
  const clock={now:()=>time,setTimeout:(fn,ms)=>{const id=++next;jobs.set(id,{at:time+ms,fn});return id;},clearTimeout:id=>jobs.delete(id),
    setInterval:()=>++next,clearInterval:()=>{}};
  const tick=ms=>{time+=ms;for(const [id,job]of [...jobs])if(job.at<=time){jobs.delete(id);job.fn();}};
  const s=await start(t,{clock}), a=await client(s.url,'Ana','geral',{autoPong:false});
  await a.request({type:'call-join'}); const serverSocket=[...s.wss.clients][0];
  assert.equal(jobs.size,1); tick(12345);
  const pong=once(serverSocket,'pong');a.ws.pong();await pong; assert.equal(jobs.size,1);
  tick(59999); assert.equal(a.ws.readyState,1); assert.equal(s.wss.clients.size,1);
  const closed=Promise.all([once(a.ws,'close'),once(serverSocket,'close')]); tick(1); await closed;
  assert.equal(a.ws.readyState,3); assert.equal(s.wss.clients.size,0); assert.equal(jobs.size,0);
  const b=await client(s.url,'Bia','geral',{autoPong:false});assert.equal(jobs.size,1);
  const gone=once([...s.wss.clients][0],'close');b.ws.close();await gone;assert.equal(jobs.size,0);
  await s.close();assert.equal(jobs.size,0);
});

test('MEDIA-05/24/28: v1 requests cannot enter a v2 service or occupy its call',async t=>{
  const s=await start(t),a=await client(s.url),observer=await client(s.url,'Bia');
  a.ws.send(JSON.stringify({v:1,type:'call-join',requestId:'old-version',callId:'old-call',generation:1,muted:false}));
  const error=await a.next('error',e=>e.requestId==='old-version');assert.equal(error.code,'INCOMPATIBLE_PROTOCOL');
  const present=await observer.request({type:'join',name:'Bia',room:'geral'});assert.equal(present.room.id,'geral');
  const snapshot=await observer.next('presence',e=>e.members.some(m=>m.id===a.id));assert.equal(snapshot.members.find(m=>m.id===a.id).inCall,false);
  const next=await a.request({type:'call-join'});assert.equal(next.inCall,true);assert.equal(next.generation,1);
});
