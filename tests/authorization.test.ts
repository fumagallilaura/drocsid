import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request } from 'node:http';
import { WebSocket } from 'ws';
import { client } from './helpers/client.js';
import { startService } from './helpers/service.js';
import { startServer } from '../server/index.js';
import { IdentityError } from '../server/identity.js';
import type { Group } from '../server/identity.js';

const password='uma senha longa e exclusiva';
const isRecord=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function record(value:unknown):Record<string,unknown> { assert.ok(isRecord(value));return value; }
function text(value:unknown):string { assert.ok(typeof value==='string');return value; }
async function api(origin:string,path:string,method='GET',input?:unknown,token?:string) {
  const response=await fetch(origin+path,{method,headers:{...(input!==undefined?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},...(input!==undefined?{body:JSON.stringify(input)}:{})});
  const value:unknown=await response.json();return {status:response.status,body:record(value)};
}
async function account(origin:string,username:string) {
  const result=await api(origin,'/api/auth/register','POST',{username,password});assert.equal(result.status,201);
  const user=record(result.body.user);assert.equal(typeof user.id,'string');assert.equal(user.username,username);assert.equal(typeof result.body.token,'string');
  return {id:text(user.id),username,token:text(result.body.token)};
}
async function group(origin:string,token:string,name:string):Promise<Group> {
  const result=await api(origin,'/api/groups','POST',{name},token);assert.equal(result.status,201);
  const group=record(result.body.group);assert.equal(typeof group.id,'string');assert.equal(group.name,name);assert.equal(typeof group.ownerId,'string');assert.ok(Array.isArray(group.rooms));
  const rooms=group.rooms.map(value=>{const row=record(value);assert.equal(typeof row.id,'string');assert.equal(typeof row.name,'string');assert.equal(typeof row.description,'string');return {id:text(row.id),name:text(row.name),description:text(row.description)};});
  return {id:text(group.id),name:text(group.name),ownerId:text(group.ownerId),rooms};
}
async function ticket(origin:string,token:string) { const result=await api(origin,'/api/ws-ticket','POST',{},token);assert.equal(result.status,200);assert.equal(typeof result.body.ticket,'string');return text(result.body.ticket); }
async function authenticated(s:Awaited<ReturnType<typeof startService>>,token:string,room:string|null) {return client(`${s.url}?ticket=${await ticket(s.origin,token)}`,'Nome forjado',room);}
async function upgradeStatus(url:string,origin?:string):Promise<number> {
  const ws=new WebSocket(url,{handshakeTimeout:1500,...(origin?{origin}:{})});ws.on('error',()=>{});
  return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{ws.terminate();reject(new Error('Upgrade did not refuse'));},2000);ws.once('open',()=>{clearTimeout(timeout);ws.terminate();reject(new Error('Unauthenticated upgrade accepted'));});ws.once('unexpected-response',(_req,res)=>{clearTimeout(timeout);res.resume();ws.terminate();resolve(res.statusCode??0);});});
}
async function closesWithin(sockets:WebSocket[]):Promise<void> {
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{await Promise.race([
    Promise.all(sockets.map(socket=>once(socket,'close'))),
    new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new assert.AssertionError({message:'All invalidated sockets must close within one second'})),1000);}),
  ]);}finally{clearTimeout(timer);}
}

test('MERGE-08: network access and websocket tickets require authentication',async t=>{
  let now=2000000000000;
  const s=await startService(t,{trustedLocal:false,identityNow:()=>now});
  assert.deepEqual(await api(s.origin,'/api/server'),{status:200,body:{authentication:'required',protocolVersion:2,version:'0.1.1'}});
  for(const path of ['/api/config','/api/groups','/api/rooms/geral/messages']){const result=await api(s.origin,path);assert.equal(result.status,401);assert.equal('iceServers' in result.body,false);assert.equal('messages' in result.body,false);}
  assert.equal((await api(s.origin,'/api/ws-ticket','POST',{})).status,401);
  assert.equal(await upgradeStatus(s.url),401);
  assert.equal(await upgradeStatus(`${s.url}?token=durable-session`),401);
  const ana=await account(s.origin,'ana');
  const config=await api(s.origin,'/api/config','GET',undefined,ana.token);assert.equal(config.status,200);assert.deepEqual(config.body.iceServers,[]);assert.equal(config.body.protocolVersion,2);
  assert.equal(await upgradeStatus(`${s.url}?ticket=${ana.token}`),401);
  const code=await ticket(s.origin,ana.token),joined=await client(`${s.url}?ticket=${code}`,'ana',null);assert.deepEqual(joined.hello.rooms,[]);
  assert.equal(await upgradeStatus(`${s.url}?ticket=${code}`),401);
  const expired=await ticket(s.origin,ana.token);now+=30000;assert.equal(await upgradeStatus(`${s.url}?ticket=${expired}`),401);
  assert.equal(await upgradeStatus(s.url,'https://untrusted.example'),403);
  const denied=await fetch(s.origin+'/api/config',{headers:{Origin:'https://untrusted.example',Authorization:`Bearer ${ana.token}`}});assert.equal(denied.status,403);assert.equal(denied.headers.get('access-control-allow-origin'),null);
});

test('MERGE-08: explicit trusted guests require a real loopback listener and host',async t=>{
  const local=await startService(t);
  assert.equal((await api(local.origin,'/api/config')).status,200);
  const rebound=await new Promise<number>((resolve,reject)=>{const req=request(local.origin+'/api/config',{headers:{Host:'attacker.example'}},res=>{res.resume();resolve(res.statusCode??0);});req.on('error',reject);req.end();});assert.equal(rebound,401);
  await assert.rejects(startServer({production:true,env:{HOST:'0.0.0.0',PORT:'0',DROCSID_TRUSTED_LOCAL:'1',DATABASE_URL:local.fixture.url}}),error=>error instanceof Error&&'code' in error&&error.code==='INVALID_INPUT');
  await local.close();
  const {createService}=await import('../server/service.js');
  const exposed=await createService({database:await local.fixture.open(),trustedLocal:true,iceServers:[]});t.after(()=>exposed.close());
  await new Promise<void>(resolve=>exposed.server.listen(0,'0.0.0.0',resolve));
  const address=exposed.server.address();assert.ok(address&&typeof address==='object');
  assert.equal((await fetch(`http://127.0.0.1:${address.port}/api/config`)).status,401);
  assert.equal(await upgradeStatus(`ws://127.0.0.1:${address.port}/ws`),401);
});

test('MERGE-07: logout closes every owned media connection while another session remains usable',async t=>{
  const s=await startService(t,{trustedLocal:false}),ana=await account(s.origin,'ana');
  const g=await group(s.origin,ana.token,'Equipe'),a=await authenticated(s,ana.token,g.rooms[0].id),b=await authenticated(s,ana.token,g.rooms[0].id);
  await a.request({type:'call-join',muted:false});await a.request({type:'media',sharing:true});await b.request({type:'call-join'});
  const login=await api(s.origin,'/api/auth/login','POST',{username:'ana',password});assert.equal(login.status,200);assert.equal(typeof login.body.token,'string');
  const other=await authenticated(s,text(login.body.token),g.rooms[0].id);
  const closed=closesWithin([a.ws,b.ws]),started=performance.now();
  assert.equal((await api(s.origin,'/api/auth/logout','POST',{},ana.token)).status,200);await closed;
  assert.ok(performance.now()-started<=1000);assert.equal(a.ws.readyState,3);assert.equal(b.ws.readyState,3);
  assert.equal((await api(s.origin,'/api/config','GET',undefined,ana.token)).status,401);
  assert.equal((await api(s.origin,'/api/ws-ticket','POST',{},ana.token)).status,401);
  const history=await other.request({type:'join',room:g.rooms[0].id,name:'usurpado'});assert.equal(history.room.id,g.rooms[0].id);
  const snapshot=await other.next('presence',event=>event.members.length===1);assert.equal(snapshot.members[0].id,other.id);assert.equal(snapshot.members[0].name,'ana');
});

test('MERGE-07: observed session expiry terminates signaling and cannot be revived by a pong',async t=>{
  let now=2000000000000;
  const s=await startService(t,{trustedLocal:false,identityNow:()=>now}),ana=await account(s.origin,'ana');
  const g=await group(s.origin,ana.token,'Equipe'),a=await authenticated(s,ana.token,g.rooms[0].id);
  await a.request({type:'call-join'});const closed=closesWithin([a.ws,...s.wss.clients]),started=performance.now();now+=1800000;a.ws.pong();await closed;
  assert.ok(performance.now()-started<=1000);assert.equal(s.wss.clients.size,0);
  assert.equal((await api(s.origin,'/api/config','GET',undefined,ana.token)).status,401);
  const bia=await account(s.origin,'bia'),secondGroup=await group(s.origin,bia.token,'Absoluta'),b=await authenticated(s,bia.token,secondGroup.rooms[0].id);
  await b.request({type:'call-join'});
  // Keep idle activity below thirty minutes while reaching the absolute limit.
  for(let interval=0;interval<95;interval++){now+=900000;assert.equal((await api(s.origin,'/api/config','GET',undefined,bia.token)).status,200);}
  const absoluteClosed=closesWithin([b.ws,...s.wss.clients]),absoluteStarted=performance.now();now+=900000;b.ws.pong();await absoluteClosed;
  assert.ok(performance.now()-absoluteStarted<=1000);assert.equal(b.ws.readyState,3);assert.equal(s.wss.clients.size,0);
  assert.equal((await api(s.origin,'/api/config','GET',undefined,bia.token)).status,401);
  assert.equal((await api(s.origin,'/api/ws-ticket','POST',{},bia.token)).status,401);
});

test('MERGE-09: known foreign group identifiers never grant access',async t=>{
  const s=await startService(t,{trustedLocal:false}),ana=await account(s.origin,'ana'),bia=await account(s.origin,'bia');
  const ga=await group(s.origin,ana.token,'Equipe A'),gb=await group(s.origin,bia.token,'Equipe B');
  const a=await authenticated(s,ana.token,ga.rooms[0].id),b=await authenticated(s,bia.token,gb.rooms[0].id);
  await a.request({type:'call-join'});await b.request({type:'call-join'});
  assert.deepEqual((await api(s.origin,'/api/groups','GET',undefined,ana.token)).body.groups,[ga]);assert.deepEqual(a.hello.rooms,ga.rooms);
  const forbidden=await api(s.origin,`/api/rooms/${gb.rooms[0].id}/messages`,'GET',undefined,ana.token);assert.equal(forbidden.status,404);assert.equal('messages' in forbidden.body,false);
  for(const action of [{type:'join',room:gb.rooms[0].id,name:'bia'},{type:'message',room:gb.rooms[0].id,operationId:'stolen',text:'Não salvar'}]){
    const id=a.send(action),result=await a.next(['error','joined','message-accepted'],event=>event.requestId===id);assert.equal(result.type,'error');if(result.type==='error')assert.equal(result.code,'NOT_FOUND');
  }
  const id=a.send({type:'signal',to:b.id,toCallId:b.callId,signal:{candidate:{candidate:'private'}}});
  const signal=await Promise.race([a.next('error',event=>event.requestId===id).then(event=>({kind:'refused',code:event.code})),b.next('signal').then(()=>({kind:'forwarded',code:'FORWARDED'}))]);assert.equal(signal.kind,'refused');assert.equal(signal.code,'PARTICIPANT_UNAVAILABLE');
  assert.deepEqual(await s.database.history(gb.rooms[0].id),[]);assert.equal(b.events.some(event=>event.type==='signal'||event.type==='message'),false);
  assert.equal(a.events.some(event=>event.type==='presence'&&event.members.some(member=>member.id===b.id)),false);
  const admin=await api(s.origin,`/api/groups/${gb.id}/rooms`,'POST',{name:'forjada'},ana.token);assert.equal(admin.status,404);
});

test('MERGE-12: message receipts belong to their authenticated author',async t=>{
  const s=await startService(t,{trustedLocal:false}),ana=await account(s.origin,'ana'),bia=await account(s.origin,'bia');
  const g=await group(s.origin,ana.token,'Equipe'),invite=await api(s.origin,`/api/groups/${g.id}/invites`,'POST',{},ana.token);
  assert.equal((await api(s.origin,'/api/invites/accept','POST',{code:invite.body.code},bia.token)).status,200);
  const a=await authenticated(s,ana.token,g.rooms[0].id),b=await authenticated(s,bia.token,g.rooms[0].id);
  const saved=await a.request({type:'message',operationId:'shared-operation',text:'Conservar autora'});
  assert.equal(saved.message.authorId,ana.id);assert.equal(saved.message.author,'ana');assert.equal(saved.message.room,g.rooms[0].id);assert.equal(saved.message.text,'Conservar autora');assert.equal(saved.message.operationId,'shared-operation');assert.ok(saved.message.sequence>0);assert.ok(saved.message.created>0);
  const id=b.send({type:'message',operationId:'shared-operation',text:'Conservar autora'}),refused=await b.next(['error','message-accepted'],event=>event.requestId===id);
  assert.equal(refused.type,'error');if(refused.type==='error'){assert.equal(refused.code,'OPERATION_CONFLICT');assert.equal(typeof refused.message,'string');assert.equal(refused.message.includes('Conservar autora'),false);assert.equal('authorId' in refused,false);assert.equal('sequence' in refused,false);}
  a.ws.close();await once(a.ws,'close');const reconnected=await authenticated(s,ana.token,g.rooms[0].id);
  assert.deepEqual((await reconnected.request({type:'message',operationId:'shared-operation',text:'Conservar autora'})).message,saved.message);
  assert.deepEqual(await s.database.history(g.rooms[0].id),[saved.message]);
});

test('MERGE-12: concurrent owned receipts broadcast exactly one committed message',async t=>{
  const s=await startService(t,{trustedLocal:false}),ana=await account(s.origin,'ana'),g=await group(s.origin,ana.token,'Equipe');
  const a=await authenticated(s,ana.token,g.rooms[0].id),b=await authenticated(s,ana.token,g.rooms[0].id),observer=await authenticated(s,ana.token,g.rooms[0].id);
  const bothRead=Promise.withResolvers<void>(),receipt=s.database.receipt.bind(s.database);let readers=0;
  t.mock.method(s.database,'receipt',async(...args:Parameters<typeof receipt>)=>{const saved=await receipt(...args);if(args[0]==='concurrent-owned'&&!saved){if(++readers===2)bothRead.resolve();await bothRead.promise;}return saved;});
  const [first,second]=await Promise.all([a.request({type:'message',operationId:'concurrent-owned',text:'Uma vez'}),b.request({type:'message',operationId:'concurrent-owned',text:'Uma vez'})]);
  assert.deepEqual(first.message,second.message);const delivered=await observer.next('message');assert.deepEqual(delivered.message,first.message);
  const barrier=await observer.request({type:'join',room:g.rooms[0].id,name:'barrier'});assert.deepEqual(barrier.messages,[first.message]);
  assert.equal(observer.events.filter(event=>event.type==='message').length,0);assert.deepEqual(await s.database.history(g.rooms[0].id),[first.message]);
});

test('MERGE-06: HTTP login failures stay generic and bounded without logging credentials',async t=>{
  let now=2000000000000;
  const s=await startService(t,{trustedLocal:false,identityNow:()=>now}),ana=await account(s.origin,'ana');
  const logs:string[]=[];t.mock.method(console,'warn',(value:unknown)=>logs.push(String(value)));
  let first:Record<string,unknown>|undefined;
  for(let index=0;index<5;index++){
    const result=await api(s.origin,'/api/auth/login','POST',{username:index%2?'missing':'ana',password:'API_PRIVATE_PASSWORD'});
    assert.equal(result.status,401);if(first)assert.deepEqual(result.body,first);else first=result.body;
  }
  assert.equal((await api(s.origin,'/api/auth/login','POST',{username:'ana',password})).status,429);
  now+=60000;const result=await api(s.origin,'/api/auth/login','POST',{username:'ana',password});assert.equal(result.status,200);assert.equal(record(result.body.user).id,ana.id);
  const tooBig=await api(s.origin,'/api/auth/login','POST',{username:'ana',password:'API_PRIVATE_PAYLOAD'.repeat(5000)});assert.equal(tooBig.status,413);
  assert.equal(logs.some(value=>value.includes('API_PRIVATE_')||value.includes(ana.token)||value.includes(password)),false);
  assert.equal(logs.filter(value=>JSON.parse(value).code==='UNAUTHENTICATED').length,5);
});

test('MERGE-10: HTTP administration enforces membership and owner permissions',async t=>{
  const s=await startService(t,{trustedLocal:false}),ana=await account(s.origin,'ana'),bia=await account(s.origin,'bia'),g=await group(s.origin,ana.token,'Equipe');
  const invite=await api(s.origin,`/api/groups/${g.id}/invites`,'POST',{},ana.token);assert.equal(invite.status,201);
  assert.equal((await api(s.origin,'/api/invites/accept','POST',{code:invite.body.code},bia.token)).status,200);
  assert.equal((await api(s.origin,'/api/invites/accept','POST',{code:invite.body.code},bia.token)).status,404);
  assert.equal((await api(s.origin,`/api/groups/${g.id}/rooms`,'POST',{name:'restrita'},bia.token)).status,403);
  assert.equal((await api(s.origin,`/api/groups/${g.id}/invites`,'POST',{},bia.token)).status,403);
  const revocable=await api(s.origin,`/api/groups/${g.id}/invites`,'POST',{},ana.token);
  assert.equal((await api(s.origin,`/api/groups/${g.id}/invites/${text(revocable.body.id)}`,'DELETE',undefined,bia.token)).status,403);
  assert.equal((await api(s.origin,`/api/groups/${g.id}/invites/${text(revocable.body.id)}`,'DELETE',undefined,ana.token)).status,200);
  assert.equal((await api(s.origin,'/api/invites/accept','POST',{code:revocable.body.code},bia.token)).status,404);
  assert.equal((await api(s.origin,`/api/groups/${g.id}/rooms`,'POST',{name:'projetos'},ana.token)).status,201);
  assert.equal((await api(s.origin,`/api/groups/${g.id}/rooms`,'POST',{name:''},ana.token)).status,400);
  assert.equal((await api(s.origin,'/api/auth/register','POST',{username:'ana',password})).status,409);
  const visible=await api(s.origin,'/api/groups','GET',undefined,bia.token),groups=visible.body.groups;assert.ok(Array.isArray(groups));assert.equal(record(groups[0]).ownerId,ana.id);assert.equal(record(groups[0]).name,'Equipe');
});

test('MERGE-14: asynchronous room changes keep request order and end the current call',async t=>{
  const s=await startService(t,{trustedLocal:false}),ana=await account(s.origin,'ana'),g=await group(s.origin,ana.token,'Equipe');
  const second=record((await api(s.origin,`/api/groups/${g.id}/rooms`,'POST',{name:'projetos'},ana.token)).body.room),secondId=text(second.id);
  const a=await authenticated(s,ana.token,g.rooms[0].id),one=await a.request({type:'message',text:'Mensagem geral'});
  await a.request({type:'join',room:secondId,name:'forjado'});const two=await a.request({type:'message',text:'Mensagem projetos'});
  await a.request({type:'join',room:g.rooms[0].id,name:'forjado'});await a.request({type:'call-join'});await a.request({type:'media',sharing:true});
  const entered=Promise.withResolvers<void>(),release=Promise.withResolvers<void>(),history=s.database.history.bind(s.database);
  t.mock.method(s.database,'history',async(room:string)=>{if(room===secondId){entered.resolve();await release.promise;}return history(room);});
  const firstId=a.send({type:'join',room:secondId,name:'forjado'});await entered.promise;
  const secondRequest=a.send({type:'join',room:g.rooms[0].id,name:'forjado'});release.resolve();
  const first=await a.next('joined',event=>event.requestId===firstId),last=await a.next('joined',event=>event.requestId===secondRequest);
  assert.equal(first.room.id,secondId);assert.deepEqual(first.messages,[two.message]);assert.equal(last.room.id,g.rooms[0].id);assert.deepEqual(last.messages,[one.message]);
  const presence=await a.next('presence',event=>event.context===secondRequest);assert.equal(presence.members[0].inCall,false);assert.equal(presence.members[0].sharing,false);assert.equal(presence.members[0].name,'ana');
});

test('MERGE-07: concurrent logout and ticket consumption never leave a reusable session',async t=>{
  const s=await startService(t,{trustedLocal:false}),ana=await account(s.origin,'ana');
  let token=ana.token;
  for(let index=0;index<5;index++){
    const code=await s.identity.createTicket(token);
    const [used,revoked]=await Promise.allSettled([s.identity.consumeTicket(code.ticket),s.identity.logout(token)]);
    assert.equal(revoked.status,'fulfilled');
    if(used.status==='fulfilled')assert.equal(used.value.user.id,ana.id);
    else assert.ok(used.reason instanceof IdentityError&&used.reason.status===401);
    await assert.rejects(s.identity.authenticate(token),error=>error instanceof IdentityError&&error.status===401);
    token=(await s.identity.login('ana',password,'ip')).token;
  }
});

test('MERGE-19: service shutdown interrupts PostgreSQL work and closes its pool',async t=>{
  const s=await startService(t,{trustedLocal:false}),started=Promise.withResolvers<void>();
  const work=s.database.transaction(async connection=>{started.resolve();await connection.query('SELECT pg_sleep(30)');});
  const rejected=assert.rejects(work,error=>error instanceof Error&&'code' in error&&error.code==='PERSISTENCE_FAILED');
  await started.promise;const time=performance.now(),ending=s.close();assert.equal(s.close(),ending);await ending;await rejected;
  assert.ok(performance.now()-time<5000);assert.equal(s.server.listening,false);
  const sessions=await s.fixture.admin.query<{count:string}>("SELECT count(*)::text AS count FROM pg_stat_activity WHERE datname=$1 AND application_name LIKE 'drocsid-server/%'",[s.fixture.name]);assert.equal(sessions.rows[0].count,'0');
  await assert.rejects(s.database.rooms(),error=>error instanceof Error&&'code' in error&&error.code==='SHUTTING_DOWN');
});
