import test from 'node:test';
import assert from 'node:assert/strict';
import { Session, parseInvite } from '../src/session.js';
import { startService,testPort } from './helpers/service.js';
import { Call } from '../src/rtc.js';
import {parseClientEvent} from '../shared/protocol.js';
import type {ProtocolError} from '../shared/protocol.js';
import type {ClientAction,ClientEvent,Message,ServerEvent} from '../shared/protocol.js';
import type {SessionState} from '../src/session.js';
import {required,isRecord} from './helpers/assertions.js';
type Options=NonNullable<ConstructorParameters<typeof Session>[0]>;
type Fetcher=NonNullable<Options['fetch']>;
type MessageAction=Extract<ClientEvent,{type:'message'}>;
type JoinAction=Extract<ClientEvent,{type:'join'}>;

const drain=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
const room=(id:string)=>({id,name:id,description:''});
const persisted=(e:Pick<MessageAction,'room'|'text'|'operationId'>,id='message-1')=>({id,room:e.room,text:e.text.trim(),operationId:e.operationId,author:'Ana',authorId:'me',created:1,sequence:1});
class Clock {
  time=0; id=0; jobs=new Map<number,{at:number;fn():void}>();
  setTimeout=(fn:()=>void,ms:number)=>{const id=++this.id;this.jobs.set(id,{at:this.time+ms,fn});return id;};
  clearTimeout=(id:unknown)=>{if(typeof id==='number')this.jobs.delete(id);};
  tick(ms:number){this.time+=ms;for(const [id,j] of [...this.jobs])if(j.at<=this.time){this.jobs.delete(id);j.fn();}}
}
function fixture(fetcher?:Fetcher) {
  type Backend=(socket:Socket,event:ClientEvent)=>void;
  const sockets:Socket[]=[], errors:ProtocolError[]=[], snapshots:SessionState[]=[], clock=new Clock(); let backend:Backend|undefined;
  class Socket {
    readyState=0; sent:ClientEvent[]=[];url:string;
    onopen:(()=>void)|null=null;onclose:(()=>void)|null=null;onerror:(()=>void)|null=null;onmessage:((event:{data:unknown})=>void)|null=null;
    constructor(url:string){this.url=url;sockets.push(this);}
    open(){this.readyState=1;this.onopen?.();}
    receive(event:Record<string,unknown>){this.onmessage?.({data:JSON.stringify({v:2,...event})});}
    send(bytes:string){const e=parseClientEvent(bytes);this.sent.push(e);backend?.(this,e);}
    close(){this.readyState=3;this.onclose?.();}
  }
  const session=new Session({fetch:fetcher|| (async()=>({ok:true,json:async()=>({protocolVersion:2,iceServers:[],maxCallMembers:6,version:'0.1.1'})})),WebSocket:Socket,clock,onState:s=>snapshots.push(s),onError:e=>errors.push(e)});
  backend=(ws,e)=>{if(e.type==='join')ws.receive({type:'joined',requestId:e.requestId,room:room(e.room),messages:[]});};
  const connect=async(server='http://localhost:4310',requestedRoom?:string)=>{
    const operation=session.connect({name:'Ana',server,room:requestedRoom});await drain();const ws=required(sockets.at(-1));ws.open();ws.receive({type:'hello',id:'me',rooms:['geral','cafe','projetos'].map(room)});await operation;return ws;
  };
  return {session,sockets,errors,snapshots,clock,connect,setBackend:(fn:Backend)=>{backend=fn;}};
}

test('MERGE-08/13: an authenticated Session uses one-use tickets and clears another accounts context',async t=>{
  const s=await startService(t,{trustedLocal:false}),password='uma senha longa e exclusiva';
  const a=await s.identity.register('ana',password,'register-a'),b=await s.identity.register('bia',password,'register-b');
  const ga=await s.identity.createGroup(a.user.id,'Equipe A'),gb=await s.identity.createGroup(b.user.id,'Equipe B');
  const session=new Session();t.after(()=>session.disconnect());
  await assert.doesNotReject(session.connect({server:s.origin,token:a.token}));assert.equal(required(session.state.session).name,'ana');assert.equal(required(session.state.room).id,ga.rooms[0].id);
  const socket=required(session.ws);assert.ok('url' in socket&&typeof socket.url==='string');
  assert.equal(socket.url.includes(a.token),false);assert.match(required(new URL(socket.url).searchParams.get('ticket')),/^[A-Za-z0-9_-]{43}$/);
  const request=session.request.bind(session);session.request=():Promise<never>=>Promise.reject(Object.assign(Error('Falha'),{code:'RATE_LIMITED'}));
  await assert.rejects(session.sendText('Texto privado A'),error=>isRecord(error)&&error.code==='RATE_LIMITED');session.request=request;session.setDraft('Rascunho privado A');
  assert.equal(session.state.outbox.length,1);
  await session.connect({server:s.origin,token:b.token});assert.equal(required(session.state.session).name,'bia');assert.equal(required(session.state.room).id,gb.rooms[0].id);
  assert.equal(session.state.draft,'');assert.deepEqual(session.state.outbox,[]);assert.deepEqual(session.state.messages,[]);assert.equal(session.drafts.size,0);assert.equal(session.outbox.size,0);
  await session.logout();assert.equal(session.state.connected,false);assert.equal(session.state.session,null);assert.equal(session.accessToken,null);
  const denied=await fetch(s.origin+'/api/config',{headers:{Authorization:`Bearer ${b.token}`}});assert.equal(denied.status,401);
});

test('MERGE-08/13: an empty account can connect while an explicit inaccessible room never falls back',async t=>{
  const s=await startService(t,{trustedLocal:false}),a=await s.identity.register('ana','uma senha longa e exclusiva','ip');
  const session=new Session();t.after(()=>session.disconnect());
  await session.connect({server:s.origin,token:a.token});assert.equal(session.state.connected,true);assert.equal(session.state.room,null);assert.deepEqual(session.state.rooms,[]);
  session.disconnect();
  await assert.rejects(session.connect({server:s.origin+'/?room=geral',token:a.token}),error=>isRecord(error)&&error.code==='INVALID_INPUT');assert.equal(session.state.connected,false);assert.equal(session.state.room,null);
  await assert.rejects(session.connect({server:s.origin,token:'a'.repeat(43)}),error=>isRecord(error)&&error.code==='UNAUTHENTICATED');assert.equal(session.state.connected,false);
});

test('MERGE-08: authentication and ticket phases keep their eight-second deadlines',async()=>{
  for(const phase of ['authentication','ticket']){
    const f=fixture(async url=>{
      if(url.endsWith('/api/me'))return phase==='authentication'?new Promise(()=>{}):{ok:true,json:async()=>({user:{id:'account',username:'ana'}})};
      if(url.endsWith('/api/ws-ticket'))return new Promise(()=>{});
      return {ok:true,json:async()=>({protocolVersion:2,iceServers:[],maxCallMembers:6})};
    });
    const pending=f.session.connect({server:'http://localhost:4310',token:'a'.repeat(43)}),rejected=assert.rejects(pending,error=>isRecord(error)&&error.code==='TIMEOUT'&&error.phase===phase);await drain();
    f.clock.tick(7999);await drain();assert.equal(f.session.state.connecting,true);f.clock.tick(1);await rejected;assert.equal(f.sockets.length,0);assert.equal(f.session.state.connected,false);assert.equal(f.clock.jobs.size,0);
  }
});

test('STAB-38: opening WS does not cancel the hello deadline; next attempt can succeed',async()=>{
  const f=fixture(), pending=f.session.connect({name:'Ana',server:'http://localhost:4310'});
  const rejected=assert.rejects(pending,e=>isRecord(e)&&e.code==='TIMEOUT');await drain();f.sockets[0].open();f.clock.tick(8000);await rejected;
  assert.equal(f.session.state.connecting,false);assert.equal(f.sockets[0].readyState,3);
  await f.connect();assert.equal(f.session.state.connected,true);f.session.disconnect();
});

test('STAB-39: old fetch/socket callbacks cannot overwrite a newer connection',async()=>{
  const {promise:response,resolve:release}=Promise.withResolvers<Awaited<ReturnType<Fetcher>>>();let requests=0;
  const config={ok:true,json:async()=>({protocolVersion:2,iceServers:[],maxCallMembers:6})};
  const f=fixture(()=>++requests===1?response:Promise.resolve(config));
  const old=f.session.connect({name:'Antiga',server:'http://old.example'});
  await f.connect('http://new.example');release(config);await old;
  assert.equal(f.sockets.length,1);assert.equal(required(f.session.state.session).server,'http://new.example');
  const stale=f.sockets[0].onmessage;await f.connect('http://third.example');
  required(stale)({data:JSON.stringify({v:2,type:'hello',id:'wrong',rooms:[room('geral')]})});
  required(stale)({data:JSON.stringify({v:1,type:'hello'})});
  assert.equal(required(f.session.state.session).server,'http://third.example');assert.equal(required(f.session.state.session).id,'me');
  assert.equal(f.session.state.connected,true);assert.deepEqual(f.errors,[]);f.session.disconnect();
});

test('STAB-17/20/39: room transition blocks sending and preserves separate drafts',async()=>{
  const f=fixture(), ws=await f.connect();f.session.setDraft('rascunho A');let joining:JoinAction|undefined;
  f.setBackend((socket,e)=>{if(e.type==='join')joining=e;else if(e.type==='message')socket.receive({type:'message-accepted',requestId:e.requestId,message:persisted(e)});});
  const changed=f.session.changeRoom('cafe');assert.equal(required(f.session.state.room).id,'geral');assert.equal(f.session.state.roomPending,true);
  await assert.rejects(f.session.sendText(),e=>isRecord(e)&&e.code==='INVALID_EVENT');assert.equal(ws.sent.some(e=>e.type==='message'),false);
  ws.receive({type:'joined',requestId:required(joining).requestId,room:room('cafe'),messages:[]});await changed;
  f.session.setDraft('rascunho B');const back=f.session.changeRoom('geral');ws.receive({type:'joined',requestId:required(joining).requestId,room:room('geral'),messages:[]});await back;
  assert.equal(f.session.state.draft,'rascunho A');
  ws.receive({type:'presence',context:f.session.roomContext,room:'geral',revision:1,members:[{id:'peer',name:'Bia',inCall:false,muted:true,sharing:false,callId:null,generation:0}]});
  ws.receive({type:'presence',context:'obsolete-room',room:'geral',revision:1,members:[]});assert.equal(f.session.state.members[0].id,'peer');f.session.disconnect();
});

test('STAB-18/21/22/23: rejected text is recoverable and retry reconciles one persisted message',async()=>{
  const f=fixture(), ws=await f.connect();let first:MessageAction|undefined;
  f.setBackend((socket,e)=>{if(e.type==='message'){first=e;socket.receive({type:'error',requestId:e.requestId,code:'RATE_LIMITED',phase:'message',message:'Tente novamente'});}});
  f.session.setDraft('  texto integral  ');await assert.rejects(f.session.sendText(),e=>isRecord(e)&&e.code==='RATE_LIMITED');
  assert.equal(f.session.state.outbox.length,1);
  const failed=f.session.state.outbox[0];assert.equal(failed.text,'  texto integral  ');assert.equal(failed.room,'geral');assert.equal(failed.status,'failed');
  f.setBackend((socket,e)=>{if(e.type==='message'){assert.equal(e.operationId,required(first).operationId);socket.receive({type:'message-accepted',requestId:e.requestId,message:persisted(e)});socket.receive({type:'message',context:f.session.roomContext,message:persisted(e)});}});
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
  assert.equal(required(f.errors.at(-1)).code,'INVALID_EVENT');
});

test('STAB-46/47: pasted invite preserves room and invalid destinations never silently fall back',async()=>{
  assert.deepEqual(parseInvite('http://localhost:4310/?room=cafe','http://local'),{server:'http://localhost:4310',room:'cafe'});
  for(const value of ['file:///tmp','http://user:password@localhost','ftp://example.com','http://localhost/?room='])assert.throws(()=>parseInvite(value,'http://local'),e=>isRecord(e)&&e.code==='INVALID_INPUT');
  const f=fixture();await f.connect('http://localhost:4310/?room=cafe');assert.equal(required(f.session.state.room).id,'cafe');f.session.disconnect();
  const pending=f.session.connect({name:'Ana',server:'http://localhost:4310/?room=missing'}), rejected=assert.rejects(pending,e=>isRecord(e)&&e.code==='INVALID_INPUT');
  await drain();const ws=required(f.sockets.at(-1));ws.open();ws.receive({type:'hello',id:'me',rooms:[room('geral')]});await rejected;
  assert.equal(ws.sent.length,0);
});

test('STAB-18/21/39: real client/server contract keeps the first presence and the committed destination',async t=>{
  const service=await startService(t);
  const session=new Session();t.after(async()=>{session.disconnect();await service.close();});
  await session.connect({name:'Ana',server:`http://127.0.0.1:${testPort(service.server)}`});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(session.state.members[0].name,'Ana');
  session.setDraft('entrega real');const message=await session.sendText();assert.equal(message.room,'geral');assert.equal(session.state.messages.length,1);
  await session.changeRoom('cafe');assert.equal(required(session.state.room).id,'cafe');assert.equal(session.state.messages.length,0);
});

test('STAB-22/23: lost confirmation retains text until committed history reconciles it',async()=>{
  const f=fixture(), ws=await f.connect();f.setBackend(()=>{});f.session.setDraft('confirmação perdida');
  const sending=f.session.sendText(), rejected=assert.rejects(sending,e=>isRecord(e)&&e.code==='TIMEOUT'&&e.phase==='message');
  const sent=required(ws.sent.at(-1));assert.ok(sent.type==='message');f.clock.tick(8000);await rejected;assert.equal(f.session.state.outbox[0].text,'confirmação perdida');
  f.setBackend((socket,e)=>{if(e.type==='join')socket.receive({type:'joined',requestId:e.requestId,room:room(e.room),messages:[persisted(sent)]});});
  await f.connect();assert.equal(f.session.state.messages.length,1);assert.equal(f.session.state.outbox.length,0);f.session.disconnect();
});

const callAck=(event:ClientEvent,extra:Record<string,unknown>={})=>({type:'ack',requestId:event.requestId,action:event.type,callId:event.callId,generation:event.generation,inCall:event.type!=='call-leave',muted:true,sharing:false,...extra});
test('MEDIA-24/28/31: cancelling a pending call rejects it immediately and consumes late ack/error without touching the new one',async()=>{
  const f=fixture(),ws=await f.connect(); f.setBackend(()=>{});
  const first:Extract<ClientAction,{type:'call-join'}>={type:'call-join',callId:'old',generation:1,muted:true};
  const old=f.session.request(first), cancelled=assert.rejects(old,e=>isRecord(e)&&e.code==='CANCELLED'&&e.callId==='old'&&e.generation===1);
  const oldEvent=required(ws.sent.at(-1)), leaving=f.session.request({type:'call-leave',callId:'old',generation:1}), leftEvent=required(ws.sent.at(-1));
  await cancelled;
  const joining=f.session.request({type:'call-join',callId:'new',generation:2,muted:true}), current=required(ws.sent.at(-1));
  ws.receive(callAck(oldEvent));ws.receive({type:'error',requestId:oldEvent.requestId,phase:'call-join',code:'CALL_FULL',message:'erro antigo'});
  ws.receive(callAck(leftEvent));await leaving;
  ws.receive(callAck(current));assert.equal(required(await joining).callId,'new');
  assert.equal(f.session.activeCallId,'new');assert.deepEqual(f.errors,[]);f.session.disconnect();
});

test('MEDIA-05/28: ack action, callId and generation must match the pending operation',async()=>{
  for(const mismatch of [{action:'media'},{callId:'other'},{generation:2}]) {
    const f=fixture(),ws=await f.connect();f.setBackend(()=>{});
    const joined=f.session.request({type:'call-join',callId:'current',generation:1,muted:true});
    const rejected=assert.rejects(joined,e=>isRecord(e)&&e.code==='INVALID_EVENT');
    ws.receive(callAck(required(ws.sent.at(-1)),mismatch));await rejected;
    assert.equal(f.session.state.connected,false);assert.equal(required(f.errors.at(-1)).code,'INVALID_EVENT');f.session.disconnect();
  }
});

test('MEDIA-28: presence applies only increasing revisions in the current room context',async()=>{
  const f=fixture(),ws=await f.connect();
  const presence=(revision:number,sharing:boolean,context=f.session.roomContext)=>({type:'presence',room:'geral',context,revision,members:[{id:'peer',name:'Bia',inCall:true,muted:false,sharing,callId:'peer-call',generation:1}]});
  ws.receive(presence(2,false));ws.receive(presence(1,true));ws.receive(presence(2,true));
  assert.equal(f.session.state.members[0].sharing,false);
  const obsolete=f.session.roomContext;await f.session.changeRoom('cafe');await f.session.changeRoom('geral');
  ws.receive(presence(1,true));assert.equal(f.session.state.members[0].sharing,true);
  ws.receive(presence(999,false,obsolete));assert.equal(f.session.state.members[0].sharing,true);
  await f.connect();const next=ws===required(f.sockets.at(-1))?ws:required(f.sockets.at(-1));
  next.receive(presence(1,false));assert.equal(f.session.state.members[0].sharing,false);f.session.disconnect();
});

test('MEDIA-05/24/28: successive Call owners share a Session generation and stale epochs fail before acquisition',async t=>{
  const service=await startService(t);
  const session=new Session(), server=`http://127.0.0.1:${testPort(service.server)}`;
  t.after(async()=>{session.disconnect();await service.close();});await session.connect({name:'Ana',server});
  const epoch=session.epoch,allocate=()=>session.nextCallGeneration(epoch);let acquisitions=0;
  const make=()=>new Call({id:required(session.state.session).id,iceServers:[],send:event=>session.request(event),nextCallGeneration:allocate,
    mediaDevices:{getUserMedia:async()=>{acquisitions++;throw Error('no microphone');}},onMedia(){},onStreams(){},onError(){}});
  const first=make();await first.join();const generation=first.generation,callId=required(first.callId);await first.leave();first.close();
  const second=make();await second.join();assert.equal(second.generation,generation+1);assert.notEqual(second.callId,callId);assert.equal(second.admitted,true);
  const oldExit=required(await session.request({type:'call-leave',callId,generation}));assert.equal(oldExit.inCall,false);assert.equal(session.activeCallId,second.callId);
  await second.leave();second.close();session.disconnect();await session.connect({name:'Ana',server});
  const stale=make();await assert.rejects(()=>stale.join(),e=>isRecord(e)&&e.code==='CANCELLED');assert.equal(acquisitions,2);assert.equal(session.nextCallGeneration(session.epoch),1);
});

test('MEDIA-21/26/31: terminal timeout closes transport after local resources have already ended',async()=>{
  const f=fixture();await f.connect();f.setBackend(()=>{});
  const leaving=f.session.request({type:'call-leave',callId:'ended',generation:1}), rejected=assert.rejects(leaving,e=>isRecord(e)&&e.code==='TIMEOUT'&&e.phase==='call-leave');
  f.clock.tick(7999);assert.equal(f.session.state.connected,true);
  f.clock.tick(1);await rejected;assert.equal(f.session.state.connected,false);assert.equal(f.sockets[0].readyState,3);
});

test('MEDIA-28: an old terminal deadline cannot disconnect a newer admitted attempt',async()=>{
  const f=fixture(),ws=await f.connect();f.setBackend(()=>{});
  const leaving=f.session.request({type:'call-leave',callId:'old',generation:1}), expired=assert.rejects(leaving,e=>isRecord(e)&&e.code==='TIMEOUT');
  const joined=f.session.request({type:'call-join',callId:'new',generation:2,muted:true});
  ws.receive(callAck(required(ws.sent.at(-1))));await joined;f.clock.tick(8000);await expired;
  assert.equal(f.session.state.connected,true);assert.equal(f.session.activeCallId,'new');assert.deepEqual(f.errors,[]);f.session.disconnect();
});

test('MEDIA-05/06/28: v2 client rejects v1 config before opening WS or acquiring media',async()=>{
  const f=fixture(async()=>({ok:true,json:async()=>({protocolVersion:1,iceServers:[],maxCallMembers:6})}));
  await assert.rejects(()=>f.session.connect({name:'Ana',server:'http://localhost:4310'}),e=>isRecord(e)&&e.code==='INCOMPATIBLE_PROTOCOL');
  assert.equal(f.sockets.length,0);assert.equal(f.session.state.connected,false);
  let captures=0;
  const call=new Call({id:'me',send:e=>f.session.request(e),nextCallGeneration:()=>f.session.nextCallGeneration(f.session.epoch),
    mediaDevices:{getUserMedia:async()=>{captures++;throw Error();}},onMedia(){},onStreams(){},onError(){}});
  await assert.rejects(()=>call.join(),e=>isRecord(e)&&e.code==='CANCELLED');assert.equal(captures,0);
});

test('MEDIA-17/28: an old screen-stop deadline cannot disconnect a newer confirmed share in the same call',async()=>{
  const f=fixture(),ws=await f.connect();f.setBackend(()=>{});
  const call={callId:'current',generation:1};
  const joining=f.session.request({type:'call-join',...call,muted:false});ws.receive(callAck(required(ws.sent.at(-1))));await joining;
  const stopping=f.session.request({type:'media',...call,sharing:false}),expired=assert.rejects(stopping,e=>isRecord(e)&&e.code==='TIMEOUT');
  const starting=f.session.request({type:'media',...call,sharing:true});
  ws.receive(callAck(required(ws.sent.at(-1)),{sharing:true}));await starting;
  f.clock.tick(8000);await expired;
  assert.equal(f.session.state.connected,true);assert.equal(ws.readyState,1);assert.equal(f.session.activeCallId,call.callId);assert.deepEqual(f.errors,[]);f.session.disconnect();
});

test('MEDIA-17/26: the current screen-stop deadline still terminates an unresponsive transport after unrelated mute',async()=>{
  const f=fixture(),ws=await f.connect();f.setBackend(()=>{});
  const call={callId:'current',generation:1};
  const stopping=f.session.request({type:'media',...call,sharing:false}),expired=assert.rejects(stopping,e=>isRecord(e)&&e.code==='TIMEOUT'&&e.phase==='media');
  const muted=f.session.request({type:'media',...call,muted:true});ws.receive(callAck(required(ws.sent.at(-1))));await muted;
  f.clock.tick(7999);assert.equal(f.session.state.connected,true);
  f.clock.tick(1);await expired;assert.equal(f.session.state.connected,false);assert.equal(ws.readyState,3);
});

test('MEDIA-28: signaling addressed to a terminal local attempt never reaches the new Call owner',async()=>{
  const f=fixture(),ws=await f.connect(),signals:Extract<ServerEvent,{type:'signal'}>[]=[];f.session.onSignal=event=>signals.push(event);f.setBackend(()=>{});
  const old=f.session.request({type:'call-join',callId:'old',generation:1,muted:true});ws.receive(callAck(required(ws.sent.at(-1))));await old;
  const left=f.session.request({type:'call-leave',callId:'old',generation:1});ws.receive(callAck(required(ws.sent.at(-1))));await left;
  const current=f.session.request({type:'call-join',callId:'new',generation:2,muted:false});ws.receive(callAck(required(ws.sent.at(-1))));await current;
  const event={type:'signal',context:f.session.roomContext,from:'peer',fromCallId:'remote',signal:{candidate:{candidate:'candidate'}}};
  ws.receive({...event,callId:'old'});assert.deepEqual(signals.slice(),[]);assert.equal(f.session.activeCallId,'new');assert.equal(f.session.state.connected,true);
  ws.receive({...event,callId:'new'});assert.equal(signals.length,1);assert.equal(signals[0].callId,'new');f.session.disconnect();
});

test('STAB-18/20/22: a transport refusal preserves full text and both room drafts across reconnect',async()=>{
  const f=fixture(),ws=await f.connect(),send=ws.send.bind(ws),text='  envio não aceito integral  ';
  ws.send=bytes=>{if(JSON.parse(bytes).type==='message')throw Error('transport refused');return send(bytes);};
  f.session.setDraft(text);await assert.rejects(()=>f.session.sendText(),error=>isRecord(error)&&error.code==='CONNECTION_FAILED');
  assert.equal(f.session.state.messages.length,0);assert.equal(f.session.state.outbox.length,1);
  const failed=f.session.state.outbox[0];assert.equal(failed.text,text);assert.equal(failed.room,'geral');assert.equal(failed.status,'failed');
  f.session.setDraft('rascunho geral');await f.session.changeRoom('cafe');f.session.setDraft('rascunho café');f.session.disconnect();
  await f.connect(undefined,'cafe');assert.equal(f.session.state.draft,'rascunho café');assert.equal(f.session.state.outbox.length,0);
  await f.session.changeRoom('geral');assert.equal(f.session.state.draft,'rascunho geral');assert.equal(f.session.state.outbox.length,1);
  assert.equal(f.session.state.outbox[0].operationId,failed.operationId);assert.equal(f.session.state.outbox[0].text,text);assert.equal(f.session.state.outbox[0].status,'failed');f.session.disconnect();
});

test('STAB-18/20/21/23/39: a late receipt reconciles its original room without changing the new composition',async()=>{
  const f=fixture(),ws=await f.connect(),oldContext=f.session.roomContext;let sent:MessageAction|undefined,committed:Message|undefined;
  f.setBackend((socket,event)=>{
    if(event.type==='message')sent=event;
    if(event.type==='join')socket.receive({type:'joined',requestId:event.requestId,room:room(event.room),messages:event.room==='geral'&&committed?[committed]:[]});
  });
  const sending=f.session.sendText('  destino fixo  ');assert.equal(f.session.state.outbox.length,1);
  await f.session.changeRoom('cafe');f.session.setDraft('composição nova');
  committed=persisted(required(sent));ws.receive({type:'message-accepted',requestId:required(sent).requestId,message:committed});assert.deepEqual(await sending,committed);
  assert.equal(required(f.session.state.room).id,'cafe');assert.equal(f.session.state.draft,'composição nova');assert.deepEqual(f.session.state.messages,[]);assert.deepEqual(f.session.state.outbox,[]);
  await f.session.changeRoom('geral');assert.deepEqual(f.session.state.messages,[committed]);assert.deepEqual(f.session.state.outbox,[]);
  ws.receive({type:'message',context:oldContext,message:committed});assert.deepEqual(f.session.state.messages,[committed]);assert.deepEqual(f.errors,[]);f.session.disconnect();
});

test('STAB-38: every A1 phase ends at 8s and permits a manual retry',async()=>{
  for(const phase of ['configuration','websocket','hello','join','call-join','message']){
    const f=fixture(),fetcher=f.session.fetcher;
    const confirm=(socket:Awaited<ReturnType<typeof f.connect>>,event:ClientEvent)=>{
      if(event.type==='join')socket.receive({type:'joined',requestId:event.requestId,room:room(event.room),messages:[]});
      else if(event.type==='call-join')socket.receive(callAck(event));
      else if(event.type==='message')socket.receive({type:'message-accepted',requestId:event.requestId,message:persisted(event)});
    };
    let pending:Promise<unknown>;
    if(['configuration','websocket','hello'].includes(phase)){
      if(phase==='configuration')f.session.fetcher=()=>new Promise(()=>{});
      pending=f.session.connect({name:'Ana',server:'http://localhost:4310'});await drain();
      if(phase==='hello')required(f.sockets.at(-1)).open();
    }else{
      await f.connect();f.setBackend(()=>{});
      if(phase==='join')pending=f.session.changeRoom('cafe');
      else if(phase==='call-join')pending=f.session.request({type:'call-join',callId:'timed-out',generation:1,muted:true});
      else pending=f.session.sendText('texto aguardando recibo');
    }
    let settled=false,cause:unknown;pending.then(()=>{settled=true;},error=>{settled=true;cause=error;});
    f.clock.tick(7999);await new Promise(setImmediate);assert.equal(settled,false,phase);
    f.clock.tick(1);await new Promise(setImmediate);assert.equal(settled,true,phase);assert.ok(isRecord(cause));assert.equal(cause.code,'TIMEOUT');assert.equal(cause.phase,phase);
    f.session.fetcher=fetcher;f.setBackend(confirm);
    if(['configuration','websocket','hello'].includes(phase)){await f.connect();assert.equal(f.session.state.connected,true);}
    else if(phase==='join'){await f.session.changeRoom('cafe');assert.equal(required(f.session.state.room).id,'cafe');}
    else if(phase==='call-join')assert.equal(required(await f.session.request({type:'call-join',callId:'retry',generation:2,muted:true})).inCall,true);
    else{assert.equal(f.session.state.outbox.length,1);await f.session.retry(f.session.state.outbox[0].operationId);assert.equal(f.session.state.messages[0].text,'texto aguardando recibo');}
    f.session.disconnect();assert.equal(f.clock.jobs.size,0);
  }
});
