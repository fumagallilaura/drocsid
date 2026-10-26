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
    receive(event){this.onmessage?.({data:JSON.stringify({v:2,...event})});}
    send(bytes){const e=JSON.parse(bytes);this.sent.push(e);backend?.(this,e);}
    close(){this.readyState=3;this.onclose?.();}
  }
  const session=new Session({fetch:fetcher|| (async()=>({ok:true,json:async()=>({protocolVersion:2,iceServers:[],maxCallMembers:6,version:'0.1.1'})})),WebSocket:Socket,clock,onState:s=>snapshots.push(s),onError:e=>errors.push(e)});
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
  const config={ok:true,json:async()=>({protocolVersion:2,iceServers:[],maxCallMembers:6})};
  const f=fixture(()=>++requests===1?response:Promise.resolve(config));
  const old=f.session.connect({name:'Antiga',server:'http://old.example'});
  await f.connect('http://new.example');release(config);await old;
  assert.equal(f.sockets.length,1);assert.equal(f.session.state.session.server,'http://new.example');
  const stale=f.sockets[0].onmessage;await f.connect('http://third.example');
  stale({data:JSON.stringify({v:2,type:'hello',id:'wrong',rooms:[room('geral')]})});
  assert.equal(f.session.state.session.server,'http://third.example');assert.equal(f.session.state.session.id,'me');f.session.disconnect();
});

test('STAB-17/20/39: room transition blocks sending and preserves separate drafts',async()=>{
  const f=fixture(), ws=await f.connect();f.session.setDraft('rascunho A');let joining;
  f.setBackend((socket,e)=>{if(e.type==='join')joining=e;else if(e.type==='message')socket.receive({type:'message-accepted',requestId:e.requestId,message:persisted(e)});});
  const changed=f.session.changeRoom('cafe');assert.equal(f.session.state.room.id,'geral');assert.equal(f.session.state.roomPending,true);
  await assert.rejects(f.session.sendText(),e=>e.code==='INVALID_EVENT');assert.equal(ws.sent.some(e=>e.type==='message'),false);
  ws.receive({type:'joined',requestId:joining.requestId,room:room('cafe'),messages:[]});await changed;
  f.session.setDraft('rascunho B');const back=f.session.changeRoom('geral');ws.receive({type:'joined',requestId:joining.requestId,room:room('geral'),messages:[]});await back;
  assert.equal(f.session.state.draft,'rascunho A');
  ws.receive({type:'presence',context:f.session.roomContext,room:'geral',revision:1,members:[{id:'peer',name:'Bia',inCall:false,muted:true,sharing:false,callId:null,generation:0}]});
  ws.receive({type:'presence',context:'obsolete-room',room:'geral',revision:1,members:[]});assert.equal(f.session.state.members[0].id,'peer');f.session.disconnect();
});

test('STAB-18/21/22/23: rejected text is recoverable and retry reconciles one persisted message',async()=>{
  const f=fixture(), ws=await f.connect();let first;
  f.setBackend((socket,e)=>{if(e.type==='message'){first=e;socket.receive({type:'error',requestId:e.requestId,code:'RATE_LIMITED',phase:'message',message:'Tente novamente'});}});
  f.session.setDraft('  texto integral  ');await assert.rejects(f.session.sendText(),e=>e.code==='RATE_LIMITED');
  assert.equal(f.session.state.outbox.length,1);
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

test('MEDIA-05/06/28: v2 client rejects v1 config before opening WS or acquiring media',async()=>{
  const f=fixture(async()=>({ok:true,json:async()=>({protocolVersion:1,iceServers:[],maxCallMembers:6})}));
  await assert.rejects(()=>f.session.connect({name:'Ana',server:'http://localhost:4310'}),e=>e.code==='INCOMPATIBLE_PROTOCOL');
  assert.equal(f.sockets.length,0);assert.equal(f.session.state.connected,false);
  let captures=0;
  const call=new Call({id:'me',send:e=>f.session.request(e),nextCallGeneration:()=>f.session.nextCallGeneration(f.session.epoch),
    mediaDevices:{getUserMedia:async()=>{captures++;throw Error();}},onMedia(){},onStreams(){},onError(){}});
  await assert.rejects(()=>call.join(),e=>e.code==='CANCELLED');assert.equal(captures,0);
});

test('MEDIA-17/28: an old screen-stop deadline cannot disconnect a newer confirmed share in the same call',async()=>{
  const f=fixture(),ws=await f.connect();f.setBackend(()=>{});
  const call={callId:'current',generation:1};
  const joining=f.session.request({type:'call-join',...call,muted:false});ws.receive(callAck(ws.sent.at(-1)));await joining;
  const stopping=f.session.request({type:'media',...call,sharing:false}),expired=assert.rejects(stopping,e=>e.code==='TIMEOUT');
  const starting=f.session.request({type:'media',...call,sharing:true});
  ws.receive(callAck(ws.sent.at(-1),{sharing:true}));await starting;
  f.clock.tick(8000);await expired;
  assert.equal(f.session.state.connected,true);assert.equal(ws.readyState,1);assert.equal(f.session.activeCallId,call.callId);assert.deepEqual(f.errors,[]);f.session.disconnect();
});

test('MEDIA-17/26: the current screen-stop deadline still terminates an unresponsive transport after unrelated mute',async()=>{
  const f=fixture(),ws=await f.connect();f.setBackend(()=>{});
  const call={callId:'current',generation:1};
  const stopping=f.session.request({type:'media',...call,sharing:false}),expired=assert.rejects(stopping,e=>e.code==='TIMEOUT'&&e.phase==='media');
  const muted=f.session.request({type:'media',...call,muted:true});ws.receive(callAck(ws.sent.at(-1)));await muted;
  f.clock.tick(7999);assert.equal(f.session.state.connected,true);
  f.clock.tick(1);await expired;assert.equal(f.session.state.connected,false);assert.equal(ws.readyState,3);
});

test('MEDIA-28: signaling addressed to a terminal local attempt never reaches the new Call owner',async()=>{
  const f=fixture(),ws=await f.connect(),signals=[];f.session.onSignal=event=>signals.push(event);f.setBackend(()=>{});
  const old=f.session.request({type:'call-join',callId:'old',generation:1,muted:true});ws.receive(callAck(ws.sent.at(-1)));await old;
  const left=f.session.request({type:'call-leave',callId:'old',generation:1});ws.receive(callAck(ws.sent.at(-1)));await left;
  const current=f.session.request({type:'call-join',callId:'new',generation:2,muted:false});ws.receive(callAck(ws.sent.at(-1)));await current;
  const event={type:'signal',context:f.session.roomContext,from:'peer',fromCallId:'remote',signal:{candidate:{candidate:'candidate'}}};
  ws.receive({...event,callId:'old'});assert.deepEqual(signals,[]);assert.equal(f.session.activeCallId,'new');assert.equal(f.session.state.connected,true);
  ws.receive({...event,callId:'new'});assert.equal(signals.length,1);assert.equal(signals[0].callId,'new');f.session.disconnect();
});

test('STAB-18/20/22: a transport refusal preserves full text and both room drafts across reconnect',async()=>{
  const f=fixture(),ws=await f.connect(),send=ws.send.bind(ws),text='  envio não aceito integral  ';
  ws.send=bytes=>{if(JSON.parse(bytes).type==='message')throw Error('transport refused');return send(bytes);};
  f.session.setDraft(text);await assert.rejects(()=>f.session.sendText(),error=>error.code==='CONNECTION_FAILED');
  assert.equal(f.session.state.messages.length,0);assert.equal(f.session.state.outbox.length,1);
  const failed=f.session.state.outbox[0];assert.equal(failed.text,text);assert.equal(failed.room,'geral');assert.equal(failed.status,'failed');
  f.session.setDraft('rascunho geral');await f.session.changeRoom('cafe');f.session.setDraft('rascunho café');f.session.disconnect();
  await f.connect(undefined,'cafe');assert.equal(f.session.state.draft,'rascunho café');assert.equal(f.session.state.outbox.length,0);
  await f.session.changeRoom('geral');assert.equal(f.session.state.draft,'rascunho geral');assert.equal(f.session.state.outbox.length,1);
  assert.equal(f.session.state.outbox[0].operationId,failed.operationId);assert.equal(f.session.state.outbox[0].text,text);assert.equal(f.session.state.outbox[0].status,'failed');f.session.disconnect();
});

test('STAB-18/20/21/23/39: a late receipt reconciles its original room without changing the new composition',async()=>{
  const f=fixture(),ws=await f.connect(),oldContext=f.session.roomContext;let sent,committed;
  f.setBackend((socket,event)=>{
    if(event.type==='message')sent=event;
    if(event.type==='join')socket.receive({type:'joined',requestId:event.requestId,room:room(event.room),messages:event.room==='geral'&&committed?[committed]:[]});
  });
  const sending=f.session.sendText('  destino fixo  ');assert.equal(f.session.state.outbox.length,1);
  await f.session.changeRoom('cafe');f.session.setDraft('composição nova');
  committed=persisted(sent);ws.receive({type:'message-accepted',requestId:sent.requestId,message:committed});assert.deepEqual(await sending,committed);
  assert.equal(f.session.state.room.id,'cafe');assert.equal(f.session.state.draft,'composição nova');assert.deepEqual(f.session.state.messages,[]);assert.deepEqual(f.session.state.outbox,[]);
  await f.session.changeRoom('geral');assert.deepEqual(f.session.state.messages,[committed]);assert.deepEqual(f.session.state.outbox,[]);
  ws.receive({type:'message',context:oldContext,message:committed});assert.deepEqual(f.session.state.messages,[committed]);assert.deepEqual(f.errors,[]);f.session.disconnect();
});

test('STAB-38: every A1 phase ends at 8s and permits a manual retry',async()=>{
  for(const phase of ['configuration','websocket','hello','join','call-join','message']){
    const f=fixture(),fetcher=f.session.fetcher;
    const confirm=(socket,event)=>{
      if(event.type==='join')socket.receive({type:'joined',requestId:event.requestId,room:room(event.room),messages:[]});
      else if(event.type==='call-join')socket.receive(callAck(event));
      else if(event.type==='message')socket.receive({type:'message-accepted',requestId:event.requestId,message:persisted(event)});
    };
    let pending;
    if(['configuration','websocket','hello'].includes(phase)){
      if(phase==='configuration')f.session.fetcher=()=>new Promise(()=>{});
      pending=f.session.connect({name:'Ana',server:'http://localhost:4310'});await drain();
      if(phase==='hello')f.sockets.at(-1).open();
    }else{
      await f.connect();f.setBackend(()=>{});
      if(phase==='join')pending=f.session.changeRoom('cafe');
      else if(phase==='call-join')pending=f.session.request({type:'call-join',callId:'timed-out',generation:1,muted:true});
      else pending=f.session.sendText('texto aguardando recibo');
    }
    let settled=false,cause;pending.then(()=>{settled=true;},error=>{settled=true;cause=error;});
    f.clock.tick(7999);await new Promise(setImmediate);assert.equal(settled,false,phase);
    f.clock.tick(1);await new Promise(setImmediate);assert.equal(settled,true,phase);assert.equal(cause.code,'TIMEOUT');assert.equal(cause.phase,phase);
    f.session.fetcher=fetcher;f.setBackend(confirm);
    if(['configuration','websocket','hello'].includes(phase)){await f.connect();assert.equal(f.session.state.connected,true);}
    else if(phase==='join'){await f.session.changeRoom('cafe');assert.equal(f.session.state.room.id,'cafe');}
    else if(phase==='call-join')assert.equal((await f.session.request({type:'call-join',callId:'retry',generation:2,muted:true})).inCall,true);
    else{assert.equal(f.session.state.outbox.length,1);await f.session.retry(f.session.state.outbox[0].operationId);assert.equal(f.session.state.messages[0].text,'texto aguardando recibo');}
    f.session.disconnect();assert.equal(f.clock.jobs.size,0);
  }
});
