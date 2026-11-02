import test from 'node:test';
import assert from 'node:assert/strict';
import {Session} from '../src/session.js';
import {ProtocolError,readGroups} from '../shared/protocol.js';
import {startService} from './helpers/service.js';

const password='uma senha longa e exclusiva';
const code=(expected:string)=>(error:unknown)=>error instanceof ProtocolError&&error.code===expected;
test('MERGE-13: account requests use memory credentials and authoritative group results',async t=>{
  const service=await startService(t,{trustedLocal:false}),session=new Session();t.after(()=>session.disconnect());
  await session.signIn({server:service.origin,username:'ana',password,register:true});
  assert.equal(session.state.connected,true);assert.equal(session.state.session?.name,'ana');assert.equal(session.state.room,null);assert.match(session.accessToken??'',/^[A-Za-z0-9_-]{43}$/);
  const token=session.accessToken;assert.ok(token);assert.equal(JSON.stringify(session.state).includes(token),false);assert.equal(JSON.stringify(session.state).includes(password),false);
  await session.api('/api/groups',{method:'POST',input:{name:'Equipe'}},'groups');
  const result=await session.api('/api/groups');assert.ok(result!==null&&typeof result==='object'&&'groups' in result);
  const groups=readGroups(result.groups);assert.equal(groups.length,1);assert.equal(groups[0].name,'Equipe');assert.equal(groups[0].ownerId,session.accountId);assert.equal(groups[0].rooms[0].name,'geral');
  await session.changeRoom(groups[0].rooms[0].id);session.setDraft('Rascunho privado');await session.sendText('Autoria confirmada');
  assert.equal(session.state.messages[0].authorId,session.accountId);assert.equal(session.state.messages[0].author,'ana');assert.equal(session.state.messages[0].room,groups[0].rooms[0].id);
  await session.logout();assert.equal(session.accessToken,null);assert.equal(session.accountId,null);assert.equal(session.state.session,null);assert.equal(session.drafts.size,0);assert.equal(session.outbox.size,0);
  await assert.rejects(session.api('/api/groups'),code('UNAUTHENTICATED'));
  assert.equal((await fetch(service.origin+'/api/config',{headers:{Authorization:`Bearer ${token}`}})).status,401);
});

test('MERGE-13: a rejected login is recoverable and never connects another identity',async t=>{
  const service=await startService(t,{trustedLocal:false}),session=new Session();t.after(()=>session.disconnect());
  const account=await service.identity.register('ana',password,'fixture');
  await assert.rejects(session.signIn({server:service.origin,username:'ana',password:'senha incorreta longa'}),code('UNAUTHENTICATED'));
  const failed=session.state;assert.equal(failed.connected,false);assert.equal(failed.connecting,false);assert.equal(failed.session,null);assert.equal(session.accessToken,null);
  await session.signIn({server:service.origin,username:'ana',password});assert.equal(session.accountId,account.user.id);assert.equal(session.state.session?.name,'ana');
  await assert.rejects(session.signIn({server:service.origin,username:'ana',password,register:true}),code('USERNAME_TAKEN'));
  assert.equal(session.state.connected,false);assert.equal(session.state.connecting,false);assert.equal(session.state.session,null);assert.equal(session.accessToken,null);
});

class Clock {
  time=0;id=0;jobs=new Map<number,{at:number;run():void}>();
  setTimeout=(run:()=>void,ms:number)=>{const id=++this.id;this.jobs.set(id,{at:this.time+ms,run});return id;};
  clearTimeout=(id:unknown)=>{if(typeof id==='number')this.jobs.delete(id);};
  tick(ms:number){this.time+=ms;for(const[id,job]of [...this.jobs])if(job.at<=this.time){this.jobs.delete(id);job.run();}}
}
const drain=async()=>{for(let index=0;index<30;index++)await Promise.resolve();};
class Socket {
  readyState=0;onopen:(()=>void)|null=null;onclose:(()=>void)|null=null;onerror:(()=>void)|null=null;onmessage:((event:{data:unknown})=>void)|null=null;
  constructor(_url:string){queueMicrotask(()=>{this.readyState=1;this.onopen?.();this.onmessage?.({data:JSON.stringify({v:2,type:'hello',id:'connection',rooms:[]})});});}
  send(_bytes:string){}close(){this.readyState=3;this.onclose?.();}
}
const config={protocolVersion:2,iceServers:[],maxCallMembers:6};
const response=(value:unknown)=>({ok:true,json:async()=>value});
test('MERGE-13: sign-in and account operations expire after eight seconds and clear their pending state',async()=>{
  const clock=new Clock(),session=new Session({clock,WebSocket:Socket,fetch:async()=>new Promise(()=>{})});
  const waiting=session.signIn({server:'http://localhost',username:'ana',password}),rejected=assert.rejects(waiting,error=>code('TIMEOUT')(error)&&error instanceof ProtocolError&&error.phase==='authentication');await drain();
  clock.tick(7999);await drain();assert.equal(session.state.connecting,true);clock.tick(1);await rejected;assert.equal(session.state.connecting,false);assert.equal(clock.jobs.size,0);
  session.fetcher=async url=>response(url.endsWith('/api/auth/login')?{user:{id:'account',username:'ana'},token:'a'.repeat(43)}:url.endsWith('/api/me')?{user:{id:'account',username:'ana'}}:url.endsWith('/api/ws-ticket')?{ticket:'b'.repeat(43)}:config);
  await session.signIn({server:'http://localhost',username:'ana',password});assert.equal(session.state.connected,true);
  let pendingSignal:AbortSignal|undefined;
  session.fetcher=async(_url,options)=>{pendingSignal=options.signal;return new Promise(()=>{});};
  const operation=session.api('/api/groups',{method:'POST',input:{name:'Equipe'}},'groups'),failed=assert.rejects(operation,error=>code('TIMEOUT')(error)&&error instanceof ProtocolError&&error.phase==='groups');
  clock.tick(7999);await drain();assert.equal(session.state.connected,true);clock.tick(1);await failed;assert.equal(session.state.connected,true);assert.equal(clock.jobs.size,0);assert.equal(pendingSignal?.aborted,true);session.disconnect();
});

test('MERGE-13: stale authentication and account responses cannot replace a newer context',async()=>{
  const oldAuth=Promise.withResolvers<{ok:boolean;json():Promise<unknown>}>(),pendingGroup=Promise.withResolvers<{ok:boolean;json():Promise<unknown>}>();
  const session=new Session({WebSocket:Socket,fetch:async url=>{
    if(url.startsWith('http://old.example'))return oldAuth.promise;
    if(url.endsWith('/api/groups'))return pendingGroup.promise;
    return response(url.endsWith('/api/auth/login')?{user:{id:'new-account',username:'bia'},token:'b'.repeat(43)}:url.endsWith('/api/me')?{user:{id:'new-account',username:'bia'}}:url.endsWith('/api/ws-ticket')?{ticket:'c'.repeat(43)}:config);
  }});
  const old=session.signIn({server:'http://old.example',username:'ana',password});await drain();
  await session.signIn({server:'http://new.example',username:'bia',password});
  oldAuth.resolve(response({user:{id:'old-account',username:'ana'},token:'a'.repeat(43)}));await old;
  assert.equal(session.state.session?.server,'http://new.example');assert.equal(session.state.session?.name,'bia');assert.equal(session.accountId,'new-account');assert.equal(session.accessToken,'b'.repeat(43));
  const pending=session.api('/api/groups'),rejected=assert.rejects(pending,code('CANCELLED'));session.disconnect();await rejected;
  pendingGroup.resolve(response({groups:[{id:'private',name:'Old',ownerId:'new-account',rooms:[]}]}));await drain();
  assert.equal(session.state.connected,false);assert.equal(session.state.session,null);assert.equal(session.accessToken,null);assert.deepEqual(session.state.rooms,[]);
});
