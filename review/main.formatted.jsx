import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AudioLines, ArrowRight, Check, ChevronDown, Clipboard, Coffee, Hash, Headphones, LogOut, MessageCircle, Mic, MicOff, Monitor, MonitorUp, MoreHorizontal, Phone, PhoneOff, Plus, Radio, Settings2, Signal, Sparkles, Users, Volume2, VolumeX, X } from 'lucide-react';
import { Call } from './rtc';
import './style.css';
const initials = name => name.trim().split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase();
const colors = ['mint', 'peach', 'lavender', 'blue', 'pink'];
const colorFor = name => colors[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length];
function Avatar({
  name,
  large = false,
  status = false
}) {
  return <span className={`avatar ${colorFor(name)} ${large ? 'large' : ''}`}>{initials(name)}{status && <i />}</span>;
}
function Media({
  stream,
  video = false,
  muted = false,
  ...props
}) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream || null;
      ref.current.play().catch(() => {});
    }
  }, [stream]);
  return video ? <video ref={ref} autoPlay playsInline muted={muted} {...props} /> : <audio ref={ref} autoPlay muted={muted} />;
}
function Modal({
  title,
  children,
  onClose,
  wide = false
}) {
  return <div className="modal-backdrop" onMouseDown={e => {
    if (e.target === e.currentTarget && onClose) onClose();
  }}><section className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}><div className="modal-title"><h2>{title}</h2>{onClose && <button className="icon-button" onClick={onClose} aria-label="Fechar"><X size={20} /></button>}</div>{children}</section></div>;
}
function App() {
  const [session, setSession] = useState(null);
  const [name, setName] = useState(localStorage.getItem('conversa.name') || '');
  const [serverInput, setServerInput] = useState(new URLSearchParams(location.search).get('server') || localStorage.getItem('conversa.server') || '');
  const [joining, setJoining] = useState(false);
  const [connected, setConnected] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [room, setRoom] = useState(null);
  const [members, setMembers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [streams, setStreams] = useState([]);
  const [inCall, setInCall] = useState(false);
  const [callPending, setCallPending] = useState(false);
  const [media, setMedia] = useState({
    muted: true,
    display: null
  });
  const [deafened, setDeafened] = useState(false);
  const [toast, setToast] = useState('');
  const [modal, setModal] = useState(null);
  const [roomName, setRoomName] = useState('');
  const [quality, setQuality] = useState('1080');
  const [systemAudio, setSystemAudio] = useState(false);
  const [capture, setCapture] = useState(null);
  const [sharingPending, setSharingPending] = useState(false);
  const socketRef = useRef(null),
    callRef = useRef(null),
    scrollRef = useRef(null),
    toastTimer = useRef(null),
    roomRef = useRef(null),
    nameRef = useRef('');
  const desiredRoom = useRef(new URLSearchParams(location.search).get('room') || 'geral');
  const currentSession = useRef(null);
  function notify(text) {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 6500);
  }
  function send(event) {
    if (socketRef.current?.readyState === WebSocket.OPEN) socketRef.current.send(JSON.stringify(event));
  }
  useEffect(() => {
    const unsubscribe = window.desktop?.onCaptureSources(setCapture);
    return () => {
      unsubscribe?.();
      socketRef.current?.close();
      callRef.current?.close();
      clearTimeout(toastTimer.current);
    };
  }, []);
  useEffect(() => {
    scrollRef.current?.scrollIntoView({
      behavior: 'smooth'
    });
  }, [messages]);
  useEffect(() => {
    window.desktop?.setPlaybackEnabled(inCall && !deafened);
  }, [inCall, deafened]);
  async function enter(event) {
    event.preventDefault();
    if (!name.trim()) return;
    setJoining(true);
    try {
      const server = new URL(serverInput.trim() || location.origin);
      if (!['http:', 'https:'].includes(server.protocol) || server.username || server.password) throw new Error('Use um endereço HTTP ou HTTPS válido.');
      const response = await fetch(`${server.origin}/api/config`, {
        signal: AbortSignal.timeout(8000)
      });
      if (!response.ok) throw new Error('Servidor indisponível.');
      const config = await response.json();
      const url = new URL('/ws', server);
      url.protocol = server.protocol === 'https:' ? 'wss:' : 'ws:';
      socketRef.current?.close();
      const ws = new WebSocket(url);
      socketRef.current = ws;
      nameRef.current = name.trim();
      const timeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          setJoining(false);
          notify('O servidor não respondeu. Confira o endereço.');
        }
      }, 8000);
      ws.onmessage = e => {
        const data = JSON.parse(e.data);
        if (data.type === 'hello') {
          clearTimeout(timeout);
          const value = {
            id: data.id,
            name: name.trim(),
            server: server.origin
          };
          currentSession.current = value;
          setSession(value);
          setRooms(data.rooms);
          setConnected(true);
          setJoining(false);
          localStorage.setItem('conversa.name', name.trim());
          localStorage.setItem('conversa.server', serverInput.trim());
          callRef.current = new Call({
            id: data.id,
            send,
            iceServers: config.iceServers,
            onStreams: setStreams,
            onMedia: setMedia,
            onError: notify
          });
          const initialRoom = data.rooms.some(r => r.id === desiredRoom.current) ? desiredRoom.current : 'geral';
          send({
            type: 'join',
            name: name.trim(),
            room: initialRoom
          });
        } else if (data.type === 'joined') {
          roomRef.current = data.room;
          setRoom(data.room);
          setMessages(data.messages);
          setDraft('');
          setMembers([]);
        } else if (data.type === 'presence') {
          setMembers(data.members);
          const own = data.members.find(m => m.id === currentSession.current?.id);
          setInCall(!!own?.inCall);
          if (own?.inCall) setCallPending(false);
          callRef.current?.sync(data.members);
        } else if (data.type === 'message') setMessages(previous => [...previous.slice(-199), data.message]);else if (data.type === 'rooms') setRooms(data.rooms);else if (data.type === 'room-created') {
          changeRoom(data.room);
          setModal(null);
          setRoomName('');
        } else if (data.type === 'signal') callRef.current?.signal(data.from, data.signal);else if (data.type === 'error') {
          notify(data.message);
          setCallPending(false);
          if (data.message.includes('chamada está cheia')) callRef.current?.leave(false);
        }
      };
      ws.onclose = () => {
        clearTimeout(timeout);
        if (socketRef.current !== ws) return;
        callRef.current?.close();
        setConnected(false);
        setInCall(false);
        setCallPending(false);
        setJoining(false);
        notify('Conexão encerrada. Reconecte para continuar.');
      };
      ws.onerror = () => {
        clearTimeout(timeout);
        setJoining(false);
        notify('Não foi possível conectar ao servidor.');
      };
    } catch (error) {
      setJoining(false);
      notify(error.message.includes('fetch') ? 'Não foi possível encontrar o servidor. Confira o endereço.' : error.message);
    }
  }
  function changeRoom(next) {
    if (next.id === roomRef.current?.id) return;
    callRef.current?.leave();
    setInCall(false);
    setCallPending(false);
    send({
      type: 'join',
      name: nameRef.current,
      room: next.id
    });
    desiredRoom.current = next.id;
  }
  function leaveCall() {
    callRef.current?.leave();
    setCallPending(false);
    setInCall(false);
  }
  async function joinCall() {
    if (callPending || inCall) return;
    setCallPending(true);
    try {
      await callRef.current?.join();
    } catch (error) {
      setCallPending(false);
      notify(error.message);
    }
  }
  async function share() {
    if (media.display) {
      await callRef.current?.stopScreen();
      return;
    }
    setSharingPending(true);
    try {
      await callRef.current?.shareScreen(systemAudio, quality);
    } catch (error) {
      if (error.name !== 'NotAllowedError') notify(`Não foi possível compartilhar: ${error.message}`);
    } finally {
      setSharingPending(false);
      setCapture(null);
    }
  }
  function disconnect() {
    callRef.current?.close();
    socketRef.current?.close();
    setSession(null);
    setRoom(null);
    setMembers([]);
    setModal(null);
    setConnected(false);
  }
  async function invite() {
    const link = new URL(session.server);
    link.searchParams.set('room', room.id);
    try {
      await navigator.clipboard.writeText(link.href);
      notify(['localhost', '127.0.0.1'].includes(link.hostname) ? 'Link local copiado. Para outro computador, use um servidor de grupo acessível pela rede.' : 'Convite copiado! No app, use o endereço do servidor para conectar.');
    } catch {
      notify(`Endereço do servidor: ${session.server} · sala: ${room.name}`);
    }
  }
  const callMembers = members.filter(m => m.inCall);
  const screenMembers = callMembers.filter(m => m.sharing);
  const myMember = members.find(m => m.id === session?.id);
  const remoteStream = id => streams.find(s => s.id === id);
  const statusText = !connected ? 'Desconectado' : inCall ? 'Conectado à voz' : 'Tudo pronto para conversar';
  return <>
    {!session ? <main className="welcome"><div className="welcome-art"><span className="brand"><MessageCircle size={28} fill="currentColor" strokeWidth={1.5} /> conversa<span className="version">PRÉVIA</span></span><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="welcome-illustration"><div className="floating-bubble"><AudioLines size={62} /></div><div className="floating-screen"><Monitor size={64} /><span>ideias em boa companhia</span><i className="live-dot" /></div><div className="floating-smile">:)</div></div><div className="welcome-copy"><span className="eyebrow">MENOS DISTÂNCIA. MAIS CONVERSA.</span><h1>Seu grupo.<br />No mesmo lugar.</h1><p>Um papo que flui, uma tela que aproxima.<br />Chegue, conecte e fique à vontade.</p></div><span className="art-footer">Feito para estar junto <Sparkles size={15} /></span></div><div className="welcome-form"><div className="form-inner"><span className="eyebrow">BEM-VINDO AO CONVERSA</span><h2>Vamos nos encontrar?</h2><p>Escolha como o grupo vai chamar você.</p><form onSubmit={enter}><label htmlFor="name">Seu nome</label><input id="name" autoFocus maxLength={32} value={name} onChange={e => setName(e.target.value)} placeholder="Como você se chama?" required /><label htmlFor="server">Servidor do grupo <span>opcional</span></label><input id="server" value={serverInput} onChange={e => setServerInput(e.target.value)} placeholder="Local ou https://seu-servidor.com" /><small>Deixe vazio para testar neste computador. Para conversar com amigos, todos devem usar o mesmo servidor.</small><button className="primary enter" disabled={joining || !name.trim()}>{joining ? 'Conectando…' : 'Entrar no Conversa'}<ArrowRight size={18} /></button></form><div className="welcome-features"><span><MessageCircle size={16} /> Texto</span><span><Mic size={16} /> Voz</span><span><Monitor size={16} /> Tela</span></div><p className="guest-note">Acesso como convidado · sem cadastro nesta prévia</p></div></div></main> : <div className="app-shell">
      <nav className="workspace-rail" aria-label="Espaços"><div className="rail-logo"><MessageCircle size={26} fill="currentColor" /></div><div className="rail-separator" /><button className="workspace active" title="Seu espaço"><span>C</span><i /></button><button className="workspace add" onClick={() => setModal('create')} aria-label="Criar sala"><Plus size={22} /></button><div className="rail-bottom"><span className="windows-label">PC</span><button className="icon-button" title="Configurações" onClick={() => setModal('settings')} aria-label="Configurações"><Settings2 size={22} /></button></div></nav>
      <aside className="room-sidebar"><div className="space-header"><div><span className="eyebrow">SEU PONTO DE ENCONTRO</span><h2>Nosso espaço <ChevronDown size={17} /></h2></div></div><div className="sidebar-scroll"><div className="space-banner"><span className="banner-icon"><Sparkles size={18} /></span><strong>Boa companhia,<br />a um clique.</strong><span className="banner-orb" /></div><div className="section-label">CONVERSAS<button className="icon-button" aria-label="Adicionar sala" onClick={() => setModal('create')}><Plus size={15} /></button></div><div className="channels">{rooms.map(r => <button key={r.id} disabled={!connected} onClick={() => changeRoom(r)} className={`channel ${room?.id === r.id ? 'selected' : ''}`}><Hash size={19} /><span>{r.name}</span>{room?.id === r.id && <i />}</button>)}</div><div className="section-label voice-heading">ENCONTRO AO VIVO <Radio size={13} /></div><button disabled={!connected || callPending} className={`voice-channel ${inCall ? 'joined' : ''}`} onClick={inCall ? () => {} : joinCall}><Volume2 size={19} /><div><span>{room?.name || 'Sala de voz'}</span><small>{callMembers.length ? `${callMembers.length} em chamada` : 'Entre para conversar'}</small></div><span className="voice-count">{callMembers.length}/6</span></button><div className="sidebar-call-members">{callMembers.map(m => <div key={m.id}><Avatar name={m.name} /><span>{m.name}</span>{m.muted ? <MicOff size={13} /> : <Mic size={13} />}</div>)}</div><div className="sidebar-tip"><Coffee size={23} /><p>As melhores ideias começam com uma boa conversa.</p></div></div><div className={`connection-panel ${!connected ? 'offline' : ''}`}><Signal size={17} /><div><strong>{statusText}</strong><small>{room?.name || 'Seu espaço'} / Conversa</small></div>{inCall && <button className="icon-button" title="Sair da chamada" onClick={leaveCall} aria-label="Sair da chamada"><PhoneOff size={17} /></button>}</div><div className="profile"><Avatar name={session.name} status={connected} /><div><strong>{session.name}</strong><small>{connected ? 'Disponível' : 'Offline'}</small></div><button className="icon-button" onClick={() => setModal('settings')} aria-label="Configurar perfil"><Settings2 size={18} /></button></div></aside>
      <main className="main-panel"><header className="room-header"><div className="header-channel"><span className="hash-box"><Hash size={23} /></span><div><h1>{room?.name || 'Conectando…'}</h1><p>{room?.description}</p></div></div><div className="header-actions"><span className="online-pill"><i />{members.length} online</span><button className="secondary invite" onClick={invite} disabled={!room}><Users size={16} /> Convidar</button></div></header>
      {!connected && <div className="disconnect-banner">Você está desconectado. <button onClick={disconnect}>Voltar e reconectar <ArrowRight size={14} /></button></div>}
      <div className="room-content"><div className="conversation-column"><section className={`stage ${inCall ? 'in-call' : ''}`}><div className="stage-heading"><div><span className="eyebrow">{inCall ? 'VOCÊ ESTÁ NA CHAMADA' : 'UM ESPAÇO PARA ESTAR JUNTO'}</span><h2>{inCall ? 'A conversa acontece aqui.' : 'Aproxime a conversa.'}</h2></div><span className="stage-tag"><Radio size={13} />{inCall ? 'Ao vivo' : 'Voz + tela'}</span></div>
      {screenMembers.length ? <div className="screens">{screenMembers.map(m => <div className="screen-card" key={m.id}><Media stream={m.id === session.id ? media.display : remoteStream(m.id)?.stream} video muted /><div className="screen-caption"><span><Monitor size={14} /> Tela de {m.name}</span><span className="live-label">AO VIVO</span></div></div>)}</div> : <div className="stage-tiles">{callMembers.length ? callMembers.map(m => <div className={`person-tile ${colorFor(m.name)}`} key={m.id}><Avatar name={m.name} large /><span className="tile-name">{m.name}{m.id === session.id ? ' (você)' : ''}</span><span className="tile-mic">{m.muted ? <MicOff size={15} /> : <Mic size={15} />}</span>{m.id !== session.id && <small className="peer-status">{remoteStream(m.id)?.state === 'connected' ? 'Conectado' : 'Conectando…'}</small>}</div>) : <div className="empty-stage"><div className="empty-symbol"><Headphones size={35} /><span><Monitor size={20} /></span></div><div><h3>Tem lugar para todo mundo.</h3><p>Entre na chamada, abra o microfone<br />e compartilhe o que está na sua tela.</p></div><button className="primary" onClick={joinCall} disabled={!connected || callPending}><Headphones size={16} />{callPending ? 'Preparando…' : 'Entrar na chamada'}<ArrowRight size={16} /></button></div>}</div>}
      {inCall && <div className="call-controls"><div className="call-quality"><i className="live-dot" /><span>{callMembers.length} {callMembers.length === 1 ? 'pessoa' : 'pessoas'} na chamada</span></div><div className="control-buttons"><button className={`call-button ${media.muted ? 'is-off' : ''}`} onClick={() => callRef.current.toggleMicrophone().catch(e => notify(e.message))} aria-label={media.muted ? 'Ativar microfone' : 'Silenciar microfone'} title={media.muted ? 'Ativar microfone' : 'Silenciar microfone'}>{media.muted ? <MicOff size={19} /> : <Mic size={19} />}</button><button className={`call-button ${deafened ? 'is-off' : ''}`} onClick={() => setDeafened(!deafened)} aria-label={deafened ? 'Ativar áudio' : 'Silenciar áudio'} title={deafened ? 'Ativar áudio' : 'Silenciar áudio'}>{deafened ? <VolumeX size={19} /> : <Headphones size={19} />}</button><div className="control-divider" /><button className={`call-button share-button ${media.display ? 'is-sharing' : ''}`} onClick={share} disabled={sharingPending} aria-label={media.display ? 'Parar compartilhamento' : 'Compartilhar tela'} title={media.display ? 'Parar compartilhamento' : 'Compartilhar tela'}><MonitorUp size={19} /><span>{sharingPending ? 'Escolhendo…' : media.display ? 'Parar tela' : 'Compartilhar'}</span></button><button className="call-button hangup" onClick={leaveCall} aria-label="Encerrar chamada" title="Sair da chamada"><PhoneOff size={20} /></button></div></div>}
      {!inCall && callMembers.length > 0 && <div className="call-controls"><span>{callMembers.length} em chamada agora</span><button className="primary" disabled={!connected || callPending} onClick={joinCall}><Headphones size={16} />{callPending ? 'Preparando…' : 'Participar'}</button></div>}
      </section><section className="chat-section"><div className="chat-heading"><h2><MessageCircle size={17} /> Na conversa</h2><span>Um lugar para trocar ideias</span></div><div className="messages" role="log" aria-label="Mensagens da sala">{!messages.length && <div className="chat-welcome"><span className="chat-welcome-icon"><Hash size={29} /></span><h3>Este é o começo de #{room?.name}.</h3><p>Mande um oi. O resto vem com a conversa.</p></div>}{messages.map((message, index) => {
                  const previous = messages[index - 1];
                  const grouped = previous?.author === message.author && message.created - previous.created < 120000;
                  return <article key={message.id} className={`message ${grouped ? 'grouped' : ''}`}>{!grouped ? <Avatar name={message.author} /> : <span className="message-spacer" />}<div>{!grouped && <div className="message-meta"><strong>{message.author}</strong><time title={new Date(message.created).toLocaleString('pt-BR')}>{new Date(message.created).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}</time></div>}<p>{message.text}</p></div></article>;
                })}<div ref={scrollRef} /></div><form className="composer" onSubmit={e => {
                e.preventDefault();
                if (!draft.trim() || !connected) return;
                send({
                  type: 'message',
                  text: draft
                });
                setDraft('');
              }}><span className="composer-icon"><MessageCircle size={19} /></span><textarea aria-label="Mensagem" placeholder={`Conversar em #${room?.name || 'geral'}`} rows={1} maxLength={2000} value={draft} disabled={!connected} onChange={e => setDraft(e.target.value)} onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    e.currentTarget.form.requestSubmit();
                  }
                }} /><button className="send-button" disabled={!connected || !draft.trim()} aria-label="Enviar mensagem"><ArrowRight size={20} /></button></form><div className="composer-footer"><span><kbd>Enter</kbd> para enviar · <kbd>Shift + Enter</kbd> para nova linha</span><span>{draft.length}/2000</span></div></section></div>
      <aside className="members-panel"><div className="section-label">POR AQUI <span>{members.length.toString().padStart(2, '0')}</span></div>{members.map(m => <div className="member" key={m.id}><Avatar name={m.name} status /><div><strong>{m.name}{m.id === session.id && <span> você</span>}</strong><small>{m.sharing ? 'Compartilhando tela' : m.inCall ? 'Na chamada de voz' : 'Disponível para um papo'}</small></div>{m.sharing ? <Monitor size={14} /> : m.inCall && <Headphones size={14} />}</div>)}<div className="member-invite"><div className="invite-art"><Users size={29} /><Sparkles size={16} /></div><h3>Melhor com o grupo.</h3><p>Chame alguém para fazer parte da conversa.</p><button className="secondary" onClick={invite} disabled={!room}><Plus size={15} /> Convidar pessoas</button></div><div className="room-details"><span className="eyebrow">SOBRE ESTE ESPAÇO</span><p>Conversas leves.<br />Ideias compartilhadas.<br />Gente por perto.</p><div><span className="tiny-logo"><MessageCircle size={15} /></span> conversa <span>v0.1</span></div></div></aside></div><footer className="app-footer"><span><span className={`status-dot ${connected ? '' : 'offline'}`} />{connected ? 'Conectado ao seu espaço' : 'Sem conexão'}</span><span>Feito para pequenos grupos <span className="footer-dot">·</span> Windows</span></footer></main>
      {streams.map(s => <Media key={s.id} stream={s.stream} muted={deafened} />)}
    </div>}
    {modal === 'create' && <Modal title="Um novo lugar para conversar" onClose={() => setModal(null)}><p className="modal-description">Crie uma sala para um assunto, um projeto ou só para reunir o grupo.</p><form onSubmit={e => {
        e.preventDefault();
        if (roomName.trim()) send({
          type: 'create-room',
          name: roomName
        });
      }}><label htmlFor="room-name">Nome da sala</label><input id="room-name" autoFocus maxLength={32} required placeholder="Ex.: noite de jogos" value={roomName} onChange={e => setRoomName(e.target.value)} /><button className="primary modal-submit" disabled={!roomName.trim() || !connected}>Criar sala <Plus size={17} /></button></form></Modal>}
    {modal === 'settings' && <Modal title="Do seu jeito" onClose={() => setModal(null)}><div className="settings-profile"><Avatar name={session.name} large /><div><h3>{session.name}</h3><p>Perfil de convidado</p></div></div><label htmlFor="quality">Qualidade do compartilhamento</label><select id="quality" value={quality} onChange={e => setQuality(e.target.value)}><option value="720">720p · mais leve</option><option value="1080">1080p · mais detalhes</option></select><label className="checkbox-label"><input type="checkbox" checked={systemAudio} onChange={e => setSystemAudio(e.target.checked)} /><span>Incluir áudio do sistema<small>No Windows, pode incluir o som de todos os aplicativos.</small></span></label><div className="server-info"><span>Servidor conectado</span><code>{session.server}</code><small>Prévia para grupos de até 6 pessoas. Sem autenticação de contas.</small></div><button className="secondary modal-submit" onClick={disconnect}><LogOut size={17} /> Sair e trocar de servidor</button></Modal>}
    {capture && <Modal title="O que vamos compartilhar?" wide onClose={() => {
      window.desktop.selectCapture(capture.requestId, null);
      setCapture(null);
    }}><p className="modal-description">Escolha uma janela ou tela. Só o conteúdo selecionado será transmitido.{systemAudio && ' O áudio do sistema também será incluído.'}</p><div className="capture-grid">{capture.sources.map(source => <button key={source.id} onClick={() => {
          window.desktop.selectCapture(capture.requestId, source.id);
          setCapture(null);
        }}><img src={source.thumbnail} alt="" /><span><Monitor size={15} />{source.name}</span></button>)}</div></Modal>}
    {toast && <div className="toast" role="status"><MessageCircle size={18} /><span>{toast}</span><button className="icon-button" onClick={() => setToast('')} aria-label="Fechar aviso"><X size={16} /></button></div>}
  </>;
}
createRoot(document.getElementById('root')).render(<App />);