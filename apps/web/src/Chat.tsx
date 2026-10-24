import { useEffect, useReducer, useRef, useState, type FormEvent } from 'react';
import { createCall, type Call } from './call.ts';

type User = { id: string; username: string };
type Channel = { id: string; guild_id: string; name: string; type: 'text' | 'voice' };
type VoiceState = { guild_id: string; channel_id: string | null; user: User };
type Guild = { id: string; name: string; owner_id: string; channels: Channel[]; voice_states?: VoiceState[] };
type Message = { id: string; channel_id: string; content: string; created_at: string; author: User };

const Op = { DISPATCH: 0, HEARTBEAT: 1, IDENTIFY: 2, VOICE_STATE_UPDATE: 4, HELLO: 10, VOICE_SIGNAL: 20 };
const AUTHENTICATION_FAILED = 4004;

function Media({ stream, label, muted }: { stream: MediaStream; label: string; muted?: boolean }) {
  const attach = (el: HTMLMediaElement | null) => {
    if (el && el.srcObject !== stream) el.srcObject = stream;
  };
  if (!stream.getVideoTracks().length) return <audio ref={attach} autoPlay />;
  return (
    <figure style={{ margin: 0 }}>
      <video ref={attach} autoPlay playsInline muted={muted} style={{ width: 320, background: '#000' }} />
      <figcaption>{label}</figcaption>
    </figure>
  );
}

export function Chat({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [user, setUser] = useState<User | null>(null);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [guildId, setGuildId] = useState<string | null>(null);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [voiceStates, setVoiceStates] = useState<Record<string, VoiceState>>({});
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const channelRef = useRef(channelId);
  channelRef.current = channelId;
  const sendRef = useRef<(op: number, d: unknown) => void>(() => {});
  const callRef = useRef<Call | null>(null);

  async function api(method: string, path: string, body?: unknown) {
    const res = await fetch(`/api${path}`, {
      method,
      headers: { authorization: token },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  }
  const run = (action: () => Promise<unknown>) => action().catch((err) => alert(err.message));

  function endCall() {
    callRef.current?.leave();
    callRef.current = null;
    rerender();
  }

  useEffect(() => {
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/gateway`);
    const send = (op: number, d: unknown) => ws.send(JSON.stringify({ op, d }));
    sendRef.current = send;
    let seq: number | null = null;
    let heartbeat: number | undefined;
    const addVoiceStates = (states: VoiceState[] = []) =>
      setVoiceStates((vs) => ({ ...vs, ...Object.fromEntries(states.map((v) => [v.user.id, v])) }));

    ws.onmessage = (e) => {
      const { op, d, s, t } = JSON.parse(e.data);
      if (s) seq = s;
      if (op === Op.HELLO) {
        heartbeat = window.setInterval(() => send(Op.HEARTBEAT, seq), d.heartbeat_interval);
        send(Op.IDENTIFY, { token });
      }
      if (op !== Op.DISPATCH) return;
      if (t === 'READY') {
        setUser(d.user);
        setGuilds(d.guilds);
        setVoiceStates({});
        addVoiceStates(d.guilds.flatMap((g: Guild) => g.voice_states));
      }
      if (t === 'GUILD_CREATE') {
        setGuilds((gs) => [...gs.filter((g) => g.id !== d.id), d]);
        addVoiceStates(d.voice_states);
      }
      if (t === 'CHANNEL_CREATE') {
        setGuilds((gs) => gs.map((g) => (g.id === d.guild_id ? { ...g, channels: [...g.channels, d] } : g)));
      }
      if (t === 'MESSAGE_CREATE' && d.channel_id === channelRef.current) {
        setMessages((ms) => (ms.some((m) => m.id === d.id) ? ms : [...ms, d]));
      }
      if (t === 'VOICE_STATE_UPDATE') {
        setVoiceStates(({ [d.user.id]: _, ...rest }) => (d.channel_id ? { ...rest, [d.user.id]: d } : rest));
      }
      if (t === 'VOICE_SIGNAL') callRef.current?.receive(d.from, d.data);
    };
    ws.onclose = (e) => {
      clearInterval(heartbeat);
      endCall();
      setUser(null);
      if (e.code === AUTHENTICATION_FAILED) onLogout();
    };

    return () => {
      clearInterval(heartbeat);
      ws.onclose = null;
      ws.close();
      endCall();
    };
  }, [token]);

  useEffect(() => {
    setMessages([]);
    // ponytail: uma mensagem criada entre a consulta do histórico e a resposta pode sumir; resolver mesclando por id.
    if (channelId) run(async () => setMessages(await api('GET', `/channels/${channelId}/messages`)));
  }, [channelId]);

  const myVoice = user ? voiceStates[user.id] : undefined;

  useEffect(() => {
    const peers = Object.values(voiceStates).filter((v) => v.channel_id === myVoice?.channel_id && v.user.id !== user?.id);
    callRef.current?.sync(myVoice ? peers.map((v) => v.user.id) : []);
  }, [voiceStates]);

  const guild = guilds.find((g) => g.id === guildId);
  const channel = guild?.channels.find((c) => c.id === channelId);
  const voiceChannel = guilds.flatMap((g) => g.channels).find((c) => c.id === myVoice?.channel_id);
  const call = callRef.current;
  const muted = call?.local.mic?.getAudioTracks().every((t) => !t.enabled);

  function openGuild(g: Guild) {
    setGuildId(g.id);
    setChannelId(g.channels.find((c) => c.type === 'text')?.id ?? null);
  }

  function joinVoice(c: Channel) {
    run(async () => {
      if (!callRef.current) {
        const newCall = createCall(user!.id, (to, data) => sendRef.current(Op.VOICE_SIGNAL, { to, data }), rerender);
        await newCall.start('mic');
        callRef.current = newCall;
      }
      sendRef.current(Op.VOICE_STATE_UPDATE, { channel_id: c.id });
    });
  }

  function leaveVoice() {
    sendRef.current(Op.VOICE_STATE_UPDATE, { channel_id: null });
    endCall();
  }

  const createGuild = () => {
    const name = prompt('Nome do servidor');
    if (name) run(async () => openGuild(await api('POST', '/guilds', { name })));
  };
  const joinGuild = () => {
    const code = prompt('Código do convite');
    if (code) run(async () => openGuild(await api('POST', `/invites/${encodeURIComponent(code)}`, {})));
  };
  const createChannel = (type: Channel['type']) => {
    const name = prompt('Nome do canal (minúsculas, números, - ou _)');
    if (!name) return;
    run(async () => {
      const created = await api('POST', `/guilds/${guildId}/channels`, { name, type });
      if (type === 'text') setChannelId(created.id);
    });
  };
  const invite = () =>
    run(async () => prompt('Envie este código para quem você quer convidar', (await api('POST', `/guilds/${guildId}/invites`, {})).code));

  function sendMessage(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const content = new FormData(form).get('content');
    run(async () => {
      await api('POST', `/channels/${channelId}/messages`, { content });
      form.reset();
    });
  }

  if (!user) return <p>Conectando…</p>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '180px 200px 1fr', height: '100vh' }}>
      <nav aria-label="Servidores">
        <p>
          {user.username} <button onClick={onLogout}>Sair</button>
        </p>
        <ul>
          {guilds.map((g) => (
            <li key={g.id}>
              <button aria-current={g.id === guildId || undefined} onClick={() => openGuild(g)}>{g.name}</button>
            </li>
          ))}
        </ul>
        <button onClick={createGuild}>+ Servidor</button> <button onClick={joinGuild}>Entrar com convite</button>
      </nav>

      <nav aria-label="Canais">
        {guild && (
          <>
            <h2>{guild.name}</h2>
            <h3>Canais de texto</h3>
            <ul>
              {guild.channels.filter((c) => c.type === 'text').map((c) => (
                <li key={c.id}>
                  <button aria-current={c.id === channelId || undefined} onClick={() => setChannelId(c.id)}># {c.name}</button>
                </li>
              ))}
            </ul>
            <h3>Canais de voz</h3>
            <ul>
              {guild.channels.filter((c) => c.type === 'voice').map((c) => (
                <li key={c.id}>
                  <button aria-current={c.id === myVoice?.channel_id || undefined} onClick={() => joinVoice(c)}>
                    Voz: {c.name}
                  </button>
                  <ul>
                    {Object.values(voiceStates).filter((v) => v.channel_id === c.id).map((v) => (
                      <li key={v.user.id}>{v.user.username}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
            {guild.owner_id === user.id && (
              <>
                <button onClick={() => createChannel('text')}>+ Texto</button>{' '}
                <button onClick={() => createChannel('voice')}>+ Voz</button>{' '}
              </>
            )}
            <button onClick={invite}>Convidar</button>
          </>
        )}
      </nav>

      <main style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {call && voiceChannel && (
          <section aria-label="Chamada de voz">
            <h2>Voz: {voiceChannel.name}</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {call.local.camera && <Media stream={call.local.camera} label="Você (câmera)" muted />}
              {call.local.screen && <Media stream={call.local.screen} label="Você (tela)" muted />}
              {[...call.peers].flatMap(([id, peer]) =>
                [...peer.streams.values()].map((stream) => (
                  <Media key={stream.id} stream={stream} label={voiceStates[id]?.user.username ?? ''} />
                )),
              )}
            </div>
            <button onClick={() => call.setMuted(!muted)}>{muted ? 'Ativar microfone' : 'Silenciar microfone'}</button>{' '}
            <button onClick={() => run(() => call.toggle('camera'))}>{call.local.camera ? 'Desligar câmera' : 'Ligar câmera'}</button>{' '}
            <button onClick={() => run(() => call.toggle('screen'))}>
              {call.local.screen ? 'Parar de compartilhar' : 'Compartilhar tela'}
            </button>{' '}
            <button onClick={leaveVoice}>Sair da chamada</button>
          </section>
        )}
        {channel && (
          <>
            <h2># {channel.name}</h2>
            <ol style={{ flex: 1, overflowY: 'auto', listStyle: 'none', padding: 0 }}>
              {messages.map((m) => (
                <li key={m.id}>
                  <strong>{m.author.username}</strong>{' '}
                  <time dateTime={m.created_at}>{new Date(m.created_at).toLocaleTimeString('pt-BR')}</time>
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{m.content}</p>
                </li>
              ))}
            </ol>
            <form onSubmit={sendMessage}>
              <input name="content" aria-label={`Mensagem em #${channel.name}`} maxLength={2000} required autoComplete="off" />
              <button>Enviar</button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
