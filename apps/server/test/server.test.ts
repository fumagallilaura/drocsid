import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.ts';
import { pool, migrate } from '../src/db.ts';
import { isPublicAddress, parseEmbed, unfurl } from '../src/embeds.ts';
import { Close, Op } from '../src/gateway.ts';
import { uploadPath } from '../src/uploads.ts';

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
  return { status: res.status, body: res.status === 204 ? null : await res.json() };
};
const post = (path: string, body: unknown, token?: string) => request('POST', path, body, token);

// Por padrão ignora eventos de presença e de novos membros, que chegam como efeito colateral de outros testes.
function connect(host = base, skip = ['PRESENCE_UPDATE', 'GUILD_MEMBER_ADD']) {
  const ws = new WebSocket(`ws://${host}/gateway`);
  const queue: any[] = [];
  const waiters: ((m: any) => void)[] = [];
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (skip.includes(msg.t)) return;
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
  assert.equal((await post('/api/auth/register', { username, password: 'senha-segura' })).status, 400);
  assert.equal((await post('/api/auth/register', { username, password: 'senha-segura', accept_terms: 'sim' })).status, 400);

  const reg = await post('/api/auth/register', { username, password: 'senha-segura', accept_terms: true });
  assert.equal(reg.status, 201);
  assert.equal(reg.body.user.username, username);
  assert.ok(reg.body.token);

  assert.equal((await post('/api/auth/register', { username, password: 'senha-segura', accept_terms: true })).status, 409);
  assert.equal((await post('/api/auth/register', { username: 'A B', password: 'senha-segura', accept_terms: true })).status, 400);
  assert.equal((await post('/api/auth/register', { username: uniqueName(), password: 'curta', accept_terms: true })).status, 400);

  const ok = await post('/api/auth/login', { username, password: 'senha-segura' });
  assert.equal(ok.status, 200);
  assert.notEqual(ok.body.token, reg.body.token);

  assert.equal((await post('/api/auth/login', { username, password: 'senha-errada' })).status, 401);
  assert.equal((await post('/api/auth/login', { username: uniqueName(), password: 'senha-segura' })).status, 401);
});

test('gateway: HELLO, IDENTIFY, READY e heartbeat', async () => {
  const { token, user } = (await post('/api/auth/register', { username: uniqueName(), password: 'senha-segura', accept_terms: true })).body;
  const gw = connect();

  const hello = await gw.next();
  assert.equal(hello.op, Op.HELLO);
  assert.equal(hello.d.heartbeat_interval, 41_250);

  gw.send(Op.IDENTIFY, { token });
  const ready = await gw.next();
  assert.deepEqual(ready, {
    op: Op.DISPATCH, t: 'READY', s: 1,
    d: { user, status: 'online', guilds: [], relationships: [], private_channels: [], presences: [] },
  });

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

async function signedIn(skip?: string[]) {
  const { token, user } = (await post('/api/auth/register', { username: uniqueName(), password: 'senha-segura', accept_terms: true })).body;
  const gw = connect(base, skip);
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
  assert.deepEqual(guild.channels.map((c: any) => `${c.type}:${c.name}`), ['text:geral', 'voice:geral']);
  assert.deepEqual(guild.members, [alice.user]);
  assert.deepEqual((await alice.gw.next()).d, {
    ...guild, voice_states: [], presences: [{ user: { id: alice.user.id }, status: 'online' }],
  });
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
    const event = await gw.next();
    assert.equal(event.t, 'CHANNEL_CREATE');
    assert.deepEqual(event.d, channel.body);
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
  assert.deepEqual(readyGuild.channels.map((c: any) => c.name), ['geral', 'geral', 'avisos']);
  alice.gw.close();
  bobAgain.close();
});

test('voz: entrar, repassar sinais WebRTC e sair', async () => {
  const alice = await signedIn();
  const bob = await signedIn();
  const carol = await signedIn();
  const guild = (await post('/api/guilds', { name: 'Call' }, alice.token)).body;
  await alice.gw.next();
  const [text, voiceChannel] = guild.channels;
  for (const who of [bob, carol]) {
    const { code } = (await post(`/api/guilds/${guild.id}/invites`, {}, alice.token)).body;
    await post(`/api/invites/${code}`, {}, who.token);
    await who.gw.next();
  }
  const other = (await post(`/api/guilds/${guild.id}/channels`, { name: 'sala-2', type: 'voice' }, alice.token)).body;
  assert.equal(other.type, 'voice');
  for (const who of [alice, bob, carol]) await who.gw.next();
  assert.equal((await post(`/api/channels/${voiceChannel.id}/messages`, { content: 'oi' }, alice.token)).status, 400);

  alice.gw.send(Op.VOICE_STATE_UPDATE, { channel_id: text.id });
  alice.gw.send(Op.VOICE_STATE_UPDATE, { channel_id: voiceChannel.id });
  const aliceIn = { guild_id: guild.id, channel_id: voiceChannel.id, user: alice.user };
  for (const who of [alice, bob, carol]) {
    const event = await who.gw.next();
    assert.equal(event.t, 'VOICE_STATE_UPDATE');
    assert.deepEqual(event.d, aliceIn);
  }
  bob.gw.send(Op.VOICE_STATE_UPDATE, { channel_id: voiceChannel.id });
  carol.gw.send(Op.VOICE_STATE_UPDATE, { channel_id: other.id });
  for (const who of [alice, bob, carol]) {
    const events = [(await who.gw.next()).d, (await who.gw.next()).d];
    assert.deepEqual(events.map((e) => `${e.user.username}:${e.channel_id}`).sort(), [
      `${bob.user.username}:${voiceChannel.id}`,
      `${carol.user.username}:${other.id}`,
    ].sort());
  }

  alice.gw.send(Op.VOICE_SIGNAL, { to: carol.user.id, data: 'nao-deveria-chegar' });
  alice.gw.send(Op.VOICE_SIGNAL, { to: bob.user.id, data: { description: { type: 'offer', sdp: 'x' } } });
  assert.deepEqual((await bob.gw.next()).d, { from: alice.user.id, data: { description: { type: 'offer', sdp: 'x' } } });

  const late = connect();
  await late.next();
  late.send(Op.IDENTIFY, { token: carol.token });
  const [lateGuild] = (await late.next()).d.guilds;
  assert.equal(lateGuild.voice_states.length, 3);
  late.close();

  bob.gw.close();
  for (const who of [alice, carol]) {
    assert.deepEqual((await who.gw.next()).d, { guild_id: guild.id, channel_id: null, user: bob.user });
  }

  const anon = connect();
  await anon.next();
  anon.send(Op.VOICE_STATE_UPDATE, { channel_id: voiceChannel.id });
  assert.equal(await anon.closed, Close.NOT_AUTHENTICATED);
  alice.gw.close();
  carol.gw.close();
});

test('amigos, presença e mensagens diretas', async () => {
  const alice = await signedIn([]);
  const bob = await signedIn([]);
  const carol = await signedIn();

  assert.equal((await post('/api/users/@me/relationships', { username: 'ninguem_aqui' }, alice.token)).status, 404);
  assert.equal((await post('/api/users/@me/relationships', { username: alice.user.username }, alice.token)).status, 400);
  assert.equal((await post('/api/users/@me/relationships', { username: bob.user.username }, alice.token)).status, 204);
  assert.deepEqual((await alice.gw.next()).d, { id: bob.user.id, type: 4, user: bob.user });
  assert.deepEqual((await bob.gw.next()).d, { id: alice.user.id, type: 3, user: alice.user });
  assert.equal((await request('PUT', `/api/users/@me/relationships/${bob.user.id}`, undefined, alice.token)).status, 404);

  assert.equal((await request('PUT', `/api/users/@me/relationships/${alice.user.id}`, undefined, bob.token)).status, 204);
  for (const [who, other] of [[alice, bob], [bob, alice]]) {
    assert.deepEqual((await who.gw.next()).d, { id: other.user.id, type: 1, user: other.user });
    assert.deepEqual((await who.gw.next()).d, { user: { id: other.user.id }, status: 'online' });
  }
  const list = await request('GET', '/api/users/@me/relationships', undefined, alice.token);
  assert.deepEqual(list.body, [{ id: bob.user.id, type: 1, user: bob.user }]);

  bob.gw.send(Op.PRESENCE_UPDATE, { status: 'dnd' });
  assert.deepEqual((await alice.gw.next()).d, { user: { id: bob.user.id }, status: 'dnd' });
  assert.deepEqual((await bob.gw.next()).d, { user: { id: bob.user.id }, status: 'dnd' });
  bob.gw.send(Op.PRESENCE_UPDATE, { status: 'invisible' });
  assert.deepEqual((await alice.gw.next()).d, { user: { id: bob.user.id }, status: 'offline' });
  assert.deepEqual((await bob.gw.next()).d, { user: { id: bob.user.id }, status: 'invisible' });

  assert.equal((await post('/api/users/@me/channels', { recipient_id: alice.user.id }, carol.token)).status, 403);
  const dm = await post('/api/users/@me/channels', { recipient_id: bob.user.id }, alice.token);
  assert.equal(dm.status, 200);
  assert.equal(dm.body.type, 'dm');
  assert.deepEqual(dm.body.recipients, [bob.user]);
  assert.equal((await alice.gw.next()).t, 'CHANNEL_CREATE');
  assert.deepEqual((await bob.gw.next()).d.recipients, [alice.user]);
  assert.deepEqual((await alice.gw.next()).d, { user: { id: bob.user.id }, status: 'offline' });
  assert.deepEqual((await bob.gw.next()).d, { user: { id: alice.user.id }, status: 'online' });
  assert.equal((await post('/api/users/@me/channels', { recipient_id: bob.user.id }, alice.token)).body.id, dm.body.id);

  const sent = await post(`/api/channels/${dm.body.id}/messages`, { content: 'oi na dm' }, bob.token);
  assert.equal(sent.status, 201);
  for (const who of [alice, bob]) assert.deepEqual((await who.gw.next()).d, sent.body);
  assert.equal((await request('GET', `/api/channels/${dm.body.id}/messages`, undefined, carol.token)).status, 404);

  const again = connect(base, []);
  await again.next();
  again.send(Op.IDENTIFY, { token: alice.token });
  const ready = (await again.next()).d;
  assert.deepEqual(ready.relationships, list.body);
  assert.deepEqual(ready.private_channels.map((c: any) => [c.id, c.last_message_id]), [[dm.body.id, sent.body.id]]);
  assert.deepEqual(ready.presences, [], 'bob está invisível');
  again.close();

  assert.equal((await request('DELETE', `/api/users/@me/relationships/${bob.user.id}`, undefined, alice.token)).status, 204);
  assert.deepEqual((await alice.gw.next()).d, { id: bob.user.id, type: 1 });
  assert.deepEqual((await bob.gw.next()).d, { id: alice.user.id, type: 1 });
  for (const who of [alice, bob, carol]) who.gw.close();
});

test('mensagens: menções, respostas, edição, reações, digitando e exclusão', async () => {
  const alice = await signedIn();
  const bob = await signedIn();
  const guild = (await post('/api/guilds', { name: 'Papo' }, alice.token)).body;
  await alice.gw.next();
  const { code } = (await post(`/api/guilds/${guild.id}/invites`, {}, alice.token)).body;
  await post(`/api/invites/${code}`, {}, bob.token);
  await bob.gw.next();
  const channel = guild.channels[0].id;
  const both = async () => Promise.all([alice.gw.next(), bob.gw.next()]);

  const hi = (await post(`/api/channels/${channel}/messages`, { content: `oi <@${alice.user.id}>` }, bob.token)).body;
  assert.deepEqual(hi.mentions, [alice.user]);
  await both();

  const reply = await post(`/api/channels/${channel}/messages`, { content: 'oi!', message_reference: { message_id: hi.id } }, alice.token);
  assert.deepEqual(reply.body.referenced_message, { id: hi.id, content: hi.content, author: bob.user });
  await both();

  const path = `/api/channels/${channel}/messages/${reply.body.id}`;
  assert.equal((await request('PATCH', path, { content: 'hackeado' }, bob.token)).status, 403);
  assert.equal((await request('PATCH', path, { content: ' ' }, alice.token)).status, 400);
  const edited = await request('PATCH', path, { content: 'oi, bob!' }, alice.token);
  assert.equal(edited.status, 200);
  assert.ok(edited.body.edited_timestamp);
  for (const event of await both()) {
    assert.equal(event.t, 'MESSAGE_UPDATE');
    assert.equal(event.d.content, 'oi, bob!');
  }

  const reaction = (emoji: string) => `${path}/reactions/${encodeURIComponent(emoji)}/@me`;
  assert.equal((await request('PUT', reaction('abc'), undefined, bob.token)).status, 400);
  assert.equal((await request('PUT', reaction('👍🏽'), undefined, bob.token)).status, 204);
  for (const event of await both()) {
    assert.equal(event.t, 'MESSAGE_REACTION_ADD');
    assert.deepEqual(event.d, { user_id: bob.user.id, channel_id: channel, message_id: reply.body.id, guild_id: guild.id, emoji: { name: '👍🏽' } });
  }
  const history = (await request('GET', `/api/channels/${channel}/messages`, undefined, alice.token)).body;
  assert.deepEqual(history.at(-1).reactions, [{ emoji: { name: '👍🏽' }, count: 1, me: false }]);
  assert.equal((await request('DELETE', reaction('👍🏽'), undefined, bob.token)).status, 204);
  assert.deepEqual((await both()).map((e) => e.t), ['MESSAGE_REACTION_REMOVE', 'MESSAGE_REACTION_REMOVE']);

  assert.equal((await post(`/api/channels/${channel}/typing`, {}, bob.token)).status, 204);
  for (const event of await both()) {
    assert.equal(event.t, 'TYPING_START');
    assert.equal(event.d.user_id, bob.user.id);
  }

  assert.equal((await request('DELETE', path, undefined, bob.token)).status, 403);
  assert.equal((await request('DELETE', `/api/channels/${channel}/messages/${hi.id}`, undefined, alice.token)).status, 204, 'dono do servidor apaga');
  for (const event of await both()) assert.deepEqual(event.d, { id: hi.id, channel_id: channel, guild_id: guild.id });
  alice.gw.close();
  bob.gw.close();
});

test('anexos: pedir URL, enviar, anexar e baixar', async () => {
  const alice = await signedIn();
  const guild = (await post('/api/guilds', { name: 'Arquivos' }, alice.token)).body;
  await alice.gw.next();
  const channel = guild.channels[0].id;
  const upload = async (filename: string, size: number) =>
    (await post(`/api/channels/${channel}/attachments`, { files: [{ filename, file_size: size }] }, alice.token));
  const put = (url: string, body: string, type = 'text/plain') =>
    fetch(`http://${base}${url}`, { method: 'PUT', headers: { authorization: alice.token, 'content-type': type }, body });

  assert.equal((await upload('grande.bin', 11 * 1024 * 1024)).status, 413);
  const tooLong = (await upload('a.txt', 2)).body.attachments[0];
  assert.equal((await put(tooLong.upload_url, 'muito mais que dois bytes')).status, 413);

  const { upload_url, upload_filename } = (await upload('../relatório<1>.txt', 5)).body.attachments[0];
  assert.equal((await put(upload_url, 'hello')).status, 200);
  assert.equal((await fetch(`http://${base}/cdn/attachments/${upload_filename}`)).status, 404, 'não é público antes de anexar');

  const sent = await post(`/api/channels/${channel}/messages`, { content: '', attachments: [{ uploaded_filename: upload_filename }] }, alice.token);
  assert.equal(sent.status, 201);
  const [file] = sent.body.attachments;
  assert.deepEqual(file, { id: upload_filename, filename: 'relatório_1_.txt', size: 5, content_type: 'text/plain', url: `/cdn/attachments/${upload_filename}` });
  assert.equal((await post(`/api/channels/${channel}/messages`, { content: 'de novo', attachments: [{ uploaded_filename: upload_filename }] }, alice.token)).status, 400);

  const download = await fetch(`http://${base}${file.url}`);
  assert.equal(await download.text(), 'hello');
  assert.equal(download.headers.get('content-type'), 'application/octet-stream');
  assert.match(download.headers.get('content-disposition')!, /^attachment;/);
  assert.equal(download.headers.get('x-content-type-options'), 'nosniff');

  await request('DELETE', `/api/channels/${channel}/messages/${sent.body.id}`, undefined, alice.token);
  assert.equal((await fetch(`http://${base}${file.url}`)).status, 404);
  alice.gw.close();
});

test('conta: exportar dados e excluir apaga mensagens, anexos e servidores próprios', async () => {
  const alice = await signedIn();
  const bob = await signedIn();
  const join = async (owner: typeof alice, member: typeof alice, name: string) => {
    const guild = (await post('/api/guilds', { name }, owner.token)).body;
    const { code } = (await post(`/api/guilds/${guild.id}/invites`, {}, owner.token)).body;
    await post(`/api/invites/${code}`, {}, member.token);
    return guild.channels.find((c: any) => c.type === 'text').id;
  };
  const aliceChannel = await join(alice, bob, 'Da Alice');
  const bobChannel = await join(bob, alice, 'Do Bob');

  await post(`/api/channels/${aliceChannel}/messages`, { content: 'do bob na casa da alice' }, bob.token);
  const slot = (await post(`/api/channels/${bobChannel}/attachments`, { files: [{ filename: 'a.txt', file_size: 2 }] }, alice.token)).body.attachments[0];
  await fetch(`http://${base}${slot.upload_url}`, { method: 'PUT', headers: { authorization: alice.token, 'content-type': 'text/plain' }, body: 'oi' });
  const withFile = (await post(`/api/channels/${bobChannel}/messages`, { content: 'da alice', attachments: [{ uploaded_filename: slot.upload_filename }] }, alice.token)).body;
  await post(`/api/channels/${bobChannel}/messages`, { content: 'do bob' }, bob.token);

  const exported = await request('GET', '/api/users/@me/data', undefined, alice.token);
  assert.equal(exported.status, 200);
  assert.equal(exported.body.account.username, alice.user.username);
  assert.ok(exported.body.account.terms_accepted_at);
  assert.deepEqual(exported.body.messages.map((m: any) => m.content), ['da alice']);
  assert.deepEqual(exported.body.guilds.map((g: any) => [g.name, g.owner]), [['Da Alice', true], ['Do Bob', false]]);
  assert.equal(exported.body.account.password_hash, undefined);

  assert.equal((await request('DELETE', '/api/users/@me', undefined, alice.token)).status, 204);
  assert.equal((await request('GET', '/api/users/@me/data', undefined, alice.token)).status, 401);
  assert.equal((await post('/api/auth/login', { username: alice.user.username, password: 'senha-segura' })).status, 401);
  assert.equal((await request('GET', `/api/channels/${aliceChannel}/messages`, undefined, bob.token)).status, 404, 'servidor da Alice some');
  const left = (await request('GET', `/api/channels/${bobChannel}/messages`, undefined, bob.token)).body;
  assert.deepEqual(left.map((m: any) => m.content), ['do bob']);
  assert.equal((await fetch(`http://${base}${withFile.attachments[0].url}`)).status, 404);
  assert.equal(existsSync(uploadPath(slot.upload_filename)), false, 'arquivo apagado do disco');
  alice.gw.close();
  bob.gw.close();
});

test('embeds: lê Open Graph e não acessa a rede interna', async () => {
  const embed = parseEmbed(
    `<head><title>Fallback</title><meta property="og:title" content="Drocsid &amp; amigos">
     <meta content='Chat brasileiro' name="description"><meta property="og:image" content="/capa.png"></head>`,
    new URL('https://exemplo.com.br/post'),
  );
  assert.deepEqual(embed, {
    type: 'link', url: 'https://exemplo.com.br/post', title: 'Drocsid & amigos', description: 'Chat brasileiro',
    site_name: undefined, image: { url: 'https://exemplo.com.br/capa.png' },
  });
  for (const ip of ['127.0.0.1', '10.0.0.5', '169.254.169.254', '192.168.1.1', '::1', 'fd00::1', '::ffff:127.0.0.1']) {
    assert.equal(isPublicAddress(ip), false, ip);
  }
  assert.equal(isPublicAddress('8.8.8.8'), true);
  assert.deepEqual(await unfurl(`veja http://localhost:${base.split(':')[1]}/ e http://127.0.0.1/ e http://[::1]/`), []);
});

test('gateway: fecha a sessão se o heartbeat não chegar', async () => {
  const gw = connect(fastBase);
  assert.equal((await gw.next()).d.heartbeat_interval, 50);
  assert.equal(await gw.closed, Close.SESSION_TIMED_OUT);
});
