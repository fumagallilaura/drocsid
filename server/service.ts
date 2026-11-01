import express from 'express';
import type { Request, Response } from 'express';
import { createServer } from 'node:http';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import type { Socket } from 'node:net';
import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import metadata from '../package.json' with { type: 'json' };
import { createDatabase } from './database.js';
import type { Database } from './database.js';
import { Identity, IdentityError } from './identity.js';
import type { Session } from './identity.js';
import { LIMITS, PROTOCOL_VERSION, ProtocolError, parseClientEvent, readIceServers } from '../shared/protocol.js';
import type { ClientEvent, Member, Room, ServerAction } from '../shared/protocol.js';
import { logFailure } from './diagnostics.js';
export { logFailure } from './diagnostics.js';

type Timer = ReturnType<typeof setTimeout> | number;
type Clock = { now():number; setTimeout(fn:()=>void,ms:number):Timer; clearTimeout(id:Timer|undefined):void; setInterval(fn:()=>void,ms:number):Timer; clearInterval(id:Timer):void };
type Upgrade = (req:IncomingMessage,socket:Duplex,head:Buffer)=>boolean;
type WithoutContext<T> = T extends unknown ? Omit<T,'context'> : never;
type Outgoing = WithoutContext<ServerAction>;
type Client = Member & { ws:WebSocket; room:string|null; roomContext:string|null; session:Session|null; lastCallId:string|null;
  callState:'terminal'|'admitted'; lastPong:number; expiryTimer?:Timer; budgets:Map<string,{at:number;remaining:number}>; queue:Promise<void> };
type Options = { database?:Database; env?:{DATABASE_URL?:string;PG_CA_FILE?:string}; iceServers?:unknown; trustedLocal?:boolean; clock?:Clock; identityNow?:()=>number };
const realClock:Clock = { now:()=>performance.now(), setTimeout:(fn,ms)=>setTimeout(fn,ms).unref(), clearTimeout:id=>clearTimeout(id),
  setInterval:(fn,ms)=>setInterval(fn,ms).unref(), clearInterval:id=>clearInterval(id) };
const object = (value:unknown):value is Record<string,unknown> => value!==null&&typeof value==='object';
const loopback = (address:string|undefined) => !!address && ['127.0.0.1','::1','::ffff:127.0.0.1','localhost','[::1]'].includes(address);
const messages:Record<string,string> = {
  INVALID_EVENT:'Ação inválida ou tentativa encerrada.', INCOMPATIBLE_PROTOCOL:'Versão de protocolo incompatível. Atualize o aplicativo.',
  INVALID_INPUT:'Confira os dados. A mensagem deve ter entre 1 e 2000 caracteres.', ROOM_MISMATCH:'A sala da mensagem mudou. Confira o destino.',
  OPERATION_CONFLICT:'Este identificador já foi usado em outro envio.', RATE_LIMITED:'Muitas ações. Aguarde alguns segundos.',
  CALL_FULL:'A chamada está cheia (máximo de 6 pessoas).', PERSISTENCE_FAILED:'Não foi possível salvar a mensagem.',
  PARTICIPANT_UNAVAILABLE:'Participante indisponível nesta chamada.', NOT_FOUND:'Recurso não encontrado.', UNAUTHENTICATED:'Sessão encerrada. Entre novamente.',
  FORBIDDEN:'Somente o dono pode administrar o grupo.',
};

export async function createService({database:provided,env=process.env,iceServers:ice,trustedLocal=false,clock=realClock,identityNow}:Options={}) {
  const iceServers=readIceServers(ice), database=provided??await createDatabase(env);
  const identity=new Identity(database,{now:identityNow});
  try {
    if(trustedLocal) for(const item of [
      {id:'geral',name:'geral',description:'O ponto de encontro do seu grupo'},
      {id:'projetos',name:'projetos',description:'Ideias que ficam melhores em conjunto'},
      {id:'cafe',name:'café',description:'Uma pausa para colocar o papo em dia'},
    ]) if(!await database.room(item.id)) await database.createRoom(item);
  } catch(cause) { await identity.close(); await database.close(); throw cause; }
  let closing=false, closePromise:Promise<void>|undefined, developmentUpgrade:Upgrade|undefined, upgrading=0;
  const app=express();app.disable('x-powered-by');
  const server=createServer(app), sockets=new Set<Socket>(), clients=new Map<string,Client>();
  const wss=new WebSocketServer({noServer:true,maxPayload:LIMITS.payloadBytes});
  server.on('connection',socket=>{sockets.add(socket);socket.once('close',()=>sockets.delete(socket));});
  const alive=(c:Client)=>!closing&&clients.get(c.id)===c&&c.ws.readyState===WebSocket.OPEN;
  const localOrigin=(origin:string)=>{try{const url=new URL(origin);return url.origin===origin&&['http:','https:'].includes(url.protocol)&&loopback(url.hostname);}catch{return false;}};
  const allowedOrigin=(req:IncomingMessage)=>!req.headers.origin||localOrigin(req.headers.origin)||(()=>{try{const url=new URL(req.headers.origin);return url.origin===req.headers.origin&&['http:','https:'].includes(url.protocol)&&url.host===req.headers.host;}catch{return false;}})();
  const guest=(req:IncomingMessage)=>{
    const address=server.address();
    try{return trustedLocal&&typeof address==='object'&&address!==null&&loopback(address.address)&&loopback(req.socket.remoteAddress)&&loopback(new URL(`http://${req.headers.host}`).hostname);}
    catch{return false;}
  };
  const bearer=(req:IncomingMessage)=>{
    const match=/^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization??'');
    return match?.[1];
  };
  function send(c:Client,event:Outgoing):boolean {
    if(!alive(c))return false;
    if(c.ws.bufferedAmount>LIMITS.outboundBytes){c.ws.terminate();return false;}
    try { c.ws.send(JSON.stringify({v:PROTOCOL_VERSION,context:c.roomContext,...event}),cause=>{if(cause)logFailure('delivery','DELIVERY_FAILED','requestId' in event?event.requestId:null,cause);});return true; }
    catch(cause){logFailure('delivery','DELIVERY_FAILED','requestId' in event?event.requestId:null,cause);return false;}
  }
  const broadcast=(room:string,event:Outgoing)=>{for(const c of clients.values())if(c.room===room)send(c,event);};
  const members=(room:string):Member[]=>[...clients.values()].filter(c=>c.room===room).map(({id,name,inCall,muted,sharing,callId,generation})=>({id,name,inCall,muted,sharing,callId,generation}));
  const revisions=new Map<string,number>();
  const presence=(room:string|null)=>{if(room){const revision=(revisions.get(room)??0)+1;revisions.set(room,revision);broadcast(room,{type:'presence',room,revision,members:members(room)});}};
  const endCall=(c:Client)=>{c.inCall=false;c.muted=true;c.sharing=false;c.callId=null;c.callState='terminal';};
  const terminate=(c:Client)=>{clock.clearTimeout(c.expiryTimer);clients.delete(c.id);endCall(c);c.ws.terminate();if(!closing)presence(c.room);};
  const revoke=(id:string)=>{for(const c of clients.values())if(c.session?.id===id)terminate(c);};
  const error=(c:Client,code:string,requestId?:string,phase='protocol',cause?:unknown)=>{logFailure(phase,code,requestId,cause??new ProtocolError(code));return send(c,{type:'error',code,message:messages[code]??'Não foi possível processar esta ação.',requestId:requestId??null,phase});};
  const ack=(c:Client,e:Extract<ClientEvent,{type:'call-join'|'call-leave'|'media'}>,state:Pick<Member,'inCall'|'muted'|'sharing'>=c)=>send(c,{type:'ack',requestId:e.requestId,action:e.type,callId:e.callId,generation:e.generation,inCall:state.inCall,muted:state.muted,sharing:state.sharing});
  const visibleRooms=(c:Client)=>c.session?identity.roomsFor(c.session.user.id):database.query(`SELECT r.id,r.name,r.description FROM drocsid.rooms r WHERE NOT EXISTS(SELECT 1 FROM drocsid.group_rooms gr WHERE gr.room_id=r.id) ORDER BY r.position`).then(rows=>rows.map(row=>{
    if(typeof row.id!=='string'||typeof row.name!=='string'||typeof row.description!=='string')throw new ProtocolError('PERSISTENCE_FAILED');
    return {id:row.id,name:row.name,description:row.description};
  }));
  async function authorizedRoom(c:Client,id:string):Promise<Room> {
    if(c.session)return identity.requireRoom(c.session.user.id,id);
    const room=(await visibleRooms(c)).find(item=>item.id===id);
    if(!room)throw new ProtocolError('INVALID_INPUT');return room;
  }
  async function sessionFor(req:IncomingMessage) { const token=bearer(req);if(token)return identity.authenticate(token);if(!guest(req))throw new IdentityError(401,'UNAUTHENTICATED','Entre na sua conta.');return null; }
  const routeId=(value:unknown)=>{if(typeof value!=='string'||!value||value.length>128)throw new IdentityError(400,'INVALID_INPUT','Identificador inválido.');return value;};
  const body=(req:Request):Record<string,unknown>=>{const value:unknown=req.body;if(!object(value)||Array.isArray(value))throw new IdentityError(400,'INVALID_INPUT','Dados inválidos.');return value;};
  const account=(req:IncomingMessage)=>identity.authenticate(bearer(req));
  const refreshRooms=async(userId?:string)=>{for(const c of clients.values())if(c.session&&(!userId||c.session.user.id===userId)){const rooms=await visibleRooms(c);send(c,{type:'rooms',rooms});}};
  app.use((_req,res,next)=>closing?res.status(503).json({code:'SHUTTING_DOWN'}):next());
  app.use('/api',(req,res,next)=>{
    if(!allowedOrigin(req))return res.status(403).json({code:'FORBIDDEN'});
    if(req.headers.origin){res.setHeader('Access-Control-Allow-Origin',req.headers.origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods','GET, POST, DELETE');}
    if(req.method==='OPTIONS')return res.sendStatus(204);next();
  });
  app.use(express.json({limit:LIMITS.payloadBytes}));
  app.get('/api/health',(_req,res)=>res.json({ok:true}));
  app.get('/api/server',(req,res)=>res.json({authentication:guest(req)?'trusted-local':'required',protocolVersion:PROTOCOL_VERSION,version:metadata.version}));
  app.get('/api/config',async(req,res)=>{await sessionFor(req);res.json({iceServers,maxCallMembers:LIMITS.callMembers,protocolVersion:PROTOCOL_VERSION,version:metadata.version});});
  app.get('/api/me',async(req,res)=>{const session=await account(req);res.json({user:session.user});});
  app.post('/api/auth/register',async(req,res)=>{const input=body(req);res.status(201).json(await identity.register(input.username,input.password,req.socket.remoteAddress??''));});
  app.post('/api/auth/login',async(req,res)=>{const input=body(req);res.json(await identity.login(input.username,input.password,req.socket.remoteAddress??''));});
  app.post('/api/auth/logout',async(req,res)=>{const id=await identity.logout(bearer(req));revoke(id);res.json({ok:true});});
  app.post('/api/ws-ticket',async(req,res)=>res.json(await identity.createTicket(bearer(req))));
  app.get('/api/groups',async(req,res)=>{const session=await account(req);res.json({groups:await identity.groupsFor(session.user.id)});});
  app.post('/api/groups',async(req,res)=>{const session=await account(req),group=await identity.createGroup(session.user.id,body(req).name);await refreshRooms(session.user.id);res.status(201).json({group});});
  app.post('/api/groups/:groupId/rooms',async(req,res)=>{
    const session=await account(req),room=await identity.createRoom(session.user.id,routeId(req.params.groupId),body(req).name);
    await refreshRooms();
    res.status(201).json({room});
  });
  app.post('/api/groups/:groupId/invites',async(req,res)=>{const session=await account(req);res.status(201).json(await identity.createInvite(session.user.id,routeId(req.params.groupId)));});
  app.delete('/api/groups/:groupId/invites/:inviteId',async(req,res)=>{const session=await account(req);await identity.revokeInvite(session.user.id,routeId(req.params.groupId),routeId(req.params.inviteId));res.json({ok:true});});
  app.post('/api/invites/accept',async(req,res)=>{const session=await account(req),group=await identity.acceptInvite(session.user.id,body(req).code);await refreshRooms(session.user.id);res.json({group});});
  app.get('/api/rooms/:roomId/messages',async(req,res)=>{const session=await account(req),room=await identity.requireRoom(session.user.id,routeId(req.params.roomId));res.json({messages:await database.history(room.id)});});
  app.use('/api',(_req,res)=>res.status(404).json({code:'NOT_FOUND'}));
  app.use((cause:unknown,_req:Request,res:Response,_next:express.NextFunction)=>{
    const status=cause instanceof IdentityError?cause.status:object(cause)&&cause.type==='entity.too.large'?413:object(cause)&&cause.type==='entity.parse.failed'?400:503;
    const code=cause instanceof ProtocolError?cause.code:status===413?'PAYLOAD_TOO_LARGE':status===400?'INVALID_INPUT':'PERSISTENCE_FAILED';
    logFailure('http',code,null,cause);res.status(status).json({code,message:cause instanceof IdentityError?cause.message:messages[code]??'Não foi possível concluir a operação.'});
  });
  function expire(c:Client):void {
    clock.clearTimeout(c.expiryTimer);c.expiryTimer=clock.setTimeout(()=>{if(!clients.has(c.id))return;if(clock.now()-c.lastPong<60000)return expire(c);terminate(c);},Math.max(0,c.lastPong+60000-clock.now()));
  }
  function rejectUpgrade(socket:Duplex,status:number):void {
    socket.end(`HTTP/1.1 ${status} ${status===404?'Not Found':status===401?'Unauthorized':status===403?'Forbidden':'Service Unavailable'}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`,()=>socket.destroy());
    const timer=setTimeout(()=>socket.destroy(),1000);timer.unref();socket.once('close',()=>clearTimeout(timer));
  }
  async function processEvent(c:Client,e:ClientEvent):Promise<void> {
    if(!alive(c))return;
    if(c.session){try{c.session=await identity.checkSession(c.session.id,true);}catch{terminate(c);return;}if(!alive(c))return;}
    const requestId=e.requestId;
    try {
      if(['call-join','call-leave','media','signal'].includes(e.type)&&'generation' in e&&e.generation===c.generation&&e.callId!==c.lastCallId){error(c,'INVALID_EVENT',requestId,e.type);return;}
      if(e.type==='call-join'){
        if(e.generation<c.generation||(e.generation===c.generation&&c.callState==='terminal')||(c.inCall&&e.generation!==c.generation)){error(c,'INVALID_EVENT',requestId,e.type);return;}
        if(c.inCall){ack(c,e);return;}
      }
      const terminal=e.type==='call-leave'||(e.type==='media'&&e.sharing===false);
      if(!terminal){let budget=c.budgets.get(e.type);if(!budget||Date.now()-budget.at>=10000){budget={at:Date.now(),remaining:100};c.budgets.set(e.type,budget);}if(--budget.remaining<0){error(c,'RATE_LIMITED',requestId,e.type);return;}}
      if(e.type==='join'){
        const next=await authorizedRoom(c,e.room),history=await database.history(e.room);if(!alive(c))return;
        const previous=c.room;endCall(c);c.room=e.room;c.name=c.session?.user.username??e.name.trim();c.roomContext=requestId;
        send(c,{type:'joined',requestId,room:next,messages:history});presence(previous);if(previous!==c.room)presence(c.room);return;
      }
      if(!c.room){error(c,'INVALID_EVENT',requestId,e.type);return;}
      if(c.session){await authorizedRoom(c,c.room);if(!alive(c))return;}
      if(e.type==='message'){
        await authorizedRoom(c,e.room);if(!alive(c))return;
        const ownerId=c.session?.user.id??null,text=e.text.trim(),existing=await database.receipt(e.operationId,ownerId,e.room,text);if(!alive(c))return;
        if(existing){send(c,{type:'message-accepted',requestId,message:existing});return;}
        if(e.room!==c.room){error(c,'ROOM_MISMATCH',requestId,e.type);return;}
        const result=await database.commitMessage({id:randomUUID(),room:e.room,author:c.name,text,created:Date.now(),authorId:c.session?.user.id??c.id,operationId:e.operationId,ownerId});
        if(!alive(c))return;send(c,{type:'message-accepted',requestId,message:result.message});if(result.inserted)broadcast(e.room,{type:'message',message:result.message});
      }else if(e.type==='create-room'){
        let created:Room;
        if(c.session){const groups=await identity.groupsFor(c.session.user.id),group=groups.find(item=>item.rooms.some(room=>room.id===c.room));if(!group)throw new IdentityError(404,'NOT_FOUND','Recurso não encontrado.');created=await identity.createRoom(c.session.user.id,group.id,e.name);}
        else {
          created={id:randomUUID(),name:e.name.trim(),description:'Um espaço para o seu grupo'};
          await database.transaction(async connection=>{
            await connection.query('SELECT pg_advisory_xact_lock($1)',[41973922]);
            const count=await connection.query<{count:string}>('SELECT count(*)::text AS count FROM drocsid.rooms');
            if(Number(count.rows[0].count)>=LIMITS.rooms)throw new ProtocolError('INVALID_INPUT');
            await connection.query('INSERT INTO drocsid.rooms(id,name,description) VALUES ($1,$2,$3)',[created.id,created.name,created.description]);
          });
        }
        if(!alive(c))return;send(c,{type:'room-created',requestId,room:created});for(const target of clients.values()){const rooms=await visibleRooms(target);if(!alive(c))return;send(target,{type:'rooms',rooms});}
      }else if(e.type==='call-join'){
        if([...clients.values()].filter(x=>x.room===c.room&&x.inCall&&x!==c).length>=LIMITS.callMembers){error(c,'CALL_FULL',requestId,e.type);return;}
        Object.assign(c,{inCall:true,callId:e.callId,lastCallId:e.callId,generation:e.generation,callState:'admitted',muted:e.muted,sharing:false});ack(c,e);presence(c.room);
      }else if(e.type==='call-leave'){
        if(e.generation>=c.generation){const changed=c.inCall;c.generation=e.generation;c.lastCallId=e.callId;endCall(c);if(changed)presence(c.room);}
        ack(c,e,{inCall:false,muted:true,sharing:false});
      }else if(e.type==='media'){
        if(!c.inCall||e.callId!==c.callId||e.generation!==c.generation){error(c,'INVALID_EVENT',requestId,e.type);return;}
        if(e.muted!==undefined)c.muted=e.muted;if(e.sharing!==undefined)c.sharing=e.sharing;ack(c,e);presence(c.room);
      }else if(e.type==='signal'){
        const target=clients.get(e.to);
        if(e.generation!==c.generation){error(c,'INVALID_EVENT',requestId,e.type);return;}
        if(!c.inCall||c.callId!==e.callId||!target?.inCall||target.room!==c.room||target.callId!==e.toCallId){error(c,'PARTICIPANT_UNAVAILABLE',requestId,e.type);return;}
        send(target,{type:'signal',from:c.id,fromCallId:c.callId,callId:target.callId,signal:e.signal});
      }
    }catch(cause){const code=cause instanceof ProtocolError?cause.code:'PERSISTENCE_FAILED';error(c,code,requestId,e.type,cause);}
  }
  function attach(ws:WebSocket,session:Session|null):void {
    const c:Client={id:randomUUID(),ws,session,name:session?.user.username??'',room:null,roomContext:null,inCall:false,muted:true,sharing:false,callId:null,generation:0,lastCallId:null,callState:'terminal',lastPong:clock.now(),budgets:new Map(),queue:Promise.resolve()};
    clients.set(c.id,c);expire(c);
    ws.on('error',cause=>logFailure('socket','CONNECTION_FAILED',null,cause));
    ws.on('pong',()=>{if(alive(c)){c.lastPong=clock.now();expire(c);}});
    c.queue=visibleRooms(c).then(rooms=>{if(alive(c))send(c,{type:'hello',id:c.id,rooms});}).catch(cause=>{logFailure('hello','PERSISTENCE_FAILED',null,cause);terminate(c);});
    ws.on('message',raw=>{
      let event:ClientEvent,requestId:string|undefined;
      try{const value:unknown=JSON.parse(raw.toString());if(object(value)&&typeof value.requestId==='string'&&value.requestId.length<=128)requestId=value.requestId;event=parseClientEvent(raw.toString());}
      catch(cause){error(c,cause instanceof ProtocolError?cause.code:'INVALID_EVENT',requestId,'protocol',cause);return;}
      c.queue=c.queue.then(()=>processEvent(c,event)).catch(cause=>{error(c,'PERSISTENCE_FAILED',requestId,event.type,cause);});
    });
    ws.on('close',()=>{clock.clearTimeout(c.expiryTimer);clients.delete(c.id);endCall(c);if(!closing)presence(c.room);});
  }
  server.on('upgrade',(req,socket,head)=>{
    void (async()=>{
      if(closing)return rejectUpgrade(socket,503);
      let url:URL;try{url=new URL(req.url??'','http://localhost');}catch{return rejectUpgrade(socket,404);}
      if(url.pathname!=='/ws'){if(developmentUpgrade?.(req,socket,head))return;return rejectUpgrade(socket,404);}
      if(!allowedOrigin(req))return rejectUpgrade(socket,403);
      if(clients.size+upgrading>=LIMITS.connections)return rejectUpgrade(socket,503);
      upgrading++;
      try{
        const ticket=url.searchParams.get('ticket');
        if([...url.searchParams.keys()].some(key=>key!=='ticket')||url.searchParams.getAll('ticket').length>1)return rejectUpgrade(socket,401);
        const session=ticket?await identity.consumeTicket(ticket):guest(req)?null:undefined;
        if(session===undefined)return rejectUpgrade(socket,401);
        if(closing||socket.destroyed)return rejectUpgrade(socket,503);
        wss.handleUpgrade(req,socket,head,ws=>{attach(ws,session);wss.emit('connection',ws);});
      }catch(cause){rejectUpgrade(socket,cause instanceof IdentityError?cause.status:503);}
      finally{upgrading--;}
    })().catch(cause=>{logFailure('upgrade','CONNECTION_FAILED',null,cause);socket.destroy();});
  });
  const heartbeat=clock.setInterval(()=>{for(const c of clients.values())c.ws.ping();},30000);
  let inspecting=false;
  const authTimer=setInterval(()=>{
    if(closing||inspecting)return;inspecting=true;
    void Promise.all([...clients.values()].filter(c=>c.session).map(async c=>{if(!c.session)return;try{await identity.checkSession(c.session.id);}catch{if(alive(c))terminate(c);}})).finally(()=>{inspecting=false;});
  },500).unref();
  return {app,server,wss,database,identity,setDevelopmentUpgrade(handler:Upgrade){developmentUpgrade=handler;},close():Promise<void>{
    if(closePromise)return closePromise;closing=true;clock.clearInterval(heartbeat);clearInterval(authTimer);
    let timer:ReturnType<typeof setTimeout>|undefined;
    const work=(async()=>{
      const failures:unknown[]=[];
      for(const c of clients.values()){clock.clearTimeout(c.expiryTimer);endCall(c);try{c.ws.terminate();}catch(cause){failures.push(cause);}}
      for(const socket of sockets)try{socket.destroy();}catch(cause){failures.push(cause);}
      const results=await Promise.allSettled([
        new Promise<void>((resolve,reject)=>wss.close(cause=>cause?reject(cause):resolve())),
        new Promise<void>((resolve,reject)=>server.close(cause=>cause&&(!('code' in cause)||cause.code!=='ERR_SERVER_NOT_RUNNING')?reject(cause):resolve())),
        identity.close().then(()=>database.close()),
      ]);
      if(failures.length||results.some(item=>item.status==='rejected'))throw new ProtocolError('SHUTDOWN_FAILED');
    })();
    closePromise=Promise.race([work,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new ProtocolError('SHUTDOWN_FAILED')),LIMITS.shutdownMs);})]).catch(cause=>{logFailure('shutdown','SHUTDOWN_FAILED',null,cause);throw cause;}).finally(()=>clearTimeout(timer));
    return closePromise;
  }};
}
