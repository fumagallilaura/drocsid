import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { createCall, type Call } from './call.ts';
import { Friends } from './Friends.tsx';
import { Messages } from './Messages.tsx';
import {
  Avatar,
  createApi,
  FriendsIcon,
  SpeakerIcon,
  STATUS_LABEL,
  type Channel,
  type Guild,
  type Message,
  type Presence,
  type Reaction,
  type Relationship,
  type Status,
  type User,
  type VoiceState,
} from './ui.tsx';

const Op = { DISPATCH: 0, HEARTBEAT: 1, IDENTIFY: 2, PRESENCE_UPDATE: 3, VOICE_STATE_UPDATE: 4, HELLO: 10, VOICE_SIGNAL: 20 };
const AUTHENTICATION_FAILED = 4004;
const TYPING_VISIBLE_MS = 10_000;
const SELECTABLE: Status[] = ['online', 'idle', 'dnd', 'invisible'];

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

function applyReaction(list: Reaction[], name: string, add: boolean, mine: boolean): Reaction[] {
  const existing = list.find((r) => r.emoji.name === name);
  if (add) {
    if (!existing) return [...list, { emoji: { name }, count: 1, me: mine }];
    return list.map((r) => (r === existing ? { ...r, count: r.count + 1, me: r.me || mine } : r));
  }
  if (!existing) return list;
  if (existing.count <= 1) return list.filter((r) => r !== existing);
  return list.map((r) => (r === existing ? { ...r, count: r.count - 1, me: mine ? false : r.me } : r));
}

const byUsername = (a: User, b: User) => a.username.localeCompare(b.username);

export function Chat({ token, onLogout }: { token: string; onLogout: () => void }) {
  const api = useMemo(() => createApi(token), [token]);
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>('online');
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [dms, setDms] = useState<Channel[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [presences, setPresences] = useState<Record<string, Status>>({});
  const [guildId, setGuildId] = useState<string | null>(null);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typing, setTyping] = useState<Record<string, Record<string, number>>>({});
  const [voiceStates, setVoiceStates] = useState<Record<string, VoiceState>>({});
  const [statusMenu, setStatusMenu] = useState(false);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const sendRef = useRef<(op: number, d: unknown) => void>(() => {});
  const callRef = useRef<Call | null>(null);

  const users = useMemo(() => {
    const map = new Map<string, User>();
    for (const u of [...guilds.flatMap((g) => g.members), ...dms.flatMap((c) => c.recipients ?? []), ...relationships.map((r) => r.user)]) {
      map.set(u.id, u);
    }
    if (user) map.set(user.id, user);
    return map;
  }, [guilds, dms, relationships, user]);

  // O handler do WebSocket vive enquanto a conexão existir; estes refs dão a ele o estado atual.
  const live = useRef({ user, status, channelId, guilds, dms, users });
  live.current = { user, status, channelId, guilds, dms, users };

  const run = (action: () => Promise<unknown>) => action().catch((err) => alert(err.message));

  function endCall() {
    callRef.current?.leave();
    callRef.current = null;
    rerender();
  }

  function openChannel(id: string) {
    const guild = live.current.guilds.find((g) => g.channels.some((c) => c.id === id));
    setGuildId(guild?.id ?? null);
    setChannelId(id);
  }

  // Como no Discord: notifica DMs e menções, nunca em "Não perturbe" nem para o canal que já está na tela.
  function notify(m: Message) {
    const { user: me, status: myStatus, channelId: open, dms: myDms, users: known } = live.current;
    if (!me || m.author.id === me.id || myStatus === 'dnd') return;
    const isDm = myDms.some((c) => c.id === m.channel_id);
    if (!isDm && !m.mentions.some((u) => u.id === me.id)) return;
    if (!document.hidden && open === m.channel_id) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const body = m.content.replace(/<@(\d+)>/g, (all, id) => (known.has(id) ? `@${known.get(id)!.username}` : all)) || '📎 Anexo';
    const n = new Notification(isDm ? m.author.username : `${m.author.username} mencionou você`, { body, tag: m.channel_id });
    n.onclick = () => {
      window.focus();
      openChannel(m.channel_id);
    };
  }

  useEffect(() => {
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/gateway`);
    const send = (op: number, d: unknown) => ws.send(JSON.stringify({ op, d }));
    sendRef.current = send;
    let seq: number | null = null;
    let heartbeat: number | undefined;
    const addVoiceStates = (states: VoiceState[] = []) =>
      setVoiceStates((vs) => ({ ...vs, ...Object.fromEntries(states.map((v) => [v.user.id, v])) }));
    const addPresences = (list: Presence[] = []) =>
      setPresences((p) => ({ ...p, ...Object.fromEntries(list.map((x) => [x.user.id, x.status])) }));
    const updateMessage = (id: string, change: (m: Message) => Message) =>
      setMessages((ms) => ms.map((m) => (m.id === id ? change(m) : m)));

    ws.onmessage = (e) => {
      const { op, d, s, t } = JSON.parse(e.data);
      if (s) seq = s;
      if (op === Op.HELLO) {
        heartbeat = window.setInterval(() => send(Op.HEARTBEAT, seq), d.heartbeat_interval);
        send(Op.IDENTIFY, { token });
      }
      if (op !== Op.DISPATCH) return;
      const me = live.current.user;
      switch (t) {
        case 'READY':
          setUser(d.user);
          setStatus(d.status);
          setGuilds(d.guilds);
          setDms(d.private_channels);
          setRelationships(d.relationships);
          setPresences({});
          addPresences(d.presences);
          setVoiceStates({});
          addVoiceStates(d.guilds.flatMap((g: Guild) => g.voice_states));
          if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
          break;
        case 'GUILD_CREATE':
          setGuilds((gs) => [...gs.filter((g) => g.id !== d.id), d]);
          addVoiceStates(d.voice_states);
          addPresences(d.presences);
          break;
        case 'GUILD_MEMBER_ADD':
          setGuilds((gs) => gs.map((g) => (g.id === d.guild_id && !g.members.some((u) => u.id === d.user.id)
            ? { ...g, members: [...g.members, d.user].sort(byUsername) } : g)));
          break;
        case 'CHANNEL_CREATE':
          if (d.type === 'dm') setDms((cs) => (cs.some((c) => c.id === d.id) ? cs : [d, ...cs]));
          else setGuilds((gs) => gs.map((g) => (g.id === d.guild_id ? { ...g, channels: [...g.channels, d] } : g)));
          break;
        case 'MESSAGE_CREATE':
          if (d.channel_id === live.current.channelId) setMessages((ms) => (ms.some((m) => m.id === d.id) ? ms : [...ms, d]));
          setDms((cs) => {
            const dm = cs.find((c) => c.id === d.channel_id);
            return dm ? [{ ...dm, last_message_id: d.id }, ...cs.filter((c) => c !== dm)] : cs;
          });
          setTyping((all) => {
            const { [d.author.id]: _, ...rest } = all[d.channel_id] ?? {};
            return { ...all, [d.channel_id]: rest };
          });
          notify(d);
          break;
        case 'MESSAGE_UPDATE':
          updateMessage(d.id, (m) => ({ ...m, ...d }));
          break;
        case 'MESSAGE_DELETE':
          setMessages((ms) => ms.filter((m) => m.id !== d.id));
          break;
        case 'MESSAGE_REACTION_ADD':
        case 'MESSAGE_REACTION_REMOVE':
          updateMessage(d.message_id, (m) => ({
            ...m,
            reactions: applyReaction(m.reactions ?? [], d.emoji.name, t === 'MESSAGE_REACTION_ADD', d.user_id === me?.id),
          }));
          break;
        case 'TYPING_START':
          if (d.user_id !== me?.id) {
            setTyping((all) => ({ ...all, [d.channel_id]: { ...all[d.channel_id], [d.user_id]: Date.now() + TYPING_VISIBLE_MS } }));
          }
          break;
        case 'PRESENCE_UPDATE':
          if (d.user.id === me?.id) setStatus(d.status);
          else setPresences((p) => ({ ...p, [d.user.id]: d.status }));
          break;
        case 'RELATIONSHIP_ADD':
          setRelationships((rs) => [...rs.filter((r) => r.id !== d.id), d].sort((a, b) => byUsername(a.user, b.user)));
          break;
        case 'RELATIONSHIP_REMOVE':
          setRelationships((rs) => rs.filter((r) => r.id !== d.id));
          break;
        case 'VOICE_STATE_UPDATE':
          setVoiceStates(({ [d.user.id]: _, ...rest }) => (d.channel_id ? { ...rest, [d.user.id]: d } : rest));
          break;
        case 'VOICE_SIGNAL':
          callRef.current?.receive(d.from, d.data);
          break;
      }
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

  // Limpa quem parou de digitar; só roda enquanto houver alguém digitando.
  const anyoneTyping = Object.values(typing).some((c) => Object.keys(c).length);
  useEffect(() => {
    if (!anyoneTyping) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setTyping((all) => Object.fromEntries(Object.entries(all).map(([c, us]) => [c, Object.fromEntries(Object.entries(us).filter(([, exp]) => exp > now))])));
    }, 1000);
    return () => clearInterval(timer);
  }, [anyoneTyping]);

  const myVoice = user ? voiceStates[user.id] : undefined;

  useEffect(() => {
    const peers = Object.values(voiceStates).filter((v) => v.channel_id === myVoice?.channel_id && v.user.id !== user?.id);
    callRef.current?.sync(myVoice ? peers.map((v) => v.user.id) : []);
  }, [voiceStates]);

  const guild = guilds.find((g) => g.id === guildId);
  const dm = !guild ? dms.find((c) => c.id === channelId) : undefined;
  const channel = guild?.channels.find((c) => c.id === channelId) ?? dm;
  const navigable = guild ? guild.channels.filter((c) => c.type === 'text') : dms;

  // Alt+↑/↓ troca de canal, como no Discord.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') || !navigable.length) return;
      e.preventDefault();
      const i = navigable.findIndex((c) => c.id === channelId);
      const next = navigable[(i + (e.key === 'ArrowDown' ? 1 : -1) + navigable.length) % navigable.length];
      setChannelId(next.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigable, channelId]);

  const voiceChannel = guilds.flatMap((g) => g.channels).find((c) => c.id === myVoice?.channel_id);
  const call = callRef.current;
  const muted = call?.local.mic?.getAudioTracks().every((t) => !t.enabled);
  const statusOf = (id: string): Status => (id === user?.id ? (status === 'invisible' ? 'offline' : status) : presences[id] ?? 'offline');

  function openGuild(g: Guild) {
    setGuildId(g.id);
    setChannelId(g.channels.find((c) => c.type === 'text')?.id ?? null);
  }

  function goHome() {
    setGuildId(null);
    setChannelId(null);
  }

  const openDm = (recipientId: string) =>
    run(async () => {
      const created: Channel = await api('POST', '/users/@me/channels', { recipient_id: recipientId });
      setDms((cs) => (cs.some((c) => c.id === created.id) ? cs : [created, ...cs]));
      setGuildId(null);
      setChannelId(created.id);
    });

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

  function changeStatus(next: Status) {
    sendRef.current(Op.PRESENCE_UPDATE, { status: next });
    setStatusMenu(false);
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

  if (!user) return <p className="empty">Conectando…</p>;

  const isOwner = guild?.owner_id === user.id;
  const participants = Object.values(voiceStates).filter((v) => v.channel_id === myVoice?.channel_id);
  const dmPeer = dm?.recipients?.[0];
  const typingNames = Object.entries(channelId ? typing[channelId] ?? {} : {})
    .filter(([, exp]) => exp > Date.now())
    .map(([id]) => users.get(id)?.username ?? 'Alguém');
  const members = guild ? [...guild.members].sort(byUsername) : [];
  const onlineMembers = members.filter((m) => statusOf(m.id) !== 'offline');
  const offlineMembers = members.filter((m) => statusOf(m.id) === 'offline');
  const incoming = relationships.filter((r) => r.type === 3).length;

  const memberRow = (m: User) => (
    <li key={m.id}>
      <button className={`member ${statusOf(m.id) === 'offline' ? 'offline' : ''}`} disabled={m.id === user.id}
        title={m.id === user.id ? undefined : `Mandar mensagem para ${m.username}`} onClick={() => openDm(m.id)}>
        <Avatar name={m.username} status={statusOf(m.id)} />
        <span>{m.username}{m.id === guild?.owner_id && <span title="Dono do servidor" aria-label="Dono do servidor"> 👑</span>}</span>
      </button>
    </li>
  );

  return (
    <div className={`app ${guild ? 'with-members' : ''}`}>
      <nav className="rail" aria-label="Servidores">
        <button className="guild-icon home" title="Mensagens diretas" aria-label="Mensagens diretas" aria-current={!guild || undefined} onClick={goHome}>
          D<span>.</span>
          {incoming > 0 && <span className="rail-badge" aria-label={`${incoming} pedidos de amizade`}>{incoming}</span>}
        </button>
        <div className="rail-divider" />
        <ul>
          {guilds.map((g) => (
            <li key={g.id}>
              <button className="guild-icon" title={g.name} aria-label={g.name} aria-current={g.id === guildId || undefined} onClick={() => openGuild(g)}>
                {g.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 3)}
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
        {guild ? (
          <>
            <div className="header">
              <span>{guild.name}</span>
              <button className="icon-btn" onClick={invite}>Convidar</button>
            </div>
            <nav className="channels" aria-label="Canais">
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
            </nav>
          </>
        ) : (
          <nav className="channels" aria-label="Mensagens diretas">
            <button className="channel big" aria-current={!channelId || undefined} onClick={() => setChannelId(null)}>
              <FriendsIcon /> Amigos
              {incoming > 0 && <span className="badge">{incoming}</span>}
            </button>
            <h3>Mensagens diretas</h3>
            <ul>
              {dms.map((c) => {
                const peer = c.recipients![0];
                return (
                  <li key={c.id}>
                    <button className="channel dm" aria-current={c.id === channelId || undefined} onClick={() => setChannelId(c.id)}>
                      <Avatar name={peer.username} status={statusOf(peer.id)} />
                      <span>{peer.username}</span>
                    </button>
                  </li>
                );
              })}
              {!dms.length && <li className="hint">Suas conversas aparecem aqui.</li>}
            </ul>
          </nav>
        )}
        <div className="user-panel">
          <button className="me" aria-haspopup="menu" aria-expanded={statusMenu} onClick={() => setStatusMenu(!statusMenu)}>
            <Avatar name={user.username} status={statusOf(user.id)} />
            <span>
              <strong>{user.username}</strong>
              <small>{STATUS_LABEL[status]}</small>
            </span>
          </button>
          <button className="icon-btn" onClick={onLogout}>Sair</button>
          {statusMenu && (
            <ul className="status-menu" role="menu" onKeyDown={(e) => e.key === 'Escape' && setStatusMenu(false)}>
              {SELECTABLE.map((s) => (
                <li key={s}>
                  <button role="menuitemradio" aria-checked={s === status} autoFocus={s === status} onClick={() => changeStatus(s)}>
                    <span className={`status-dot inline ${s === 'invisible' ? 'offline' : s}`} /> {STATUS_LABEL[s]}
                  </button>
                </li>
              ))}
            </ul>
          )}
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
            <h2 className="header">
              {dmPeer ? <span className="dm-title"><Avatar name={dmPeer.username} size="small" status={statusOf(dmPeer.id)} /> {dmPeer.username}</span> : `# ${channel.name}`}
            </h2>
            <Messages
              api={api}
              me={user}
              channelId={channel.id}
              label={dmPeer ? `@${dmPeer.username}` : `#${channel.name}`}
              messages={messages}
              users={users}
              mentionable={guild ? guild.members : [user, ...(dm?.recipients ?? [])]}
              typing={typingNames}
              canModerate={isOwner}
            />
          </>
        ) : guild ? (
          !call && <p className="empty">Selecione um canal de texto.</p>
        ) : (
          <Friends api={api} relationships={relationships} statusOf={statusOf} openDm={openDm} />
        )}
      </main>

      {guild && (
        <aside className="members" aria-label="Membros">
          <h3>Disponível — {onlineMembers.length}</h3>
          <ul>{onlineMembers.map(memberRow)}</ul>
          {!!offlineMembers.length && (
            <>
              <h3>Offline — {offlineMembers.length}</h3>
              <ul>{offlineMembers.map(memberRow)}</ul>
            </>
          )}
        </aside>
      )}
    </div>
  );
}
