import { WebSocketServer } from 'ws';
import { userFromToken, type User } from './auth.ts';
import { guildsFor, memberChannel, memberIds } from './guilds.ts';

// Mesmo desenho do gateway documentado do Discord: https://discord.com/developers/docs/events/gateway
// VOICE_SIGNAL é nosso: o Discord usa servidor de mídia, aqui os navegadores negociam WebRTC direto entre si.
export const Op = { DISPATCH: 0, HEARTBEAT: 1, IDENTIFY: 2, VOICE_STATE_UPDATE: 4, HELLO: 10, HEARTBEAT_ACK: 11, VOICE_SIGNAL: 20 } as const;
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

  function dispatchTo(userIds: string[], t: string, d: unknown) {
    for (const id of userIds) sessions.get(id)?.forEach((dispatch) => dispatch(t, d));
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
      sessions.get(user.id)?.delete(dispatch);
      setVoice(user, dispatch, null).catch(console.error);
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
        const guilds = await guildsFor(user.id);
        if (ws.readyState !== ws.OPEN) return;
        if (!sessions.has(user.id)) sessions.set(user.id, new Set());
        sessions.get(user.id)!.add(dispatch);
        return dispatch('READY', { user, guilds: guilds.map((g) => ({ ...g, voice_states: voiceStates(g.id) })) });
      }
      if (msg?.op !== Op.VOICE_STATE_UPDATE && msg?.op !== Op.VOICE_SIGNAL) {
        return ws.close(Close.UNKNOWN_OPCODE, 'Opcode desconhecido');
      }
      if (!user) return ws.close(Close.NOT_AUTHENTICATED, 'Não autenticado');

      if (msg.op === Op.VOICE_STATE_UPDATE) {
        const channelId = msg.d?.channel_id;
        if (channelId === null) return setVoice(user, dispatch, null);
        if (typeof channelId !== 'string' || !/^\d{1,18}$/.test(channelId)) return;
        const channel = await memberChannel(user, channelId).catch(() => null);
        if (channel?.type !== 'voice') return;
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

  return { wss, dispatchTo, voiceStates };
}
