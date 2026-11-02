import { WebSocket } from 'ws';
import type { ClientOptions } from 'ws';
import { randomUUID } from 'node:crypto';
import { PROTOCOL_VERSION, parseServerEvent } from '../../shared/protocol.js';
import type { ServerEvent } from '../../shared/protocol.js';

type Kind = ServerEvent['type'];
type Selected<T extends string> = Extract<ServerEvent,{type:T}>;
type Action = Record<string,unknown> & {type:string};
type Waiter = {matches(event:ServerEvent):boolean;resolve(event:ServerEvent):void;reject(error:unknown):void;timer:ReturnType<typeof setTimeout>};
const callIds=new Map<string,string>();
function selected<T extends string>(event:ServerEvent,types:T[]):event is Selected<T> { return types.some(type=>event.type===type); }

export async function client(url:string,name='Ana',initialRoom:string|null='geral',options:ClientOptions={}) {
  const ws=new WebSocket(url,options),events:ServerEvent[]=[],waiters:Waiter[]=[];
  let room=initialRoom,callId:string=randomUUID(),generation=1;
  const fail=(error:unknown)=>{for(const waiter of waiters.splice(0)){clearTimeout(waiter.timer);waiter.reject(error);}};
  ws.on('error',fail);ws.on('close',()=>fail(new Error('WS closed')));
  ws.on('message',bytes=>{
    let event:ServerEvent;try{event=parseServerEvent(bytes.toString());}catch(error){fail(error);ws.terminate();return;}
    const index=waiters.findIndex(waiter=>waiter.matches(event));
    if(index>=0){const [waiter]=waiters.splice(index,1);clearTimeout(waiter.timer);waiter.resolve(event);}
    else{events.push(event);if(events.length>256)events.shift();}
  });
  function next<T extends string>(type:T|T[],match:(event:Selected<T>)=>unknown=()=>true):Promise<Selected<T>> {
    return new Promise((resolve,reject)=>{
      const types=Array.isArray(type)?type:[type];
      const matches=(event:ServerEvent):event is Selected<T>=>selected(event,types)&&!!match(event);
      const index=events.findIndex(matches);
      if(index>=0){const [event]=events.splice(index,1);if(matches(event))resolve(event);return;}
      if(ws.readyState===WebSocket.CLOSED){reject(new Error('WS closed'));return;}
      const waiter:Waiter={matches,resolve:event=>{if(matches(event))resolve(event);},reject,timer:setTimeout(()=>{const index=waiters.indexOf(waiter);if(index>=0)waiters.splice(index,1);reject(new Error(`Timeout ${type}`));},2500)};
      waiters.push(waiter);
    });
  }
  const hello=await next('hello');
  const send=(event:Action):string=>{
    if(event.type==='join'&&typeof event.room==='string')room=event.room;
    if(event.type==='call-join'){if(typeof event.callId==='string')callId=event.callId;if(typeof event.generation==='number')generation=event.generation;}
    const defaults:Record<string,unknown>={v:PROTOCOL_VERSION,requestId:randomUUID()};
    if(event.type==='message')Object.assign(defaults,{room,operationId:randomUUID()});
    if(event.type==='call-join')Object.assign(defaults,{callId,generation,muted:true});
    if(['call-leave','media','signal'].includes(event.type))Object.assign(defaults,{callId,generation});
    if(event.type==='signal')defaults.toCallId=typeof event.to==='string'?callIds.get(event.to)??'not-admitted':'not-admitted';
    const value={...defaults,...event};callIds.set(hello.id,callId);ws.send(JSON.stringify(value));
    if(typeof value.requestId!=='string')throw new Error('Test request requires a requestId');return value.requestId;
  };
  callIds.set(hello.id,callId);
  if(room!==null){send({type:'join',name,room});await next('joined');}
  ws.once('close',()=>callIds.delete(hello.id));
  function request(event:Action&{type:'message'}):Promise<Selected<'message-accepted'>>;
  function request(event:Action&{type:'join'}):Promise<Selected<'joined'>>;
  function request(event:Action&{type:'create-room'}):Promise<Selected<'room-created'>>;
  function request(event:Action):Promise<Selected<'ack'|'message-accepted'|'joined'|'room-created'>>;
  function request(event:Action){const id=send(event);return next(event.type==='message'?'message-accepted':event.type==='join'?'joined':event.type==='create-room'?'room-created':'ack',event=>event.requestId===id);}
  return {ws,events,next,send,id:hello.id,hello,get callId(){return callId;},request};
}
