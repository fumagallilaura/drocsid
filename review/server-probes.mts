import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { connect } from 'node:net';
import type {Socket} from 'node:net';
import { WebSocket } from 'ws';
import { createService } from '../server/service.js';
import {createPostgresFixture} from '../tests/helpers/postgres.js';
import {testPort} from '../tests/helpers/service.js';
import {required} from '../tests/helpers/assertions.js';
import {parseServerEvent,readIceServers} from '../shared/protocol.js';
import type {ServerEvent} from '../shared/protocol.js';

// Historical defect reproducer. Its assertions are not a health gate of HEAD.

const results = [];
const postgres=await createPostgresFixture();
const service = await createService({database:await postgres.open(),trustedLocal:true, iceServers: [{ urls: 'turn:example.invalid:3478', username: 'review-dummy', credential: 'review-dummy-not-a-secret' }] });
const rawSockets = new Set<Socket>();
service.server.on('connection', socket => { rawSockets.add(socket); socket.on('close', () => rawSockets.delete(socket)); });
await new Promise<void>(resolve => service.server.listen(0, '127.0.0.1', resolve));
const port = testPort(service.server);
async function client(origin?:string) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, origin ? { origin } : undefined);
  type Waiter={predicate(event:ServerEvent):boolean;resolve(event:ServerEvent):void;timer:ReturnType<typeof setTimeout>};
  const events:ServerEvent[] = [], waiters:Waiter[] = [];
  ws.on('error', () => {});
  ws.on('message', raw => {
    const data = parseServerEvent(raw.toString());
    const index = waiters.findIndex(w => w.predicate(data));
    if (index >= 0) { const [w] = waiters.splice(index, 1); clearTimeout(w.timer); w.resolve(data); } else events.push(data);
  });
  const next = <T extends ServerEvent['type'],>(type:T, match:(event:Extract<ServerEvent,{type:T}>)=>unknown = () => true) => new Promise<Extract<ServerEvent,{type:T}>>((resolve, reject) => {
    const selected=(event:ServerEvent):event is Extract<ServerEvent,{type:T}>=>event.type===type;
    const predicate = (e:ServerEvent):e is Extract<ServerEvent,{type:T}> => selected(e)&&!!match(e), index = events.findIndex(predicate);
    if (index >= 0){const event=events.splice(index, 1)[0];if(predicate(event))resolve(event);return;}
    const waiter:Waiter = { predicate, resolve:event=>{if(predicate(event))resolve(event);}, timer: setTimeout(() => { waiters.splice(waiters.indexOf(waiter), 1); reject(new Error(`No ${type}`)); }, 1500) };
    waiters.push(waiter);
  });
  const send = (e:Record<string,unknown>) => ws.send(JSON.stringify(e));
  const hello = await next('hello');
  return { ws, id: hello.id, next, send, hello };
}
try {
  const a = await client();
  a.send({ type: 'join', name: 'Administrador', room: 'geral' }); await a.next('joined');
  a.send({ type: 'message', text: 'review-only-message' }); await a.next('message');
  const b = await client();
  b.send({ type: 'join', name: 'Administrador', room: 'geral' });
  const joined = await b.next('joined');
  assert.equal(joined.messages[0].text, 'review-only-message');
  results.push({ id: 'SRV-01', confirmed: true, observation: 'An unauthenticated client without Origin can list rooms, reuse another display name and read its room history.', roomsBeforeJoin: b.hello.rooms.length, historyRead: joined.messages.length });

  const response = await fetch(`http://127.0.0.1:${port}/api/config`);
  const body:unknown=await response.json();assert.ok(body!==null&&typeof body==='object'&&'iceServers' in body);const config={iceServers:readIceServers(body.iceServers)};
  assert.equal(config.iceServers[0].credential, 'review-dummy-not-a-secret');
  results.push({ id: 'SRV-02', confirmed: true, observation: 'ICE configuration including a configured TURN credential is returned without authentication. Probe used dummy credentials only.' });

  const localOriginClient = await client('http://localhost:59999');
  results.push({ id: 'SRV-03', confirmed: true, observation: 'A different localhost Origin is accepted, including arbitrary ports; Origin is not an access boundary.' });
  localOriginClient.ws.close();

  a.send({ type: 'call-join' }); b.send({ type: 'call-join' });
  await a.next('presence', e => e.members.filter(m => m.inCall).length === 2);
  a.send({ type: 'signal', to: b.id, signal: { candidate: 'not-an-ICE-object' } });
  assert.equal((await b.next('signal')).signal.candidate, 'not-an-ICE-object');
  for (let i = 0; i < 100; i++) a.send({ type: 'signal', to: b.id, signal: { candidate: { candidate: `review-${i}` } } });
  await a.next('error', e => e.message.includes('Muitas'));
  a.send({ type: 'call-leave' });
  const rateError = await a.next('error', e => e.message.includes('Muitas'));
  b.send({ type: 'media', muted: true });
  const presence = await b.next('presence', e => e.members.find(m => m.id === a.id)?.inCall === true);
  assert.equal(required(presence.members.find(m => m.id === a.id)).inCall, true);
  results.push({ id: 'SRV-04', confirmed: true, observation: 'Malformed ICE is forwarded. All event types share one rate budget; after enough signaling, call-leave is rejected and the participant remains inCall server-side.', leaveRejected: !!rateError });

  const socket = connect(port, '127.0.0.1');
  await new Promise<void>(resolve => socket.once('connect', resolve));
  let bytes = 0; socket.on('data', chunk => { bytes += chunk.length; });
  socket.write(`GET /unused-upgrade HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n`);
  await new Promise(resolve => setTimeout(resolve, 250));
  assert.equal(socket.destroyed, false); assert.equal(bytes, 0);
  let shutdownFinished = false;
  const shutdown = service.close().then(() => { shutdownFinished = true; });
  await new Promise(resolve => setTimeout(resolve, 250));
  const delayedShutdown = !shutdownFinished;
  socket.destroy();
  for (const accepted of rawSockets) accepted.destroy();
  await shutdown;
  results.push({ id: 'SRV-05', confirmed: true, observation: 'Unknown Upgrade path gets no response and keeps a socket open. Service shutdown waits until the external socket is destroyed.', bytesReturned: bytes, delayedShutdown });
} catch (error) {
  await service.close().catch(() => {}); throw error;
} finally {
  try{await service.close();}finally{await postgres.close();}
}
writeFileSync(new URL('server-probes.json', import.meta.url), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
