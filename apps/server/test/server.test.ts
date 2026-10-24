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

const request = async (method: string, path: string, body?: unknown, token?: string) => {
  const res = await fetch(`http://${base}${path}`, {
    method,
    headers: token ? { authorization: token } : {},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};
const post = (path: string, body: unknown, token?: string) => request('POST', path, body, token);

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
  assert.deepEqual(ready, { op: Op.DISPATCH, t: 'READY', s: 1, d: { user, guilds: [] } });

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

async function signedIn() {
  const { token, user } = (await post('/api/auth/register', { username: uniqueName(), password: 'senha-segura' })).body;
  const gw = connect();
  await gw.next();
  gw.send(Op.IDENTIFY, { token });
  const ready = await gw.next();
  return { token, user, gw, ready };
}

test('servidores, canais, convites e mensagens em tempo real', async () => {
  const alice = await signedIn();
  const bob = await signedIn();

  const created = await post('/api/guilds', { name: 'Casa' }, alice.token);
  assert.equal(created.status, 201);
  const guild = created.body;
  assert.equal(guild.owner_id, alice.user.id);
  assert.deepEqual(guild.channels.map((c: any) => c.name), ['geral']);
  assert.deepEqual((await alice.gw.next()).d, guild);
  const geral = guild.channels[0].id;

  assert.equal((await post('/api/guilds', { name: 'Casa' })).status, 401);
  assert.equal((await post('/api/guilds', { name: '  ' }, alice.token)).status, 400);
  assert.equal((await request('GET', `/api/channels/${geral}/messages`, undefined, bob.token)).status, 404);
  assert.equal((await post(`/api/channels/${geral}/messages`, { content: 'oi' }, bob.token)).status, 404);
  assert.equal((await post(`/api/guilds/${guild.id}/invites`, {}, bob.token)).status, 404);

  const invite = await post(`/api/guilds/${guild.id}/invites`, {}, alice.token);
  assert.equal(invite.status, 201);
  assert.equal((await post('/api/invites/nao-existe', {}, bob.token)).status, 404);
  const joined = await post(`/api/invites/${invite.body.code}`, {}, bob.token);
  assert.equal(joined.status, 200);
  assert.equal(joined.body.id, guild.id);
  const bobGuildCreate = await bob.gw.next();
  assert.equal(bobGuildCreate.t, 'GUILD_CREATE');
  assert.equal(bobGuildCreate.d.id, guild.id);

  assert.equal((await post(`/api/guilds/${guild.id}/channels`, { name: 'avisos' }, bob.token)).status, 403);
  assert.equal((await post(`/api/guilds/${guild.id}/channels`, { name: 'Com Espaço' }, alice.token)).status, 400);
  const channel = await post(`/api/guilds/${guild.id}/channels`, { name: 'avisos' }, alice.token);
  assert.equal(channel.status, 201);
  for (const gw of [alice.gw, bob.gw]) {
    assert.deepEqual(await gw.next(), { op: Op.DISPATCH, t: 'CHANNEL_CREATE', s: 3, d: channel.body });
  }

  assert.equal((await post(`/api/channels/${geral}/messages`, { content: ' ' }, bob.token)).status, 400);
  const sent = await post(`/api/channels/${geral}/messages`, { content: 'oi, alice!' }, bob.token);
  assert.equal(sent.status, 201);
  assert.equal(sent.body.content, 'oi, alice!');
  assert.deepEqual(sent.body.author, bob.user);
  for (const gw of [alice.gw, bob.gw]) {
    const event = await gw.next();
    assert.equal(event.t, 'MESSAGE_CREATE');
    assert.deepEqual(event.d, sent.body);
  }

  const history = await request('GET', `/api/channels/${geral}/messages`, undefined, alice.token);
  assert.deepEqual(history.body, [sent.body]);

  bob.gw.close();
  const bobAgain = connect();
  await bobAgain.next();
  bobAgain.send(Op.IDENTIFY, { token: bob.token });
  const [readyGuild] = (await bobAgain.next()).d.guilds;
  assert.deepEqual(readyGuild.channels.map((c: any) => c.name), ['geral', 'avisos']);
  alice.gw.close();
  bobAgain.close();
});

test('gateway: fecha a sessão se o heartbeat não chegar', async () => {
  const gw = connect(fastBase);
  assert.equal((await gw.next()).d.heartbeat_interval, 50);
  assert.equal(await gw.closed, Close.SESSION_TIMED_OUT);
});
