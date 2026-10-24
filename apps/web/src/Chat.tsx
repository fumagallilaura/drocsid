import { useEffect, useRef, useState, type FormEvent } from 'react';

type User = { id: string; username: string };
type Channel = { id: string; guild_id: string; name: string };
type Guild = { id: string; name: string; owner_id: string; channels: Channel[] };
type Message = { id: string; channel_id: string; content: string; created_at: string; author: User };

const Op = { DISPATCH: 0, HEARTBEAT: 1, IDENTIFY: 2, HELLO: 10 };
const AUTHENTICATION_FAILED = 4004;

export function Chat({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [user, setUser] = useState<User | null>(null);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [guildId, setGuildId] = useState<string | null>(null);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const channelRef = useRef(channelId);
  channelRef.current = channelId;

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

  useEffect(() => {
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/gateway`);
    const send = (op: number, d: unknown) => ws.send(JSON.stringify({ op, d }));
    let seq: number | null = null;
    let heartbeat: number | undefined;

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
      }
      if (t === 'GUILD_CREATE') setGuilds((gs) => [...gs.filter((g) => g.id !== d.id), d]);
      if (t === 'CHANNEL_CREATE') {
        setGuilds((gs) => gs.map((g) => (g.id === d.guild_id ? { ...g, channels: [...g.channels, d] } : g)));
      }
      if (t === 'MESSAGE_CREATE' && d.channel_id === channelRef.current) {
        setMessages((ms) => (ms.some((m) => m.id === d.id) ? ms : [...ms, d]));
      }
    };
    ws.onclose = (e) => {
      clearInterval(heartbeat);
      setUser(null);
      if (e.code === AUTHENTICATION_FAILED) onLogout();
    };

    return () => {
      clearInterval(heartbeat);
      ws.onclose = null;
      ws.close();
    };
  }, [token]);

  useEffect(() => {
    setMessages([]);
    // ponytail: uma mensagem criada entre a consulta do histórico e a resposta pode sumir; resolver mesclando por id.
    if (channelId) run(async () => setMessages(await api('GET', `/channels/${channelId}/messages`)));
  }, [channelId]);

  const guild = guilds.find((g) => g.id === guildId);
  const channel = guild?.channels.find((c) => c.id === channelId);

  function openGuild(g: Guild) {
    setGuildId(g.id);
    setChannelId(g.channels[0]?.id ?? null);
  }

  const createGuild = () => {
    const name = prompt('Nome do servidor');
    if (name) run(async () => openGuild(await api('POST', '/guilds', { name })));
  };
  const joinGuild = () => {
    const code = prompt('Código do convite');
    if (code) run(async () => openGuild(await api('POST', `/invites/${encodeURIComponent(code)}`, {})));
  };
  const createChannel = () => {
    const name = prompt('Nome do canal (minúsculas, números, - ou _)');
    if (name) run(async () => setChannelId((await api('POST', `/guilds/${guildId}/channels`, { name })).id));
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
    <div style={{ display: 'grid', gridTemplateColumns: '180px 180px 1fr', height: '100vh' }}>
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
            <ul>
              {guild.channels.map((c) => (
                <li key={c.id}>
                  <button aria-current={c.id === channelId || undefined} onClick={() => setChannelId(c.id)}># {c.name}</button>
                </li>
              ))}
            </ul>
            {guild.owner_id === user.id && <button onClick={createChannel}>+ Canal</button>} <button onClick={invite}>Convidar</button>
          </>
        )}
      </nav>

      <main style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
