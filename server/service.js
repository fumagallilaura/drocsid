import express from 'express';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import metadata from '../package.json' with { type: 'json' };
import { LIMITS, PROTOCOL_VERSION, ProtocolError, parseClientEvent, readIceServers } from '../shared/protocol.js';

export function logFailure(phase, code, requestId, error) {
  const cause = error?.cause || error;
  const causeCode = ['EADDRINUSE','EADDRNOTAVAIL','EACCES','ENOENT','ERR_SQLITE_ERROR','SHUTDOWN_FAILED'].includes(cause?.code) ? cause.code : null;
  console.warn(JSON.stringify({ phase, code, requestId: requestId || null, version: metadata.version,
    runtime: process.versions.electron || process.versions.node, cause: cause?.name || 'Error', causeCode,
    sqliteCode: Number.isInteger(cause?.errcode) ? cause.errcode : null }));
}
const messages = {
  INVALID_EVENT: 'Ação inválida ou tentativa encerrada.', INCOMPATIBLE_PROTOCOL: 'Versão de protocolo incompatível. Atualize o aplicativo.',
  INVALID_INPUT: 'Confira os dados. A mensagem deve ter entre 1 e 2000 caracteres.', ROOM_MISMATCH: 'A sala da mensagem mudou. Confira o destino.',
  OPERATION_CONFLICT: 'Este identificador já foi usado em outro envio.', RATE_LIMITED: 'Muitas ações. Aguarde alguns segundos.',
  CALL_FULL: 'A chamada está cheia (máximo de 6 pessoas).', PERSISTENCE_FAILED: 'Não foi possível salvar a mensagem.',
  PARTICIPANT_UNAVAILABLE: 'Participante indisponível nesta chamada.',
};

export function createService({ dbPath = 'data/conversa.sqlite', iceServers } = {}) {
  iceServers = readIceServers(iceServers);
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  try {
    db.exec(`PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, room TEXT NOT NULL, author TEXT NOT NULL, text TEXT NOT NULL, created INTEGER NOT NULL);`);
    const columns = db.prepare('PRAGMA table_info(messages)').all().map(c => c.name);
    if (!['id','room','author','text','created'].every(name => columns.includes(name)) || db.prepare('PRAGMA user_version').get().user_version > 1) throw new ProtocolError('INVALID_INPUT');
    db.exec('BEGIN IMMEDIATE');
    for (const [name,type] of [['authorId','TEXT'],['operationId','TEXT'],['sequence','INTEGER']]) if (!columns.includes(name)) db.exec(`ALTER TABLE messages ADD COLUMN ${name} ${type}`);
    db.exec(`UPDATE messages SET sequence=rowid WHERE sequence IS NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS message_sequence ON messages(sequence);
      CREATE UNIQUE INDEX IF NOT EXISTS message_operation ON messages(operationId);
      CREATE INDEX IF NOT EXISTS messages_room_sequence ON messages(room,sequence);
      PRAGMA user_version=1; COMMIT;`);
  } catch (error) { try { db.exec('ROLLBACK'); } catch {} db.close(); throw error; }
  const addRoom = db.prepare('INSERT OR IGNORE INTO rooms VALUES (?,?,?)');
  addRoom.run('geral','geral','O ponto de encontro do seu grupo');
  addRoom.run('projetos','projetos','Ideias que ficam melhores em conjunto');
  addRoom.run('cafe','café','Uma pausa para colocar o papo em dia');
  const roomsQuery=db.prepare('SELECT * FROM rooms ORDER BY rowid'), roomQuery=db.prepare('SELECT * FROM rooms WHERE id=?');
  const history=db.prepare('SELECT * FROM (SELECT * FROM messages WHERE room=? ORDER BY sequence DESC LIMIT 200) ORDER BY sequence');
  const operationQuery=db.prepare('SELECT * FROM messages WHERE operationId=?');
  const insert=db.prepare('INSERT INTO messages (id,room,author,text,created,authorId,operationId,sequence) VALUES (?,?,?,?,?,?,?,(SELECT COALESCE(MAX(sequence),0)+1 FROM messages)) RETURNING *');
  let closing=false, closePromise, developmentUpgrade;
  const app=express(); app.disable('x-powered-by');
  app.use((_req,res,next)=>closing ? res.status(503).json({code:'SHUTTING_DOWN'}) : next());
  app.get('/api/health',(_req,res)=>res.json({ok:true}));
  const localOrigin=origin=>{try{return ['localhost','127.0.0.1','[::1]'].includes(new URL(origin).hostname);}catch{return false;}};
  app.get('/api/config',(req,res)=>{
    if(req.headers.origin&&localOrigin(req.headers.origin))res.setHeader('Access-Control-Allow-Origin',req.headers.origin);
    res.json({iceServers,maxCallMembers:LIMITS.callMembers,protocolVersion:PROTOCOL_VERSION,version:metadata.version});
  });
  const server=createServer(app), sockets=new Set(), clients=new Map();
  const wss=new WebSocketServer({noServer:true,maxPayload:LIMITS.payloadBytes});
  server.on('connection',socket=>{sockets.add(socket);socket.once('close',()=>sockets.delete(socket));});
  function send(client,event) {
    if(client.ws.readyState!==WebSocket.OPEN)return false;
    if(client.ws.bufferedAmount>LIMITS.outboundBytes){client.ws.terminate();return false;}
    try {
      client.ws.send(JSON.stringify({v:PROTOCOL_VERSION,context:client.roomContext||null,...event}),error=>{if(error)logFailure('delivery','DELIVERY_FAILED',event.requestId,error);});
      return true;
    } catch(error){logFailure('delivery','DELIVERY_FAILED',event.requestId||event.message?.operationId,error);return false;}
  }
  const broadcast=(room,event)=>{for(const c of clients.values())if(c.room===room)send(c,event);};
  const members=room=>[...clients.values()].filter(c=>c.room===room).map(({id,name,inCall,muted,sharing,callId,generation})=>({id,name,inCall,muted,sharing,callId,generation}));
  const presence=room=>{if(room)broadcast(room,{type:'presence',room,members:members(room)});};
  const error=(c,code,requestId,phase='protocol')=>send(c,{type:'error',code,message:messages[code]||'Não foi possível processar esta ação.',requestId:requestId||null,phase});
  const ack=(c,e,state=c)=>send(c,{type:'ack',requestId:e.requestId,action:e.type,callId:e.callId,inCall:state.inCall,muted:state.muted,sharing:state.sharing});
  const endCall=c=>Object.assign(c,{inCall:false,muted:true,sharing:false,callId:null});
  function rejectUpgrade(socket,status) {
    socket.end(`HTTP/1.1 ${status} ${status===404?'Not Found':status===403?'Forbidden':'Service Unavailable'}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`,()=>socket.destroy());
    const timer=setTimeout(()=>socket.destroy(),1000);timer.unref();socket.once('close',()=>clearTimeout(timer));
  }
  server.on('upgrade',(req,socket,head)=>{
    if(closing)return rejectUpgrade(socket,503);
    if(req.url!=='/ws'){
      if(developmentUpgrade?.(req,socket,head))return;
      return rejectUpgrade(socket,404);
    }
    if(clients.size>=LIMITS.connections)return rejectUpgrade(socket,503);
    const origin=req.headers.origin;
    if(origin&&!localOrigin(origin)&&(()=>{try{return new URL(origin).host!==req.headers.host;}catch{return true;}})())return rejectUpgrade(socket,403);
    wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws));
  });
  wss.on('connection',ws=>{
    const c={id:randomUUID(),ws,name:'',room:null,inCall:false,muted:true,sharing:false,callId:null,generation:0,lastPong:Date.now(),budgets:new Map()};
    clients.set(c.id,c);
    ws.on('error',cause=>logFailure('socket','CONNECTION_FAILED',null,cause));
    ws.on('pong',()=>{c.lastPong=Date.now();});
    send(c,{type:'hello',id:c.id,rooms:roomsQuery.all()});
    ws.on('message',raw=>{
      let e,requestId;
      try { const rawValue=JSON.parse(raw.toString()); if(typeof rawValue?.requestId==='string'&&rawValue.requestId.length<=128)requestId=rawValue.requestId; e=parseClientEvent(raw.toString()); }
      catch(cause){error(c,cause.code||'INVALID_EVENT',requestId);return;}
      if(closing)return error(c,'INVALID_EVENT',requestId,e.type);
      try {
        if(e.type==='call-join'&&e.generation<=c.generation&&!(c.inCall&&e.callId===c.callId&&e.generation===c.generation))return error(c,'INVALID_EVENT',requestId,e.type);
        const terminal=e.type==='call-leave'||(e.type==='media'&&e.sharing===false);
        if(!terminal){
          let budget=c.budgets.get(e.type);if(!budget||Date.now()-budget.at>=10000){budget={at:Date.now(),remaining:100};c.budgets.set(e.type,budget);}
          if(--budget.remaining<0)return error(c,'RATE_LIMITED',requestId,e.type);
        }
        if(e.type==='join'){
          const next=roomQuery.get(e.room);if(!next)return error(c,'INVALID_INPUT',requestId,e.type);
          const previous=c.room;endCall(c);Object.assign(c,{room:e.room,name:e.name.trim(),roomContext:requestId});
          send(c,{type:'joined',requestId,room:next,messages:history.all(c.room)});presence(previous);if(previous!==c.room)presence(c.room);return;
        }
        if(!c.room)return error(c,'INVALID_EVENT',requestId,e.type);
        if(e.type==='message'){
          // A retried committed operation is reconciled before checking current room.
          const existing=operationQuery.get(e.operationId),text=e.text.trim();
          if(existing){
            if(existing.room!==e.room||existing.text!==text)return error(c,'OPERATION_CONFLICT',requestId,e.type);
            return send(c,{type:'message-accepted',requestId,message:existing});
          }
          if(e.room!==c.room)return error(c,'ROOM_MISMATCH',requestId,e.type);
          let message;
          try {message=insert.get(randomUUID(),e.room,c.name,text,Date.now(),c.id,e.operationId);}
          catch(cause){logFailure('persistence','PERSISTENCE_FAILED',requestId,cause);return error(c,'PERSISTENCE_FAILED',requestId,e.type);}
          send(c,{type:'message-accepted',requestId,message});broadcast(c.room,{type:'message',message});
        }else if(e.type==='create-room'){
          if(roomsQuery.all().length>=LIMITS.rooms)return error(c,'INVALID_INPUT',requestId,e.type);
          const room={id:randomUUID(),name:e.name.trim(),description:'Um espaço para o seu grupo'};
          addRoom.run(room.id,room.name,room.description);
          send(c,{type:'room-created',requestId,room});for(const target of clients.values())send(target,{type:'rooms',rooms:roomsQuery.all()});
        }else if(e.type==='call-join'){
          if([...clients.values()].filter(x=>x.room===c.room&&x.inCall&&x!==c).length>=LIMITS.callMembers)return error(c,'CALL_FULL',requestId,e.type);
          Object.assign(c,{inCall:true,callId:e.callId,generation:e.generation,muted:e.muted,sharing:false});ack(c,e);presence(c.room);
        }else if(e.type==='call-leave'){
          if(c.callId===e.callId){endCall(c);presence(c.room);}
          ack(c,e,{inCall:false,muted:true,sharing:false});
        }else if(e.type==='media'){
          if(!c.inCall||e.callId!==c.callId)return error(c,'INVALID_EVENT',requestId,e.type);
          if(e.muted!==undefined)c.muted=e.muted;if(e.sharing!==undefined)c.sharing=e.sharing;
          ack(c,e);presence(c.room);
        }else if(e.type==='signal'){
          const target=clients.get(e.to);
          if(!c.inCall||c.callId!==e.callId||!target?.inCall||target.room!==c.room||target.callId!==e.toCallId)return error(c,'PARTICIPANT_UNAVAILABLE',requestId,e.type);
          send(target,{type:'signal',from:c.id,fromCallId:c.callId,callId:target.callId,signal:e.signal});
        }
      }catch(cause){logFailure(e.type,'INVALID_EVENT',requestId,cause);error(c,'INVALID_EVENT',requestId,e.type);}
    });
    ws.on('close',()=>{clients.delete(c.id);if(!closing)presence(c.room);});
  });
  const heartbeat=setInterval(()=>{
    for(const c of clients.values())if(Date.now()-c.lastPong>=60000){clients.delete(c.id);endCall(c);c.ws.terminate();presence(c.room);}else c.ws.ping();
  },30000);heartbeat.unref();
  return {app,server,wss,setDevelopmentUpgrade(handler){developmentUpgrade=handler;},close(){
    if(closePromise)return closePromise;
    closing=true;clearInterval(heartbeat);
    closePromise=(async()=>{
      let timer;
      try{
        const failures=[];
        for(const c of clients.values())try{c.ws.terminate();}catch(cause){failures.push(cause);}
        for(const socket of sockets)try{socket.destroy();}catch(cause){failures.push(cause);}
        const results=await Promise.race([
          Promise.allSettled([new Promise((resolve,reject)=>wss.close(cause=>cause?reject(cause):resolve())),new Promise((resolve,reject)=>server.close(cause=>cause&&cause.code!=='ERR_SERVER_NOT_RUNNING'?reject(cause):resolve()))]),
          new Promise((_,reject)=>{timer=setTimeout(()=>reject(new ProtocolError('SHUTDOWN_FAILED')),LIMITS.shutdownMs);}),
        ]);
        if(failures.length||results.some(r=>r.status==='rejected'))throw new ProtocolError('SHUTDOWN_FAILED');
      }catch(cause){logFailure('shutdown','SHUTDOWN_FAILED',null,cause);throw cause;}
      finally{clearTimeout(timer);db.close();}
    })();
    return closePromise;
  }};
}
