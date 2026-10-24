import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { authenticate, HttpError, login, register } from './auth.ts';
import { unfurl } from './embeds.ts';
import { createGateway } from './gateway.ts';
import {
  acceptInvite,
  channelRecipients,
  createChannel,
  createGuild,
  createInvite,
  createMessage,
  deleteMessage,
  editMessage,
  listMessages,
  memberChannel,
  memberIds,
  react,
  setEmbeds,
} from './guilds.ts';
import {
  acceptFriendRequest,
  openDm,
  privateChannelsFor,
  Relationship,
  relationshipsFor,
  removeRelationship,
  sendFriendRequest,
} from './social.ts';
import { createUploads, receiveUpload, serveAttachment } from './uploads.ts';

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

type Handler = (req: IncomingMessage, params: string[], res: ServerResponse) => Promise<[number, unknown] | void>;
type Route = [method: string, path: RegExp, handler: Handler];

export function createApp({ heartbeatInterval = 41_250 } = {}) {
  const { wss, dispatchTo, voiceStates, presenceOf, presences } = createGateway(heartbeatInterval);
  const auth = (req: IncomingMessage) => authenticate(req.headers.authorization);
  const dispatchAll = (events: [string, string, unknown][]) => events.forEach(([id, t, d]) => dispatchTo([id], t, d));
  const toChannel = async (channelId: string, t: string, d: unknown) => dispatchTo(await channelRecipients(channelId), t, d);

  // Igual ao Discord: a mensagem sai na hora e as prévias de links chegam depois num MESSAGE_UPDATE.
  function unfurlLater(message: { id: string; channel_id: string; content: string; embeds: unknown[] }) {
    unfurl(message.content)
      .then(async (embeds) => {
        if (!embeds.length && !message.embeds.length) return;
        if (await setEmbeds(message.id, message.content, embeds)) {
          await toChannel(message.channel_id, 'MESSAGE_UPDATE', { id: message.id, channel_id: message.channel_id, embeds });
        }
      })
      .catch(console.error);
  }

  // Quem acabou de se conectar (amizade, DM ou servidor) passa a ver a presença do outro.
  function exchangePresence(a: string, b: string) {
    dispatchTo([b], 'PRESENCE_UPDATE', presenceOf(a));
    dispatchTo([a], 'PRESENCE_UPDATE', presenceOf(b));
  }

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
      dispatchTo([user.id], 'GUILD_CREATE', { ...guild, voice_states: [], presences: presences([user.id]) });
      return [201, guild];
    }],
    ['POST', /^\/api\/guilds\/(\d{1,18})\/channels$/, async (req, [guildId]) => {
      const user = await auth(req);
      const { name, type } = await readJson(req);
      const channel = await createChannel(user, guildId, name, type);
      dispatchTo(await memberIds(guildId), 'CHANNEL_CREATE', channel);
      return [201, channel];
    }],
    ['POST', /^\/api\/guilds\/(\d{1,18})\/invites$/, async (req, [guildId]) => {
      return [201, await createInvite(await auth(req), guildId)];
    }],
    ['POST', /^\/api\/invites\/([\w-]{1,32})$/, async (req, [code]) => {
      const user = await auth(req);
      const { guild, joined } = await acceptInvite(user, code);
      if (joined) {
        const ids = guild.members.map((m) => m.id);
        dispatchTo([user.id], 'GUILD_CREATE', { ...guild, voice_states: voiceStates(guild.id), presences: presences(ids) });
        const others = ids.filter((id) => id !== user.id);
        dispatchTo(others, 'GUILD_MEMBER_ADD', { guild_id: guild.id, user });
        dispatchTo(others, 'PRESENCE_UPDATE', presenceOf(user.id));
      }
      return [200, guild];
    }],

    ['GET', /^\/api\/users\/@me\/relationships$/, async (req) => [200, await relationshipsFor((await auth(req)).id)]],
    ['POST', /^\/api\/users\/@me\/relationships$/, async (req) => {
      const user = await auth(req);
      const events = await sendFriendRequest(user, (await readJson(req)).username);
      dispatchAll(events);
      const friend = events.find(([, , d]: any) => d.type === Relationship.FRIEND);
      if (friend) exchangePresence(user.id, (friend[2] as any).id);
      return [204, null];
    }],
    ['PUT', /^\/api\/users\/@me\/relationships\/(\d{1,18})$/, async (req, [peerId]) => {
      const user = await auth(req);
      dispatchAll(await acceptFriendRequest(user, peerId));
      exchangePresence(user.id, peerId);
      return [204, null];
    }],
    ['DELETE', /^\/api\/users\/@me\/relationships\/(\d{1,18})$/, async (req, [peerId]) => {
      dispatchAll(await removeRelationship(await auth(req), peerId));
      return [204, null];
    }],
    ['POST', /^\/api\/users\/@me\/channels$/, async (req) => {
      const user = await auth(req);
      const recipientId = (await readJson(req)).recipient_id;
      const { id, created } = await openDm(user, recipientId);
      if (created) {
        for (const who of [user.id, recipientId]) dispatchTo([who], 'CHANNEL_CREATE', (await privateChannelsFor(who, id))[0]);
        exchangePresence(user.id, recipientId);
      }
      return [200, (await privateChannelsFor(user.id, id))[0]];
    }],

    ['GET', /^\/api\/channels\/(\d{1,18})\/messages$/, async (req, [channelId]) => {
      return [200, await listMessages(await auth(req), channelId)];
    }],
    ['POST', /^\/api\/channels\/(\d{1,18})\/messages$/, async (req, [channelId]) => {
      const user = await auth(req);
      const { message } = await createMessage(user, channelId, await readJson(req));
      await toChannel(channelId, 'MESSAGE_CREATE', message);
      unfurlLater(message);
      return [201, message];
    }],
    ['PATCH', /^\/api\/channels\/(\d{1,18})\/messages\/(\d{1,18})$/, async (req, [channelId, messageId]) => {
      const user = await auth(req);
      const { message } = await editMessage(user, channelId, messageId, (await readJson(req)).content);
      await toChannel(channelId, 'MESSAGE_UPDATE', message);
      unfurlLater(message);
      return [200, message];
    }],
    ['DELETE', /^\/api\/channels\/(\d{1,18})\/messages\/(\d{1,18})$/, async (req, [channelId, messageId]) => {
      const { event } = await deleteMessage(await auth(req), channelId, messageId);
      await toChannel(channelId, 'MESSAGE_DELETE', event);
      return [204, null];
    }],
    ...(['PUT', 'DELETE'] as const).map((method): Route => [
      method,
      /^\/api\/channels\/(\d{1,18})\/messages\/(\d{1,18})\/reactions\/([^/]{1,200})\/@me$/,
      async (req, [channelId, messageId, encoded]) => {
        let emoji: string;
        try {
          emoji = decodeURIComponent(encoded);
        } catch {
          throw new HttpError(400, 'Emoji inválido');
        }
        const add = method === 'PUT';
        const { event } = await react(await auth(req), channelId, messageId, emoji, add);
        if (event) await toChannel(channelId, add ? 'MESSAGE_REACTION_ADD' : 'MESSAGE_REACTION_REMOVE', event);
        return [204, null];
      },
    ]),
    ['POST', /^\/api\/channels\/(\d{1,18})\/typing$/, async (req, [channelId]) => {
      const user = await auth(req);
      const { guild_id } = await memberChannel(user, channelId);
      await toChannel(channelId, 'TYPING_START', {
        channel_id: channelId, guild_id, user_id: user.id, timestamp: Math.floor(Date.now() / 1000),
      });
      return [204, null];
    }],
    ['POST', /^\/api\/channels\/(\d{1,18})\/attachments$/, async (req, [channelId]) => {
      const user = await auth(req);
      const { type } = await memberChannel(user, channelId);
      if (type === 'voice') throw new HttpError(400, 'Canais de voz não aceitam mensagens');
      return [200, await createUploads(user, channelId, (await readJson(req)).files)];
    }],
    ['PUT', /^\/api\/uploads\/([0-9a-f]{32})$/, async (req, [name]) => [200, await receiveUpload(await auth(req), name, req)]],
    ['GET', /^\/cdn\/attachments\/([0-9a-f]{32})$/, async (_req, [name], res) => serveAttachment(name, res)],
  ];

  const server = createServer(async (req, res) => {
    const json = (status: number, body: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(status === 204 ? undefined : JSON.stringify(body));
    };
    try {
      for (const [method, path, handler] of routes) {
        const match = req.method === method && path.exec(req.url ?? '');
        if (!match) continue;
        const result = await handler(req, match.slice(1), res);
        if (result) json(...result);
        return;
      }
      json(404, { error: 'Não encontrado' });
    } catch (err) {
      if (res.headersSent) return void res.destroy();
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
