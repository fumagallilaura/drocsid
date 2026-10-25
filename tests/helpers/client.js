import { WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';
import { PROTOCOL_VERSION } from '../../shared/protocol.js';

export async function client(url, name = 'Ana', initialRoom = 'geral', options = {}) {
  const ws = new WebSocket(url, options), events = [], waiters = [];
  let room = initialRoom, callId = randomUUID(), generation = 1;
  const fail = error => { for (const w of waiters.splice(0)) { clearTimeout(w.timer); w.reject(error); } };
  ws.on('error', fail); ws.on('close', () => fail(new Error('WS closed')));
  ws.on('message', bytes => {
    const event = JSON.parse(bytes); const i = waiters.findIndex(w => w.matches(event));
    if (i >= 0) { const [w] = waiters.splice(i,1); clearTimeout(w.timer); w.resolve(event); }
    else { events.push(event); if (events.length > 256) events.shift(); }
  });
  const next = (type, match = () => true) => new Promise((resolve,reject) => {
    const matches = e => (Array.isArray(type) ? type.includes(e.type) : e.type === type) && match(e), i=events.findIndex(matches);
    if (i>=0) return resolve(events.splice(i,1)[0]);
    if (ws.readyState===WebSocket.CLOSED) return reject(new Error('WS closed'));
    const waiter={matches,resolve,reject}; waiter.timer=setTimeout(() => { waiters.splice(waiters.indexOf(waiter),1); reject(new Error(`Timeout ${type}`)); },2500); waiters.push(waiter);
  });
  const hello=await next('hello');
  const send = event => {
    if (event.type==='join') room=event.room;
    if (event.type==='call-join') { callId=event.callId || callId; generation=event.generation || generation; }
    const defaults={v:PROTOCOL_VERSION,requestId:randomUUID()};
    if(event.type==='message') Object.assign(defaults,{room,operationId:randomUUID()});
    if(event.type==='call-join') Object.assign(defaults,{callId,generation,muted:true});
    if(['call-leave','media','signal'].includes(event.type)) Object.assign(defaults,{callId,generation});
    if(event.type==='signal') defaults.toCallId=callIds.get(event.to) || 'not-admitted';
    const value={...defaults,...event}; callIds.set(hello.id,callId); ws.send(JSON.stringify(value)); return value.requestId;
  };
  callIds.set(hello.id,callId);
  send({type:'join',name,room}); await next('joined');
  ws.once('close',()=>callIds.delete(hello.id));
  return {ws,events,next,send,id:hello.id,get callId(){return callId;},request:async event=>{const id=send(event); return next(event.type==='message'?'message-accepted':event.type==='join'?'joined':event.type==='create-room'?'room-created':'ack', e=>e.requestId===id);}};
}
const callIds=new Map();
