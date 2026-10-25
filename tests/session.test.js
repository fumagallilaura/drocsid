import test from 'node:test';
import assert from 'node:assert/strict';
import { Session, parseInvite } from '../src/session.js';
import { createService } from '../server/service.js';
import { Call } from '../src/rtc.js';

const drain=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
const room=id=>({id,name:id,description:''});
const persisted=(e,id='message-1')=>({id,room:e.room,text:e.text.trim(),operationId:e.operationId,author:'Ana',authorId:'me',created:1,sequence:1});
class Clock {
  time=0; id=0; jobs=new Map();
  setTimeout=(fn,ms)=>{const id=++this.id;this.jobs.set(id,{at:this.time+ms,fn});return id;};
  clearTimeout=id=>this.jobs.delete(id);
  tick(ms){this.time+=ms;for(const [id,j] of [...this.jobs])if(j.at<=this.time){this.jobs.delete(id);j.fn();}}
}
function fixture(fetcher) {
  const sockets=[], errors=[], snapshots=[], clock=new Clock(); let backend;
  class Socket {
    readyState=0; sent=[];
    constructor(url){this.url=url;sockets.push(this);}
    open(){this.readyState=1;this.onopen?.();}
    receive(event){this.onmessage?.({data:JSON.stringify({v:1,...event})});}
    send(bytes){const e=JSON.parse(bytes);this.sent.push(e);backend?.(this,e);}
    close(){this.readyState=3;this.onclose?.();}
  }
  const session=new Session({fetch:fetcher|| (async()=>({ok:true,json:async()=>({protocolVersion:1,iceServers:[],maxCallMembers:6,version:'0.1.1'})})),WebSocket:Socket,clock,onState:s=>snapshots.push(s),onError:e=>errors.push(e)});
  backend=(ws,e)=>{if(e.type==='join')ws.receive({type:'joined',requestId:e.requestId,room:room(e.room),messages:[]});};
  const connect=async(server='http://localhost:4310',requestedRoom)=>{
    const operation=session.connect({name:'Ana',server,room:requestedRoom});await drain();const ws=sockets.at(-1);ws.open();ws.receive({type:'hello',id:'me',rooms:['geral','cafe','projetos'].map(room)});await operation;return ws;
  };
  return {session,sockets,errors,snapshots,clock,connect,setBackend:fn=>{backend=fn;}};
}

test('STAB-38: opening WS does not cancel the hello deadline; next attempt can succeed',async()=>{
  const f=fixture(), pending=f.session.connect({name:'Ana',server:'http://localhost:4310'});
  const rejected=assert.rejects(pending,e=>e.code==='TIMEOUT');await drain();f.sockets[0].open();f.clock.tick(8000);await rejected;
  assert.equal(f.session.state.connecting,false);assert.equal(f.sockets[0].readyState,3);
  await f.connect();assert.equal(f.session.state.connected,true);f.session.disconnect();
});

test('STAB-39: old fetch/socket callbacks cannot overwrite a newer connection',async()=>{
  let release;const response=new Promise(resolve=>{release=resolve;});let requests=0;
  const config={ok:true,json:async()=>({protocolVersion:1,iceServers:[],maxCallMembers:6})};
  const f=fixture(()=>++requests===1?response:Promise.resolve(config));
  const old=f.session.connect({name:'Antiga',server:'http://old.example'});
  await f.connect('http://new.example');release(config);await old;
  assert.equal(f.sockets.length,1);assert.equal(f.session.state.session.server,'http://new.example');
  const stale=f.sockets[0].onmessage;await f.connect('http://third.example');
  stale({data:JSON.stringify({v:1,type:'hello',id:'wrong',rooms:[room('geral')]})});
  assert.equal(f.session.state.session.server,'http://third.example');assert.equal(f.session.state.session.id,'me');f.session.disconnect();
});

test('STAB-17/20/39: room transition blocks sending and preserves separate drafts',async()=>{
  const f=fixture(), ws=await f.connect();f.session.setDraft('rascunho A');let joining;
  f.setBackend((_ws,e)=>{if(e.type==='join')joining=e;});
  const changed=f.session.changeRoom('cafe');assert.equal(f.session.state.room.id,'geral');assert.equal(f.session.state.roomPending,true);
  await assert.rejects(f.session.sendText(),e=>e.code==='INVALID_EVENT');assert.equal(ws.sent.some(e=>e.type==='message'),false);
  ws.receive({type:'joined',requestId:joining.requestId,room:room('cafe'),messages:[]});await changed;
  f.session.setDraft('rascunho B');const back=f.session.changeRoom('geral');ws.receive({type:'joined',requestId:joining.requestId,room:room('geral'),messages:[]});await back;
  assert.equal(f.session.state.draft,'rascunho A');
  ws.receive({type:'presence',context:f.session.roomContext,room:'geral',members:[{id:'peer',name:'Bia',inCall:false,muted:true,sharing:false,callId:null,generation:0}]});
  ws.receive({type:'presence',context:'obsolete-room',room:'geral',members:[]});assert.equal(f.session.state.members[0].id,'peer');f.session.disconnect();
});

test('STAB-18/21/22/23: rejected text is recoverable and retry reconciles one persisted message',async()=>{
  const f=fixture(), ws=await f.connect();let first;
  f.setBackend((socket,e)=>{if(e.type==='message'){first=e;socket.receive({type:'error',requestId:e.requestId,code:'RATE_LIMITED',phase:'message',message:'Tente novamente'});}});
  f.session.setDraft('  texto integral  ');await assert.rejects(f.session.sendText(),e=>e.code==='RATE_LIMITED');
  const failed=f.session.state.outbox[0];assert.equal(failed.text,'  texto integral  ');assert.equal(failed.room,'geral');assert.equal(failed.status,'failed');
  f.setBackend((socket,e)=>{if(e.type==='message'){assert.equal(e.operationId,first.operationId);socket.receive({type:'message-accepted',requestId:e.requestId,message:persisted(e)});socket.receive({type:'message',context:f.session.roomContext,message:persisted(e)});}});
  await f.session.retry(failed.operationId);assert.equal(f.session.state.messages.length,1);assert.equal(f.session.state.outbox.length,0);
  assert.equal(f.session.state.messages[0].room,'geral');f.session.disconnect();
});

test('STAB-20/22: connection loss preserves pending text across manual reconnect',async()=>{
  const f=fixture(), ws=await f.connect();f.setBackend(()=>{});f.session.setDraft('guardar');
  const sending=f.session.sendText(), rejected=assert.rejects(sending);ws.close();await rejected;
  assert.equal(f.session.state.outbox[0].text,'guardar');const operationId=f.session.state.outbox[0].operationId;
  f.setBackend((socket,e)=>{if(e.type==='join')socket.receive({type:'joined',requestId:e.requestId,room:room(e.room),messages:[]});});
  await f.connect();assert.equal(f.session.state.outbox[0].operationId,operationId);assert.equal(f.session.state.outbox[0].status,'failed');f.session.disconnect();
});

test('STAB-40/41: invalid server shape terminates connection without rendering invalid data',async()=>{
  const f=fixture(), ws=await f.connect();ws.receive({type:'rooms',rooms:[null]});
  assert.equal(f.session.state.connected,false);assert.deepEqual(f.session.state.rooms.map(r=>r.id),['geral','cafe','projetos']);
  assert.equal(f.errors.at(-1).code,'INVALID_EVENT');
});

test('STAB-46/47: pasted invite preserves room and invalid destinations never silently fall back',async()=>{
  assert.deepEqual(parseInvite('http://localhost:4310/?room=cafe','http://local'),{server:'http://localhost:4310',room:'cafe'});
  for(const value of ['file:///tmp','http://user:password@localhost','ftp://example.com','http://localhost/?room='])assert.throws(()=>parseInvite(value,'http://local'),e=>e.code==='INVALID_INPUT');
  const f=fixture();await f.connect('http://localhost:4310/?room=cafe');assert.equal(f.session.state.room.id,'cafe');f.session.disconnect();
  const pending=f.session.connect({name:'Ana',server:'http://localhost:4310/?room=missing'}), rejected=assert.rejects(pending,e=>e.code==='INVALID_INPUT');
  await drain();const ws=f.sockets.at(-1);ws.open();ws.receive({type:'hello',id:'me',rooms:[room('geral')]});await rejected;
  assert.equal(ws.sent.length,0);
});

test('STAB-18/21/39: real client/server contract keeps the first presence and the committed destination',async t=>{
  const service=createService({dbPath:':memory:',iceServers:[]});await new Promise(resolve=>service.server.listen(0,'127.0.0.1',resolve));
  const session=new Session();t.after(async()=>{session.disconnect();await service.close();});
  await session.connect({name:'Ana',server:`http://127.0.0.1:${service.server.address().port}`});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(session.state.members[0].name,'Ana');
  session.setDraft('entrega real');const message=await session.sendText();assert.equal(message.room,'geral');assert.equal(session.state.messages.length,1);
  await session.changeRoom('cafe');assert.equal(session.state.room.id,'cafe');assert.equal(session.state.messages.length,0);
});

test('STAB-22/23: lost confirmation retains text until committed history reconciles it',async()=>{
  const f=fixture(), ws=await f.connect();f.setBackend(()=>{});f.session.setDraft('confirmação perdida');
  const sending=f.session.sendText(), rejected=assert.rejects(sending,e=>e.code==='TIMEOUT'&&e.phase==='message');
  const sent=ws.sent.at(-1);f.clock.tick(8000);await rejected;assert.equal(f.session.state.outbox[0].text,'confirmação perdida');
  f.setBackend((socket,e)=>{if(e.type==='join')socket.receive({type:'joined',requestId:e.requestId,room:room(e.room),messages:[persisted(sent)]});});
  await f.connect();assert.equal(f.session.state.messages.length,1);assert.equal(f.session.state.outbox.length,0);f.session.disconnect();
});

const callAck=(event,extra={})=>({type:'ack',requestId:event.requestId,action:event.type,callId:event.callId,generation:event.generation,inCall:event.type!=='call-leave',muted:true,sharing:false,...extra});
test('MEDIA-24/28/31: cancelling a pending call rejects it immediately and consumes late ack/error without touching the new one',async()=>{
  const f=fixture(),ws=await f.connect(); f.setBackend(()=>{});
  const first={type:'call-join',callId:'old',generation:1,muted:true};
  const old=f.session.request(first), cancelled=assert.rejects(old,e=>e.code==='CANCELLED'&&e.callId==='old'&&e.generation===1);
  const oldEvent=ws.sent.at(-1), leaving=f.session.request({type:'call-leave',callId:'old',generation:1}), leftEvent=ws.sent.at(-1);
  await cancelled;
  const joining=f.session.request({type:'call-join',callId:'new',generation:2,muted:true}), current=ws.sent.at(-1);
  ws.receive(callAck(oldEvent));ws.receive({type:'error',requestId:oldEvent.requestId,phase:'call-join',code:'CALL_FULL',message:'erro antigo'});
  ws.receive(callAck(leftEvent));await leaving;
  ws.receive(callAck(current));assert.equal((await joining).callId,'new');
  assert.equal(f.session.activeCallId,'new');assert.deepEqual(f.errors,[]);f.session.disconnect();
});

test('MEDIA-05/28: ack action, callId and generation must match the pending operation',async()=>{
  for(const mismatch of [{action:'media'},{callId:'other'},{generation:2}]) {
    const f=fixture(),ws=await f.connect();f.setBackend(()=>{});
    const joined=f.session.request({type:'call-join',callId:'current',generation:1,muted:true});
    const rejected=assert.rejects(joined,e=>e.code==='INVALID_EVENT');
    ws.receive(callAck(ws.sent.at(-1),mismatch));await rejected;
    assert.equal(f.session.state.connected,false);assert.equal(f.errors.at(-1).code,'INVALID_EVENT');f.session.disconnect();
  }
});

test('MEDIA-28: presence applies only increasing revisions in the current room context',async()=>{
  const f=fixture(),ws=await f.connect();
  const presence=(revision,sharing,context=f.session.roomContext)=>({type:'presence',room:'geral',context,revision,members:[{id:'peer',name:'Bia',inCall:true,muted:false,sharing,callId:'peer-call',generation:1}]});
  ws.receive(presence(2,false));ws.receive(presence(1,true));ws.receive(presence(2,true));
  assert.equal(f.session.state.members[0].sharing,false);
  const obsolete=f.session.roomContext;await f.session.changeRoom('cafe');await f.session.changeRoom('geral');
  ws.receive(presence(1,true));assert.equal(f.session.state.members[0].sharing,true);
  ws.receive(presence(999,false,obsolete));assert.equal(f.session.state.members[0].sharing,true);
  await f.connect();const next=ws===f.sockets.at(-1)?ws:f.sockets.at(-1);
  next.receive(presence(1,false));assert.equal(f.session.state.members[0].sharing,false);f.session.disconnect();
});

test('MEDIA-05/24/28: successive Call owners share a Session generation and stale epochs fail before acquisition',async t=>{
  const service=createService({dbPath:':memory:',iceServers:[]});await new Promise(resolve=>service.server.listen(0,'127.0.0.1',resolve));
  const session=new Session(), server=`http://127.0.0.1:${service.server.address().port}`;
  t.after(async()=>{session.disconnect();await service.close();});await session.connect({name:'Ana',server});
  const epoch=session.epoch,allocate=()=>session.nextCallGeneration(epoch);let acquisitions=0;
  const make=()=>new Call({id:session.state.session.id,iceServers:[],send:event=>session.request(event),nextCallGeneration:allocate,
    mediaDevices:{getUserMedia:async()=>{acquisitions++;throw Error('no microphone');}},onMedia(){},onStreams(){},onError(){}});
  const first=make();await first.join();const generation=first.generation,callId=first.callId;await first.leave();first.close();
  const second=make();await second.join();assert.equal(second.generation,generation+1);assert.notEqual(second.callId,callId);assert.equal(second.admitted,true);
  const oldExit=await session.request({type:'call-leave',callId,generation});assert.equal(oldExit.inCall,false);assert.equal(session.activeCallId,second.callId);
  await second.leave();second.close();session.disconnect();await session.connect({name:'Ana',server});
  const stale=make();await assert.rejects(()=>stale.join(),e=>e.code==='CANCELLED');assert.equal(acquisitions,2);assert.equal(session.nextCallGeneration(session.epoch),1);
});

test('MEDIA-21/26/31: terminal timeout closes transport after local resources have already ended',async()=>{
  const f=fixture();await f.connect();f.setBackend(()=>{});
  const leaving=f.session.request({type:'call-leave',callId:'ended',generation:1}), rejected=assert.rejects(leaving,e=>e.code==='TIMEOUT'&&e.phase==='call-leave');
  f.clock.tick(7999);assert.equal(f.session.state.connected,true);
  f.clock.tick(1);await rejected;assert.equal(f.session.state.connected,false);assert.equal(f.sockets[0].readyState,3);
});

test('MEDIA-28: an old terminal deadline cannot disconnect a newer admitted attempt',async()=>{
  const f=fixture(),ws=await f.connect();f.setBackend(()=>{});
  const leaving=f.session.request({type:'call-leave',callId:'old',generation:1}), expired=assert.rejects(leaving,e=>e.code==='TIMEOUT');
  const joined=f.session.request({type:'call-join',callId:'new',generation:2,muted:true});
  ws.receive(callAck(ws.sent.at(-1)));await joined;f.clock.tick(8000);await expired;
  assert.equal(f.session.state.connected,true);assert.equal(f.session.activeCallId,'new');assert.deepEqual(f.errors,[]);f.session.disconnect();
});
