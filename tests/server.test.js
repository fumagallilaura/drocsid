import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { createService } from '../server/service.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function start(dbPath = ':memory:') {
  const service = createService({ dbPath, iceServers: [] });
  await new Promise(resolve => service.server.listen(0, '127.0.0.1', resolve));
  return { ...service, url: `ws://127.0.0.1:${service.server.address().port}/ws` };
}
async function client(url, name, room = 'geral') {
  const ws = new WebSocket(url), events = [], waiters = [];
  ws.on('message', bytes => {
    const event = JSON.parse(bytes);
    const i = waiters.findIndex(w => w.predicate(event));
    if (i >= 0) { const [w] = waiters.splice(i, 1); clearTimeout(w.timer); w.resolve(event); }
    else events.push(event);
  });
  const next = (type, match = () => true) => new Promise((resolve, reject) => {
    const predicate = e => e.type === type && match(e);
    const i = events.findIndex(predicate);
    if (i >= 0) return resolve(events.splice(i, 1)[0]);
    const entry = { predicate, resolve, timer: setTimeout(() => { waiters.splice(waiters.indexOf(entry), 1); reject(new Error(`Timeout waiting for ${type}`)); }, 2500) };
    waiters.push(entry);
  });
  const send = event => ws.send(JSON.stringify(event));
  const hello = await next('hello');
  send({ type: 'join', name, room });
  await next('joined');
  return { ws, send, next, id: hello.id };
}

test('group messages, room isolation, signaling authorization and disconnect cleanup', async t => {
  const service = await start(); t.after(() => service.close());
  const ana = await client(service.url, 'Ana');
  const bia = await client(service.url, 'Bia');
  const caio = await client(service.url, 'Caio', 'cafe');
  ana.send({ type: 'message', text: 'Olá, grupo!' });
  assert.equal((await bia.next('message')).message.text, 'Olá, grupo!');
  assert.equal((await ana.next('message')).message.author, 'Ana');
  ana.send({ type: 'call-join', muted: false });
  bia.send({ type: 'call-join', muted: true });
  await ana.next('presence', e => e.members.filter(m => m.inCall).length === 2);
  ana.send({ type: 'signal', to: bia.id, signal: { description: { type: 'offer', sdp: 'test' } } });
  assert.equal((await bia.next('signal')).from, ana.id);
  ana.send({ type: 'signal', to: caio.id, signal: { candidate: { candidate: 'test' } } });
  assert.match((await ana.next('error')).message, /indisponível/);
  bia.send({ type: 'join', name: 'Bia', room: 'cafe' });
  const newRoom = await bia.next('joined');
  assert.equal(newRoom.messages.length, 0);
  await ana.next('presence', e => e.members.length === 1);
  ana.send({ type: 'message', text: 'x'.repeat(2001) });
  assert.match((await ana.next('error')).message, /2000/);
  ana.send({ type: 'message', text: '   ' });
  await ana.next('error');
});

test('messages and custom rooms survive a server restart', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'conversa-test-'));
  const dbPath = join(directory, 'test.sqlite');
  let service = await start(dbPath);
  t.after(async () => { await service.close(); rmSync(directory, { recursive: true, force: true }); });
  const ana = await client(service.url, 'Ana');
  ana.send({ type: 'create-room', name: 'Estúdio' });
  const { room } = await ana.next('room-created');
  ana.send({ type: 'join', name: 'Ana', room: room.id }); await ana.next('joined');
  ana.send({ type: 'message', text: 'Persistiu!' }); await ana.next('message');
  await service.close();
  service = await start(dbPath);
  const bia = await client(service.url, 'Bia', room.id);
  bia.send({ type: 'join', name: 'Bia', room: room.id });
  assert.equal((await bia.next('joined')).messages[0].text, 'Persistiu!');
});

test('calls enforce a six-person limit and free a slot on departure', async t => {
  const service = await start(); t.after(() => service.close());
  const people = [];
  for (let i = 0; i < 7; i++) people.push(await client(service.url, `Pessoa ${i}`));
  for (const person of people.slice(0, 6)) {
    person.send({ type: 'call-join' });
    await person.next('presence', e => e.members.find(m => m.id === person.id)?.inCall);
  }
  people[6].send({ type: 'call-join' });
  assert.match((await people[6].next('error')).message, /cheia/);
  people[0].send({ type: 'call-leave' });
  await people[0].next('presence', e => !e.members.find(m => m.id === people[0].id)?.inCall);
  people[6].send({ type: 'call-join' });
  await people[6].next('presence', e => e.members.find(m => m.id === people[6].id)?.inCall);
});
