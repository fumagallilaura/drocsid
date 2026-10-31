import { WebSocketServer } from 'ws';
import { userFromToken, type User } from './auth.ts';
import { guildsFor, memberChannel, memberIds } from './guilds.ts';
import { privateChannelsFor, relatedUserIds, relationshipsFor } from './social.ts';

// Mesmo desenho do gateway documentado do Discord: https://discord.com/developers/docs/events/gateway
// VOICE_SIGNAL é nosso: o Discord usa servidor de mídia, aqui os navegadores negociam WebRTC direto entre si.
export const Op = {
  DISPATCH: 0, HEARTBEAT: 1, IDENTIFY: 2, PRESENCE_UPDATE: 3, VOICE_STATE_UPDATE: 4, HELLO: 10, HEARTBEAT_ACK: 11, VOICE_SIGNAL: 20,
} as const;
const STATUSES = new Set(['online', 'idle', 'dnd', 'invisible']);
export const Close = {
  UNKNOWN_OPCODE: 4001,
  DECODE_ERROR: 4002,
  NOT_AUTHENTICATED: 4003,
  AUTHENTICATION_FAILED: 4004,
  ALREADY_AUTHENTICATED: 4005,
  SESSION_TIMED_OUT: 4009,
} as const;

type Dispatcher = (t: string, d: unknown) => void;
type VoiceState = { guild_id: string; channel_id: string | null; user: User };

export function createGateway(heartbeatInterval: number) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 65_536 });
  // ponytail: sessões e estado de voz em memória de um único processo; com várias instâncias, trocar por pub/sub (ex.: Redis).
  const sessions = new Map<string, Set<Dispatcher>>();
  // ponytail: um estado de voz por usuário; se outra aba entrar na voz, a aba antiga não é avisada.
  const voice = new Map<string, VoiceState & { owner: Dispatcher }>();
  // ponytail: o status escolhido vive só enquanto houver uma sessão aberta; reconectar volta para online.
  const status = new Map<string, string>();

  function dispatchTo(userIds: string[], t: string, d: unknown) {
    for (const id of userIds) sessions.get(id)?.forEach((dispatch) => dispatch(t, d));
  }

  // Como o Discord, quem está invisível aparece como offline para os outros.
  const presenceOf = (userId: string) => {
    const s = status.get(userId);
    return { user: { id: userId }, status: !s || s === 'invisible' ? 'offline' : s };
  };
  const presences = (userIds: string[]) => userIds.map(presenceOf).filter((p) => p.status !== 'offline');

  // Também avisa as outras abas do próprio usuário, que precisam saber do status real (inclusive invisível).
  async function publishPresence(userId: string, toSelf = false) {
    dispatchTo(await relatedUserIds(userId), 'PRESENCE_UPDATE', presenceOf(userId));
    if (toSelf) dispatchTo([userId], 'PRESENCE_UPDATE', { user: { id: userId }, status: status.get(userId) });
  }

  function voiceStates(guildId: string) {
    return [...voice.values()].filter((v) => v.guild_id === guildId).map(({ owner, ...state }) => state);
  }

  async function setVoice(user: User, owner: Dispatcher, next: VoiceState | null) {
    const prev = voice.get(user.id);
    if (next) voice.set(user.id, { ...next, owner });
    else if (prev?.owner === owner) voice.delete(user.id);
    else return;
    if (prev && prev.guild_id !== next?.guild_id) {
      dispatchTo(await memberIds(prev.guild_id), 'VOICE_STATE_UPDATE', { guild_id: prev.guild_id, channel_id: null, user });
    }
    if (next) dispatchTo(await memberIds(next.guild_id), 'VOICE_STATE_UPDATE', next);
  }

  wss.on('connection', (ws) => {
    let user: User | null = null;
    let seq = 0;
    let timeout: NodeJS.Timeout | undefined;

    const send = (op: number, d: unknown, t?: string) =>
      ws.send(JSON.stringify(op === Op.DISPATCH ? { op, d, s: ++seq, t } : { op, d }));
    const dispatch: Dispatcher = (t, d) => send(Op.DISPATCH, d, t);
    const resetTimeout = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => ws.close(Close.SESSION_TIMED_OUT, 'Heartbeat não recebido'), heartbeatInterval * 1.5);
    };

    ws.on('close', () => {
      clearTimeout(timeout);
      if (!user) return;
      const own = sessions.get(user.id);
      own?.delete(dispatch);
      setVoice(user, dispatch, null).catch(console.error);
      if (own?.size === 0) {
        sessions.delete(user.id);
        status.delete(user.id);
        publishPresence(user.id).catch(console.error);
      }
    });
    send(Op.HELLO, { heartbeat_interval: heartbeatInterval });
    resetTimeout();

    async function handle(msg: any) {
      if (msg?.op === Op.HEARTBEAT) {
        resetTimeout();
        return send(Op.HEARTBEAT_ACK, null);
      }
      if (msg?.op === Op.IDENTIFY) {
        if (user) return ws.close(Close.ALREADY_AUTHENTICATED, 'Já autenticado');
        const token = msg.d?.token;
        user = typeof token === 'string' ? await userFromToken(token) : null;
        if (!user) return ws.close(Close.AUTHENTICATION_FAILED, 'Token inválido');
        const [guilds, relationships, privateChannels, related] = await Promise.all([
          guildsFor(user.id), relationshipsFor(user.id), privateChannelsFor(user.id), relatedUserIds(user.id),
        ]);
        if (ws.readyState !== ws.OPEN) return;
        if (!sessions.has(user.id)) sessions.set(user.id, new Set());
        sessions.get(user.id)!.add(dispatch);
        const firstSession = !status.has(user.id);
        if (firstSession) status.set(user.id, 'online');
        dispatch('READY', {
          user,
          status: status.get(user.id),
          guilds: guilds.map((g) => ({ ...g, voice_states: voiceStates(g.id) })),
          relationships,
          private_channels: privateChannels,
          presences: presences(related),
        });
        if (firstSession) await publishPresence(user.id);
        return;
      }
      if (msg?.op !== Op.VOICE_STATE_UPDATE && msg?.op !== Op.VOICE_SIGNAL && msg?.op !== Op.PRESENCE_UPDATE) {
        return ws.close(Close.UNKNOWN_OPCODE, 'Opcode desconhecido');
      }
      if (!user) return ws.close(Close.NOT_AUTHENTICATED, 'Não autenticado');

      if (msg.op === Op.PRESENCE_UPDATE) {
        if (!STATUSES.has(msg.d?.status) || status.get(user.id) === msg.d.status) return;
        status.set(user.id, msg.d.status);
        return publishPresence(user.id, true);
      }

      if (msg.op === Op.VOICE_STATE_UPDATE) {
        const channelId = msg.d?.channel_id;
        if (channelId === null) return setVoice(user, dispatch, null);
        if (typeof channelId !== 'string' || !/^\d{1,18}$/.test(channelId)) return;
        const channel = await memberChannel(user, channelId).catch(() => null);
        if (channel?.type !== 'voice' || !channel.guild_id) return;
        return setVoice(user, dispatch, { guild_id: channel.guild_id, channel_id: channelId, user });
      }

      const me = voice.get(user.id);
      const peer = voice.get(msg.d?.to);
      if (me?.owner !== dispatch || !peer || peer.user.id === user.id || peer.channel_id !== me.channel_id) return;
      peer.owner('VOICE_SIGNAL', { from: user.id, data: msg.d.data });
    }

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return ws.close(Close.DECODE_ERROR, 'JSON inválido');
      }
      handle(msg).catch((err) => {
        console.error(err);
        ws.close(1011, 'Erro interno');
      });
    });
  });

  return { wss, dispatchTo, voiceStates, presenceOf, presences };
}
