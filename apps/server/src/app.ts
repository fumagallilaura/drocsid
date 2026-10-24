import { createServer, type IncomingMessage } from 'node:http';
import { authenticate, HttpError, login, register } from './auth.ts';
import { createGateway } from './gateway.ts';
import {
  acceptInvite,
  createChannel,
  createGuild,
  createInvite,
  createMessage,
  listMessages,
  memberIds,
} from './guilds.ts';

const MAX_BODY = 10_000;

async function readJson(req: IncomingMessage) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > MAX_BODY) throw new HttpError(413, 'Corpo da requisição muito grande');
  }
  try {
    return JSON.parse(body) ?? {};
  } catch {
    throw new HttpError(400, 'JSON inválido');
  }
}

type Route = [method: string, path: RegExp, handler: (req: IncomingMessage, params: string[]) => Promise<[number, unknown]>];

export function createApp({ heartbeatInterval = 41_250 } = {}) {
  const { wss, dispatchTo } = createGateway(heartbeatInterval);
  const auth = (req: IncomingMessage) => authenticate(req.headers.authorization);

  const routes: Route[] = [
    ['POST', /^\/api\/auth\/register$/, async (req) => {
      const { username, password } = await readJson(req);
      return [201, await register(username, password)];
    }],
    ['POST', /^\/api\/auth\/login$/, async (req) => {
      const { username, password } = await readJson(req);
      return [200, await login(username, password)];
    }],
    ['POST', /^\/api\/guilds$/, async (req) => {
      const user = await auth(req);
      const guild = await createGuild(user, (await readJson(req)).name);
      dispatchTo([user.id], 'GUILD_CREATE', guild);
      return [201, guild];
    }],
    ['POST', /^\/api\/guilds\/(\d{1,18})\/channels$/, async (req, [guildId]) => {
      const user = await auth(req);
      const channel = await createChannel(user, guildId, (await readJson(req)).name);
      dispatchTo(await memberIds(guildId), 'CHANNEL_CREATE', channel);
      return [201, channel];
    }],
    ['POST', /^\/api\/guilds\/(\d{1,18})\/invites$/, async (req, [guildId]) => {
      return [201, await createInvite(await auth(req), guildId)];
    }],
    ['POST', /^\/api\/invites\/([\w-]{1,32})$/, async (req, [code]) => {
      const user = await auth(req);
      const { guild, joined } = await acceptInvite(user, code);
      if (joined) dispatchTo([user.id], 'GUILD_CREATE', guild);
      return [200, guild];
    }],
    ['GET', /^\/api\/channels\/(\d{1,18})\/messages$/, async (req, [channelId]) => {
      return [200, await listMessages(await auth(req), channelId)];
    }],
    ['POST', /^\/api\/channels\/(\d{1,18})\/messages$/, async (req, [channelId]) => {
      const user = await auth(req);
      const { guildId, message } = await createMessage(user, channelId, (await readJson(req)).content);
      dispatchTo(await memberIds(guildId), 'MESSAGE_CREATE', message);
      return [201, message];
    }],
  ];

  const server = createServer(async (req, res) => {
    const json = (status: number, body: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    try {
      for (const [method, path, handler] of routes) {
        const match = req.method === method && path.exec(req.url ?? '');
        if (match) return json(...(await handler(req, match.slice(1))));
      }
      json(404, { error: 'Não encontrado' });
    } catch (err) {
      if (err instanceof HttpError) return json(err.status, { error: err.message });
      console.error(err);
      json(500, { error: 'Erro interno' });
    }
  });

  server.on('upgrade', (req, socket, head) => {
    if (req.url !== '/gateway') return socket.destroy();
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  return server;
}
