import { useEffect, useReducer, useRef, useState, type FormEvent } from 'react';
import { createCall, type Call } from './call.ts';

type User = { id: string; username: string };
type Channel = { id: string; guild_id: string; name: string; type: 'text' | 'voice' };
type VoiceState = { guild_id: string; channel_id: string | null; user: User };
type Guild = { id: string; name: string; owner_id: string; channels: Channel[]; voice_states?: VoiceState[] };
type Message = { id: string; channel_id: string; content: string; created_at: string; author: User };

const Op = { DISPATCH: 0, HEARTBEAT: 1, IDENTIFY: 2, VOICE_STATE_UPDATE: 4, HELLO: 10, VOICE_SIGNAL: 20 };
const AUTHENTICATION_FAILED = 4004;

const initials = (name: string) =>
  name.split(/[\s_.-]+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

const SpeakerIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden style={{ verticalAlign: 'text-bottom' }}>
    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4z" />
  </svg>
);

function Avatar({ name, size }: { name: string; size?: 'small' | 'large' }) {
  return <span className={`avatar ${size ?? ''}`} aria-hidden>{initials(name)}</span>;
}

function Media({ stream, label, muted }: { stream: MediaStream; label: string; muted?: boolean }) {
  const attach = (el: HTMLMediaElement | null) => {
    if (el && el.srcObject !== stream) el.srcObject = stream;
  };
  if (!stream.getVideoTracks().length) return <audio ref={attach} autoPlay />;
  return (
    <figure className="tile">
      <video ref={attach} autoPlay playsInline muted={muted} />
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

  if (!user) return <p className="empty">Conectando…</p>;

  const isOwner = guild?.owner_id === user.id;
  const participants = Object.values(voiceStates).filter((v) => v.channel_id === myVoice?.channel_id);

  return (
    <div className="app">
      <nav className="rail" aria-label="Servidores">
        <ul>
          {guilds.map((g) => (
            <li key={g.id}>
              <button className="guild-icon" title={g.name} aria-label={g.name} aria-current={g.id === guildId || undefined} onClick={() => openGuild(g)}>
                {initials(g.name)}
              </button>
            </li>
          ))}
        </ul>
        <div className="rail-divider" />
        <button className="guild-icon add" title="Criar servidor" aria-label="Criar servidor" onClick={createGuild}>+</button>
        <button className="guild-icon add" title="Entrar com convite" aria-label="Entrar com convite" onClick={joinGuild}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M11 7 9.6 8.4l2.6 2.6H2v2h10.2l-2.6 2.6L11 17l5-5-5-5zm9 12h-8v2h8c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-8v2h8v14z" />
          </svg>
        </button>
      </nav>

      <aside className="sidebar">
        <div className="header">
          <span>{guild?.name ?? 'Drocsid'}</span>
          {guild && <button className="icon-btn" onClick={invite}>Convidar</button>}
        </div>
        <nav className="channels" aria-label="Canais">
          {guild ? (
            <>
              <h3>
                Canais de texto
                {isOwner && <button className="icon-btn" aria-label="Criar canal de texto" onClick={() => createChannel('text')}>+</button>}
              </h3>
              <ul>
                {guild.channels.filter((c) => c.type === 'text').map((c) => (
                  <li key={c.id}>
                    <button className="channel" aria-current={c.id === channelId || undefined} onClick={() => setChannelId(c.id)}># {c.name}</button>
                  </li>
                ))}
              </ul>
              <h3>
                Canais de voz
                {isOwner && <button className="icon-btn" aria-label="Criar canal de voz" onClick={() => createChannel('voice')}>+</button>}
              </h3>
              <ul>
                {guild.channels.filter((c) => c.type === 'voice').map((c) => (
                  <li key={c.id}>
                    <button className="channel" aria-current={c.id === myVoice?.channel_id || undefined} onClick={() => joinVoice(c)}>
                      <SpeakerIcon /> {c.name}
                    </button>
                    <ul className="voice-members">
                      {Object.values(voiceStates).filter((v) => v.channel_id === c.id).map((v) => (
                        <li key={v.user.id}>
                          <Avatar name={v.user.username} size="small" /> {v.user.username}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="empty">Escolha ou crie um servidor à esquerda.</p>
          )}
        </nav>
        <div className="user-panel">
          <Avatar name={user.username} />
          <span className="name">{user.username}</span>
          <button className="icon-btn" onClick={onLogout}>Sair</button>
        </div>
      </aside>

      <main className="main">
        {call && voiceChannel && (
          <section className="call" aria-label="Chamada de voz">
            <h2><SpeakerIcon /> {voiceChannel.name}</h2>
            <div className="tiles">
              {participants.flatMap((v) => {
                const self = v.user.id === user.id;
                const streams = self
                  ? [call.local.camera, call.local.screen].filter((s): s is MediaStream => !!s)
                  : [...(call.peers.get(v.user.id)?.streams.values() ?? [])];
                const hasVideo = streams.some((s) => s.getVideoTracks().length);
                return [
                  ...streams.map((stream) => <Media key={stream.id} stream={stream} label={self ? 'Você' : v.user.username} muted={self} />),
                  !hasVideo && (
                    <figure key={v.user.id} className="tile">
                      <Avatar name={v.user.username} size="large" />
                      <figcaption>{self ? 'Você' : v.user.username}</figcaption>
                    </figure>
                  ),
                ];
              })}
            </div>
            <div className="call-controls">
              <button className="btn" aria-pressed={!!muted} onClick={() => call.setMuted(!muted)}>{muted ? 'Microfone desligado' : 'Silenciar'}</button>
              <button className="btn" aria-pressed={!!call.local.camera} onClick={() => run(() => call.toggle('camera'))}>Câmera</button>
              <button className="btn" aria-pressed={!!call.local.screen} onClick={() => run(() => call.toggle('screen'))}>Compartilhar tela</button>
              <button className="btn danger" onClick={leaveVoice}>Sair da chamada</button>
            </div>
          </section>
        )}
        {channel ? (
          <>
            <h2 className="header"># {channel.name}</h2>
            <ol className="messages">
              {messages.map((m) => (
                <li key={m.id} className="message">
                  <Avatar name={m.author.username} />
                  <div>
                    <strong>{m.author.username}</strong>
                    <time dateTime={m.created_at}>{new Date(m.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</time>
                    <p>{m.content}</p>
                  </div>
                </li>
              ))}
              {!messages.length && <li className="empty">Nenhuma mensagem ainda. Diga oi!</li>}
            </ol>
            <form className="composer" onSubmit={sendMessage}>
              <input name="content" placeholder={`Conversar em #${channel.name}`} aria-label={`Mensagem em #${channel.name}`} maxLength={2000} required autoComplete="off" />
            </form>
          </>
        ) : (
          !call && <p className="empty">Selecione um canal de texto.</p>
        )}
      </main>
    </div>
  );
}
