import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.ts';
import { pool, migrate } from '../src/db.ts';
import { Close, Op } from '../src/gateway.ts';

const app = createApp();
const fastApp = createApp({ heartbeatInterval: 50 });
let base = '';
let fastBase = '';

const listen = (server: typeof app) =>
  new Promise<string>((resolve) =>
    server.listen(0, () => resolve(`localhost:${(server.address() as AddressInfo).port}`)),
  );

before(async () => {
  await migrate();
  base = await listen(app);
  fastBase = await listen(fastApp);
});

after(async () => {
  app.close();
  fastApp.close();
  await pool.end();
});

const uniqueName = () => `user_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const post = async (path: string, body: unknown) => {
  const res = await fetch(`http://${base}${path}`, { method: 'POST', body: JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
};

function connect(host = base) {
  const ws = new WebSocket(`ws://${host}/gateway`);
  const queue: any[] = [];
  const waiters: ((m: any) => void)[] = [];
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    const waiter = waiters.shift();
    waiter ? waiter(msg) : queue.push(msg);
  };
  return {
    next: () => (queue.length ? Promise.resolve(queue.shift()) : new Promise<any>((r) => waiters.push(r))),
    send: (op: number, d: unknown) => ws.send(JSON.stringify({ op, d })),
    closed: new Promise<number>((r) => (ws.onclose = (e) => r(e.code))),
    close: () => ws.close(),
  };
}

test('cadastro, login e rejeições', async () => {
  const username = uniqueName();
  const reg = await post('/api/auth/register', { username, password: 'senha-segura' });
  assert.equal(reg.status, 201);
  assert.equal(reg.body.user.username, username);
  assert.ok(reg.body.token);

  assert.equal((await post('/api/auth/register', { username, password: 'senha-segura' })).status, 409);
  assert.equal((await post('/api/auth/register', { username: 'A B', password: 'senha-segura' })).status, 400);
  assert.equal((await post('/api/auth/register', { username: uniqueName(), password: 'curta' })).status, 400);

  const ok = await post('/api/auth/login', { username, password: 'senha-segura' });
  assert.equal(ok.status, 200);
  assert.notEqual(ok.body.token, reg.body.token);

  assert.equal((await post('/api/auth/login', { username, password: 'senha-errada' })).status, 401);
  assert.equal((await post('/api/auth/login', { username: uniqueName(), password: 'senha-segura' })).status, 401);
});

test('gateway: HELLO, IDENTIFY, READY e heartbeat', async () => {
  const { token, user } = (await post('/api/auth/register', { username: uniqueName(), password: 'senha-segura' })).body;
  const gw = connect();

  const hello = await gw.next();
  assert.equal(hello.op, Op.HELLO);
  assert.equal(hello.d.heartbeat_interval, 41_250);

  gw.send(Op.IDENTIFY, { token });
  const ready = await gw.next();
  assert.deepEqual(ready, { op: Op.DISPATCH, t: 'READY', s: 1, d: { user } });

  gw.send(Op.HEARTBEAT, 1);
  assert.deepEqual(await gw.next(), { op: Op.HEARTBEAT_ACK, d: null });

  gw.send(Op.IDENTIFY, { token });
  assert.equal(await gw.closed, Close.ALREADY_AUTHENTICATED);
});

test('gateway: token inválido e opcode desconhecido fecham a conexão', async () => {
  const bad = connect();
  await bad.next();
  bad.send(Op.IDENTIFY, { token: 'nao-existe' });
  assert.equal(await bad.closed, Close.AUTHENTICATION_FAILED);

  const unknown = connect();
  await unknown.next();
  unknown.send(99, null);
  assert.equal(await unknown.closed, Close.UNKNOWN_OPCODE);
});

test('gateway: fecha a sessão se o heartbeat não chegar', async () => {
  const gw = connect(fastBase);
  assert.equal((await gw.next()).d.heartbeat_interval, 50);
  assert.equal(await gw.closed, Close.SESSION_TIMED_OUT);
});
