import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AudioLines, ArrowRight, Check, ChevronDown, Clipboard, Coffee, Hash, Headphones, LogOut, MessageCircle, Mic, MicOff, Monitor, MonitorUp, MoreHorizontal, Phone, PhoneOff, Plus, Radio, Settings2, Signal, Sparkles, Users, Volume2, VolumeX, X } from 'lucide-react';
import { version } from '../package.json';
import { createBrowserCall } from './rtc.js';
import { Session } from './session';
import './style.css';

const initials = name => name.trim().split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase();
const colors = ['mint', 'peach', 'lavender', 'blue', 'pink'];
const colorFor = name => colors[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length];
function Avatar({ name, large = false, status = false }) { return <span className={`avatar ${colorFor(name)} ${large ? 'large' : ''}`}>{initials(name)}{status && <i />}</span>; }
function diagnostic(error, phase) {
  const codes = ['MEDIA_FAILED','INVALID_EVENT','INVALID_INPUT','INCOMPATIBLE_PROTOCOL','ROOM_MISMATCH','OPERATION_CONFLICT','RATE_LIMITED','CALL_FULL','TIMEOUT','PERSISTENCE_FAILED','CONNECTION_FAILED','CANCELLED'];
  const phases = ['client','media','microphone','admission','call-join','call-leave','capture','capture-prepare','capture-inventory','capture-selection','capture-finish','screen-publication','playback','preferences','join','message','create-room','configuration','websocket','hello','protocol'];
  const id = value => typeof value === 'string' && value.length > 0 && value.length <= 128 ? value : null;
  const cause = ['Error','TypeError','RangeError','SyntaxError','AbortError','NotAllowedError','NotFoundError','NotReadableError','InvalidStateError','OverconstrainedError'].includes(error.name) ? error.name : 'Error';
  console.warn(JSON.stringify({ phase: phases.includes(error.phase) ? error.phase : phase, code: codes.includes(error.code) ? error.code : 'MEDIA_FAILED',
    requestId:id(error.requestId), callId:id(error.callId), operationId:id(error.operationId), generation:Number.isSafeInteger(error.generation) && error.generation > 0 ? error.generation : null,
    version, runtime:navigator.userAgent, cause }));
}
function Media({ stream, callId, generation, video = false, muted = false, ...props }) {
  const ref = useRef(null);
  useEffect(() => {
    const element = ref.current;
    element.srcObject = stream || null;
    if (stream) element.play().catch(error => diagnostic({name:error.name,callId,generation}, 'playback'));
    return () => { element.pause(); element.srcObject = null; };
  }, [stream, callId, generation]);
  return video ? <video ref={ref} autoPlay playsInline muted={muted} {...props} /> : <audio ref={ref} autoPlay muted={muted} />;
}
function Modal({ title, children, onClose, wide = false }) {
  const ref = useRef(null), closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    const dialog = ref.current, previous = document.activeElement;
    const background = [...document.getElementById('root').children].filter(element => !element.contains(dialog));
    const prior = background.map(element => [element, element.inert]);
    background.forEach(element => { element.inert = true; });
    const focusable = () => [...dialog.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[href],[tabindex]:not([tabindex="-1"])')].filter(element => element.getClientRects().length);
    (dialog.querySelector('input,select,textarea') || focusable()[0] || dialog).focus();
    const keydown = event => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current?.(); }
      if (event.key === 'Tab') {
        const targets = focusable(), first = targets[0], last = targets.at(-1);
        if (!first) { event.preventDefault(); dialog.focus(); }
        else if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', keydown, true);
    return () => {
      document.removeEventListener('keydown', keydown, true);
      prior.forEach(([element, inert]) => { element.inert = inert; });
      const target = previous?.isConnected && !previous.disabled ? previous : document.querySelector('.call-controls button:not([disabled]),.app-shell button:not([disabled])');
      target?.focus();
    };
  }, [title]);
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose?.(); }}><section ref={ref} tabIndex={-1} className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}><div className="modal-title"><h2>{title}</h2>{onClose && <button className="icon-button" onClick={onClose} aria-label="Fechar"><X size={20} /></button>}</div>{children}</section></div>;
}
function App() {
  const preferences = window.desktop?.preferences || {};
  const [name, setName] = useState(preferences.name || localStorage.getItem('conversa.name') || '');
  const [serverInput, setServerInput] = useState(new URLSearchParams(location.search).get('server') || preferences.server || localStorage.getItem('conversa.server') || '');
  const [transport, setTransport] = useState(null);
  const [streams, setStreams] = useState([]);
  const [media, setMedia] = useState({ muted: true, display: null, pending: false, admitted: false });
  const [deafened, setDeafened] = useState(false);
  const [toast, setToast] = useState('');
  const [modal, setModal] = useState(null);
  const [roomName, setRoomName] = useState('');
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [quality, setQuality] = useState(preferences.quality || '1080');
  const [systemAudio, setSystemAudio] = useState(false);
  const [capture, setCapture] = useState(null);
  const [sharingPending, setSharingPending] = useState(false);
  const sessionRef = useRef(null), callRef = useRef(null), scrollRef = useRef(null), toastTimer = useRef(null), captureRef = useRef(null), displayRequest = useRef(null), audioMuted = useRef(false), autoScroll = useRef(true), callAttempt = useRef(0);
  captureRef.current = capture;
  function notify(text) { setToast(text); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 6500); }
  function report(error, phase = 'client') {
    if (error.code === 'CANCELLED' || error.name === 'AbortError') return;
    diagnostic(error, phase);
    notify(error.message && error.message !== error.code ? error.message : 'Não foi possível concluir. Confira a conexão e tente novamente.');
  }
  function cancelPicker() {
    if (displayRequest.current) cancelDisplay(displayRequest.current.key);
    captureRef.current = null; setCapture(null);
  }
  function captureMatches(key) {
    const current = displayRequest.current?.key;
    return current && key && current.callId === key.callId && current.generation === key.generation && current.operationId === key.operationId;
  }
  function cancelDisplay(key) { if (captureMatches(key)) window.desktop?.cancelCapture(key); }
  function captureDisplay(key, constraints) {
    if (!window.desktop?.prepareCapture) return navigator.mediaDevices.getDisplayMedia(constraints);
    const failure = result => Object.assign(new Error(result.phase === 'capture-inventory' ? 'Não foi possível listar as fontes de tela.' : 'Não foi possível concluir a captura de tela.'), { code:result.code || 'MEDIA_FAILED', phase:result.phase || 'capture', requestId:result.requestId || null, ...key });
    if (displayRequest.current) return Promise.reject(failure({ code:'INVALID_EVENT',phase:'capture-prepare' }));
    const prepared = window.desktop.prepareCapture(key);
    if (!prepared.ok) return Promise.reject(failure(prepared));
    const operation = { key }; displayRequest.current = operation;
    let acquisition;
    try { acquisition = navigator.mediaDevices.getDisplayMedia(constraints); }
    catch (error) { acquisition = Promise.reject(error); }
    return Promise.resolve(acquisition).then(stream => {
      const result = window.desktop.finishCapture(key);
      if (result.outcome !== 'selected') { stream.getTracks().forEach(track => track.stop()); throw failure(result); }
      return stream;
    }, () => {
      const result = window.desktop.finishCapture(key);
      throw failure(result.outcome === 'selected' ? { ...result,code:'MEDIA_FAILED',phase:'capture' } : result);
    }).finally(() => {
      if (displayRequest.current === operation) { displayRequest.current = null; captureRef.current = null; setCapture(null); }
    });
  }
  if (!sessionRef.current) sessionRef.current = new Session({
    onState: setTransport, onError: report,
    onPresence: members => callRef.current?.sync(members),
    onSignal: event => callRef.current?.signal(event.from, event.signal, event.fromCallId),
    onDisconnect: () => {
      ++callAttempt.current;
      const call = callRef.current; callRef.current = null; call?.close();
      cancelPicker(); setStreams([]); setMedia({ muted: true, display: null, pending: false, admitted: false }); setSharingPending(false);
      window.desktop?.setPlaybackEnabled(false);
    },
  });
  const { session, connected, connecting: joining, rooms, room, roomPending, members, messages, draft, outbox } = transport || sessionRef.current.state;
  const inCall = connected && media.admitted, callPending = media.pending;
  const screenState = sharingPending === 'stopping' ? 'stopping' : media.sharingState || 'idle';
  const screenLabel = {selecting:'Escolhendo…',publishing:'Publicando…',active:'Parar tela',stopping:'Parando…',idle:'Compartilhar'}[screenState];
  const setDraft = value => sessionRef.current.setDraft(value);
  useEffect(() => {
    const unsubscribe = window.desktop?.onCaptureSources(value => {
      if (!captureMatches(value.key) || !callRef.current?.admitted) { window.desktop?.selectCapture(value.key, value.requestId, null); return; }
      setModal(null); captureRef.current = value; setCapture(value);
    });
    const unsubscribeError = window.desktop?.onCaptureError(value => { if (captureMatches(value.key)) { captureRef.current = null; setCapture(null); } });
    const cleanup = () => { sessionRef.current.disconnect(); clearTimeout(toastTimer.current); };
    window.addEventListener('beforeunload', cleanup);
    return () => { unsubscribe?.(); unsubscribeError?.(); window.removeEventListener('beforeunload', cleanup); cleanup(); };
  }, []);
  useEffect(() => { if (autoScroll.current) scrollRef.current?.scrollIntoView({ behavior: 'auto' }); }, [messages]);
  useEffect(() => { window.desktop?.setPlaybackEnabled(!!(sessionRef.current.state.connected && callRef.current?.admitted && !audioMuted.current)); }, [inCall, deafened]);
  function toggleAudio() {
    const next = !audioMuted.current; audioMuted.current = next;
    window.desktop?.setPlaybackEnabled(!!(sessionRef.current.state.connected && callRef.current?.admitted && !next));
    setDeafened(next);
  }
  function savePreferences(nextQuality = quality) {
    const value = { name: name.trim(), server: serverInput.trim(), quality: nextQuality };
    if (window.desktop?.savePreferences) window.desktop.savePreferences(value).catch(error => report(error, 'preferences'));
    else { localStorage.setItem('conversa.name', value.name); localStorage.setItem('conversa.server', value.server); }
  }
  async function enter(event) {
    event.preventDefault();
    try { const result = await sessionRef.current.connect({ name, server: serverInput, room: new URLSearchParams(location.search).get('room') || 'geral' }); if (result) savePreferences(); }
    catch { /* Session already reports and terminates failed attempts. */ }
  }
  function leaveCall() {
    ++callAttempt.current;
    cancelPicker(); setSharingPending(false); window.desktop?.setPlaybackEnabled(false);
    void callRef.current?.leave();
    callRef.current?.close(); callRef.current = null;
  }
  async function changeRoom(next) {
    if (next.id === room?.id || roomPending) return;
    leaveCall(); autoScroll.current = true;
    try { await sessionRef.current.changeRoom(next.id); } catch (error) { report(error, 'join'); }
  }
  async function joinCall() {
    if (callPending || inCall || !connected || !room || roomPending) return;
    let call = callRef.current;
    if (!call || call.closed) {
      const epoch = sessionRef.current.epoch;
      call = createBrowserCall({ id: session.id, iceServers: sessionRef.current.state.config.iceServers, send: event => sessionRef.current.request(event),
        nextCallGeneration: () => sessionRef.current.nextCallGeneration(epoch),
        captureDisplay, cancelDisplay,
        onStreams: value => { if (callRef.current === call) setStreams(value); },
        onMedia: value => { if (callRef.current === call) { window.desktop?.setPlaybackEnabled(!!(value.admitted && sessionRef.current.state.connected && !audioMuted.current)); setMedia(value); } },
        onError: error => { if (callRef.current === call) report(error, 'media'); } });
      callRef.current = call; call.sync(members);
    }
    const attempt = ++callAttempt.current;
    try { await call.join(); } catch (error) { if (callRef.current === call && callAttempt.current === attempt) report(error, 'admission'); }
  }
  async function toggleMicrophone() {
    const call = callRef.current, generation = call?.generation;
    try { await call?.toggleMicrophone(); }
    catch (error) { if (callRef.current === call && call?.generation === generation) report(error, 'microphone'); }
  }
  async function share() {
    const call = callRef.current; if (!call?.admitted) return;
    const generation = call.generation;
    setSharingPending(call.display ? 'stopping' : 'selecting');
    try { if (call.display) await call.stopScreen(); else await call.shareScreen(systemAudio, quality); }
    catch (error) { if (callRef.current === call && call.generation === generation && error.name !== 'NotAllowedError') report(error, 'capture'); }
    finally { if (callRef.current === call && call.generation === generation) { setSharingPending(false); cancelPicker(); } }
  }
  function disconnect() { sessionRef.current.disconnect(); setModal(null); }
  async function createRoom(event) {
    event.preventDefault(); if (!roomName.trim() || creatingRoom) return;
    setCreatingRoom(true);
    try { const result = await sessionRef.current.request({ type: 'create-room', name: roomName }); setModal(null); setRoomName(''); await changeRoom(result.room); }
    catch (error) { report(error, 'create-room'); }
    finally { setCreatingRoom(false); }
  }
  async function submitMessage(event) { event.preventDefault(); try { await sessionRef.current.sendText(); } catch (error) { report(error, 'message'); } }
  async function invite() {
    const link = new URL(session.server); link.searchParams.set('room', room.id);
    try { await navigator.clipboard.writeText(link.href); notify(['localhost', '127.0.0.1'].includes(link.hostname) ? 'Link local copiado. Para outro computador, use um servidor de grupo acessível pela rede.' : 'Convite copiado. Cole o link no campo Servidor do grupo.'); }
    catch { notify(`Endereço do servidor: ${session.server} · sala: ${room.name}`); }
  }
  const callMembers = members.filter(member => member.inCall);
  const remoteStream = id => streams.find(stream => stream.id === id);
  const screenMembers = callMembers.filter(member => member.sharing && (member.id === session?.id ? !!media.display : remoteStream(member.id)?.state === 'connected' && remoteStream(member.id).stream?.getVideoTracks().some(track => track.readyState === 'live')));
  const statusText = !connected ? 'Desconectado' : callPending ? 'Preparando chamada' : !inCall ? 'Tudo pronto para conversar' : streams.some(stream => stream.state === 'connected') ? 'Voz conectada' : streams.some(stream => stream.state === 'failed') ? 'Mídia indisponível' : callMembers.length <= 1 ? 'Na chamada · aguardando participantes' : 'Conectando mídia…';

  return <>
    {!session ? <main className="welcome"><div className="welcome-art"><span className="brand"><MessageCircle size={28} fill="currentColor" strokeWidth={1.5} /> conversa<span className="version">PRÉVIA</span></span><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="welcome-illustration"><div className="floating-bubble"><AudioLines size={62}/></div><div className="floating-screen"><Monitor size={64}/><span>ideias em boa companhia</span><i className="live-dot"/></div><div className="floating-smile">:)</div></div><div className="welcome-copy"><span className="eyebrow">MENOS DISTÂNCIA. MAIS CONVERSA.</span><h1>Seu grupo.<br/>No mesmo lugar.</h1><p>Um papo que flui, uma tela que aproxima.<br/>Chegue, conecte e fique à vontade.</p></div><span className="art-footer">Feito para estar junto <Sparkles size={15}/></span></div><div className="welcome-form"><div className="form-inner"><span className="eyebrow">BEM-VINDO AO CONVERSA</span><h2>Vamos nos encontrar?</h2><p>Escolha como o grupo vai chamar você.</p><form onSubmit={enter}><label htmlFor="name">Seu nome</label><input id="name" autoFocus maxLength={32} value={name} onChange={e => setName(e.target.value)} placeholder="Como você se chama?" required/><label htmlFor="server">Servidor do grupo <span>opcional</span></label><input id="server" value={serverInput} onChange={e => setServerInput(e.target.value)} placeholder="Local ou https://seu-servidor.com"/><small>Deixe vazio para testar neste computador. Para conversar com amigos, todos devem usar o mesmo servidor.</small><button className="primary enter" disabled={joining || !name.trim()}>{joining ? 'Conectando…' : 'Entrar no Conversa'}<ArrowRight size={18}/></button></form><div className="welcome-features"><span><MessageCircle size={16}/> Texto</span><span><Mic size={16}/> Voz</span><span><Monitor size={16}/> Tela</span></div><p className="guest-note">Acesso como convidado · sem cadastro nesta prévia</p></div></div></main> : <div className="app-shell">
      <nav className="workspace-rail" aria-label="Espaços"><div className="rail-logo"><MessageCircle size={26} fill="currentColor"/></div><div className="rail-separator"/><button className="workspace active" title="Seu espaço"><span>C</span><i/></button><button className="workspace add" onClick={() => setModal('create')} aria-label="Criar sala"><Plus size={22}/></button><div className="rail-bottom"><span className="windows-label">PC</span><button className="icon-button" title="Configurações" onClick={() => setModal('settings')} aria-label="Configurações"><Settings2 size={22}/></button></div></nav>
      <aside className="room-sidebar"><div className="space-header"><div><span className="eyebrow">SEU PONTO DE ENCONTRO</span><h2>Nosso espaço <ChevronDown size={17}/></h2></div></div><div className="sidebar-scroll"><div className="space-banner"><span className="banner-icon"><Sparkles size={18}/></span><strong>Boa companhia,<br/>a um clique.</strong><span className="banner-orb"/></div><div className="section-label">CONVERSAS<button className="icon-button" aria-label="Adicionar sala" onClick={() => setModal('create')}><Plus size={15}/></button></div><div className="channels">{rooms.map(r => <button key={r.id} disabled={!connected || roomPending} onClick={() => changeRoom(r)} className={`channel ${room?.id === r.id ? 'selected' : ''}`}><Hash size={19}/><span>{r.name}</span>{room?.id === r.id && <i/>}</button>)}</div><div className="section-label voice-heading">ENCONTRO AO VIVO <Radio size={13}/></div><button disabled={!connected || callPending || !room || roomPending} className={`voice-channel ${inCall ? 'joined' : ''}`} onClick={inCall ? () => {} : joinCall}><Volume2 size={19}/><div><span>{room?.name || 'Sala de voz'}</span><small>{callMembers.length ? `${callMembers.length} em chamada` : 'Entre para conversar'}</small></div><span className="voice-count">{callMembers.length}/6</span></button><div className="sidebar-call-members">{callMembers.map(m => <div key={m.id}><Avatar name={m.name}/><span>{m.name}</span>{m.muted ? <MicOff size={13}/> : <Mic size={13}/>}</div>)}</div><div className="sidebar-tip"><Coffee size={23}/><p>As melhores ideias começam com uma boa conversa.</p></div></div><div className={`connection-panel ${!connected ? 'offline' : ''}`}><Signal size={17}/><div><strong>{statusText}</strong><small>{room?.name || 'Seu espaço'} / Conversa</small></div>{inCall && <button className="icon-button" title="Sair da chamada" onClick={leaveCall} aria-label="Sair da chamada"><PhoneOff size={17}/></button>}</div><div className="profile"><Avatar name={session.name} status={connected}/><div><strong>{session.name}</strong><small>{connected ? 'Disponível' : 'Offline'}</small></div><button className="icon-button" onClick={() => setModal('settings')} aria-label="Configurar perfil"><Settings2 size={18}/></button></div></aside>
      <main className="main-panel"><header className="room-header"><div className="header-channel"><span className="hash-box"><Hash size={23}/></span><div><h1>{room?.name || 'Conectando…'}</h1><p>{room?.description}</p></div></div><div className="header-actions"><span className="online-pill"><i/>{members.length} online</span><button className="secondary invite" onClick={invite} disabled={!room}><Users size={16}/> Convidar</button></div></header>
      {!connected && <div className="disconnect-banner">Você está desconectado. <button onClick={disconnect}>Voltar e reconectar <ArrowRight size={14}/></button></div>}
      <div className="room-content"><div className="conversation-column"><section className={`stage ${inCall ? 'in-call' : ''}`}><div className="stage-heading"><div><span className="eyebrow">{inCall ? 'VOCÊ ESTÁ NA CHAMADA' : 'UM ESPAÇO PARA ESTAR JUNTO'}</span><h2>{inCall ? 'A conversa acontece aqui.' : 'Aproxime a conversa.'}</h2></div><span className="stage-tag"><Radio size={13}/>{inCall ? 'Ao vivo' : 'Voz + tela'}</span></div>
      {inCall && screenMembers.length ? <div className="screens">{screenMembers.map(m => <div className="screen-card" key={m.id}><Media stream={m.id === session.id ? media.display : remoteStream(m.id)?.stream} callId={callRef.current?.callId} generation={callRef.current?.generation} video muted/><div className="screen-caption"><span><Monitor size={14}/> Tela de {m.name}</span><span className="live-label">AO VIVO</span></div></div>)}</div> : <div className="stage-tiles">{callMembers.length ? callMembers.map(m => <div className={`person-tile ${colorFor(m.name)}`} key={m.id}><Avatar name={m.name} large/><span className="tile-name">{m.name}{m.id === session.id ? ' (você)' : ''}</span><span className="tile-mic">{m.muted ? <MicOff size={15}/> : <Mic size={15}/>}</span>{m.id !== session.id && <small className="peer-status">{remoteStream(m.id)?.state === 'connected' ? 'Conectado' : remoteStream(m.id)?.state === 'failed' ? 'Falha na mídia. Saia e entre novamente.' : 'Conectando…'}</small>}</div>) : <div className="empty-stage"><div className="empty-symbol"><Headphones size={35}/><span><Monitor size={20}/></span></div><div><h3>Tem lugar para todo mundo.</h3><p>Entre na chamada, abra o microfone<br/>e compartilhe o que está na sua tela.</p></div><button className="primary" onClick={joinCall} disabled={!connected || callPending || !room || roomPending}><Headphones size={16}/>{callPending ? 'Preparando…' : 'Entrar na chamada'}<ArrowRight size={16}/></button></div>}</div>}
      {callPending && <div className="call-controls"><span>Preparando chamada…</span><button className="secondary" onClick={leaveCall}>Cancelar entrada</button></div>}{inCall && <div className="call-controls"><div className="call-quality"><i className="live-dot"/><span>{callMembers.length} {callMembers.length === 1 ? 'pessoa' : 'pessoas'} na chamada</span></div><div className="control-buttons"><button className={`call-button ${media.muted ? 'is-off' : ''}`} onClick={toggleMicrophone} aria-label={media.muted ? 'Ativar microfone' : 'Silenciar microfone'} title={media.muted ? 'Ativar microfone' : 'Silenciar microfone'}>{media.muted ? <MicOff size={19}/> : <Mic size={19}/>}</button><button className={`call-button ${deafened ? 'is-off' : ''}`} onClick={toggleAudio} aria-label={deafened ? 'Ativar áudio' : 'Silenciar áudio'} title={deafened ? 'Ativar áudio' : 'Silenciar áudio'}>{deafened ? <VolumeX size={19}/> : <Headphones size={19}/>}</button><div className="control-divider"/><button className={`call-button share-button ${media.display ? 'is-sharing' : ''}`} onClick={share} disabled={!!sharingPending} aria-busy={['selecting','publishing','stopping'].includes(screenState)} aria-label={media.display ? 'Parar compartilhamento' : 'Compartilhar tela'} title={media.display ? 'Parar compartilhamento' : 'Compartilhar tela'}><MonitorUp size={19}/><span>{screenLabel}</span></button><button className="call-button hangup" onClick={leaveCall} aria-label="Encerrar chamada" title="Sair da chamada"><PhoneOff size={20}/></button></div></div>}
      {!inCall && callMembers.length > 0 && <div className="call-controls"><span>{callMembers.length} em chamada agora</span><button className="primary" disabled={!connected || callPending || !room || roomPending} onClick={joinCall}><Headphones size={16}/>{callPending ? 'Preparando…' : 'Participar'}</button></div>}
      </section><section className="chat-section"><div className="chat-heading"><h2><MessageCircle size={17}/> Na conversa</h2><span>Um lugar para trocar ideias</span></div><div className="messages" role="log" aria-label="Mensagens da sala" onScroll={event => { const element = event.currentTarget; autoScroll.current = element.scrollHeight - element.scrollTop - element.clientHeight <= 100; }}>{!messages.length && <div className="chat-welcome"><span className="chat-welcome-icon"><Hash size={29}/></span><h3>Este é o começo de #{room?.name}.</h3><p>Mande um oi. O resto vem com a conversa.</p></div>}{messages.map((message, index) => { const previous = messages[index - 1]; const grouped = !!message.authorId && previous?.authorId === message.authorId && message.created - previous.created < 120000; return <article key={message.id} className={`message ${grouped ? 'grouped' : ''}`}>{!grouped ? <Avatar name={message.author}/> : <span className="message-spacer"/>}<div>{!grouped && <div className="message-meta"><strong>{message.author}</strong><time title={new Date(message.created).toLocaleString('pt-BR')}>{new Date(message.created).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time></div>}<p>{message.text}</p></div></article>; })}{outbox.map(item => <article className="pending-message" key={item.operationId} data-operation-id={item.operationId}><p>{item.text}</p><span>{item.status === 'pending' ? 'Enviando…' : 'Falha no envio. Seu texto está preservado.'}</span>{item.status === 'failed' && <button className="secondary" disabled={!connected || roomPending} aria-label="Reenviar mensagem" onClick={() => sessionRef.current.retry(item.operationId).catch(error => report(error, 'message'))}>Reenviar</button>}</article>)}<div ref={scrollRef}/></div><form className="composer" onSubmit={submitMessage}><span className="composer-icon"><MessageCircle size={19}/></span><textarea aria-label="Mensagem" placeholder={`Conversar em #${room?.name || 'geral'}`} rows={1} maxLength={2000} value={draft} disabled={!connected || roomPending || !room} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form.requestSubmit(); } }}/><button className="send-button" disabled={!connected || roomPending || !room || !draft.trim()} aria-label="Enviar mensagem"><ArrowRight size={20}/></button></form><div className="composer-footer"><span><kbd>Enter</kbd> para enviar · <kbd>Shift + Enter</kbd> para nova linha</span><span>{draft.length}/2000</span></div></section></div>
      <aside className="members-panel"><div className="section-label">POR AQUI <span>{members.length.toString().padStart(2, '0')}</span></div>{members.map(m => <div className="member" key={m.id}><Avatar name={m.name} status/><div><strong>{m.name}{m.id === session.id && <span> você</span>}</strong><small>{m.sharing ? 'Compartilhando tela' : m.inCall ? 'Na chamada de voz' : 'Disponível para um papo'}</small></div>{m.sharing ? <Monitor size={14}/> : m.inCall && <Headphones size={14}/>}</div>)}<div className="member-invite"><div className="invite-art"><Users size={29}/><Sparkles size={16}/></div><h3>Melhor com o grupo.</h3><p>Chame alguém para fazer parte da conversa.</p><button className="secondary" onClick={invite} disabled={!room}><Plus size={15}/> Convidar pessoas</button></div><div className="room-details"><span className="eyebrow">SOBRE ESTE ESPAÇO</span><p>Conversas leves.<br/>Ideias compartilhadas.<br/>Gente por perto.</p><div><span className="tiny-logo"><MessageCircle size={15}/></span> conversa <span>v0.1</span></div></div></aside></div><footer className="app-footer"><span><span className={`status-dot ${connected ? '' : 'offline'}`}/>{connected ? 'Conectado ao seu espaço' : 'Sem conexão'}</span><span>Feito para pequenos grupos <span className="footer-dot">·</span> Windows</span></footer></main>
      {inCall && streams.filter(s => s.stream).map(s => <Media key={s.id} stream={s.stream} callId={callRef.current?.callId} generation={callRef.current?.generation} muted={!inCall || deafened}/>)}
    </div>}
    {modal === 'create' && <Modal title="Um novo lugar para conversar" onClose={() => setModal(null)}><p className="modal-description">Crie uma sala para um assunto, um projeto ou só para reunir o grupo.</p><form onSubmit={createRoom}><label htmlFor="room-name">Nome da sala</label><input id="room-name" maxLength={32} required placeholder="Ex.: noite de jogos" value={roomName} onChange={e => setRoomName(e.target.value)}/><button className="primary modal-submit" disabled={!roomName.trim() || !connected || creatingRoom}>Criar sala <Plus size={17}/></button></form></Modal>}
    {modal === 'settings' && <Modal title="Do seu jeito" onClose={() => setModal(null)}><div className="settings-profile"><Avatar name={session.name} large/><div><h3>{session.name}</h3><p>Perfil de convidado</p></div></div><label htmlFor="quality">Qualidade do compartilhamento</label><select id="quality" value={quality} onChange={e => { setQuality(e.target.value); savePreferences(e.target.value); }}><option value="720">720p · mais leve</option><option value="1080">1080p · mais detalhes</option></select>{media.display && <p className="quality-note">A qualidade selecionada vale para a próxima captura.</p>}<label className="checkbox-label"><input type="checkbox" checked={systemAudio} onChange={e => setSystemAudio(e.target.checked)}/><span>Incluir áudio do sistema<small>No Windows, pode incluir o som de todos os aplicativos, inclusive da chamada.</small></span></label><div className="server-info"><span>Servidor conectado</span><code>{session.server}</code><small>Prévia para grupos de até 6 pessoas. Sem autenticação de contas.</small></div><button className="secondary modal-submit" onClick={disconnect}><LogOut size={17}/> Sair e trocar de servidor</button></Modal>}
    {capture && <Modal title="O que vamos compartilhar?" wide onClose={cancelPicker}><p className="modal-description">Escolha uma janela ou tela. Só o conteúdo selecionado será transmitido.{systemAudio && ' O áudio do sistema pode incluir todos os aplicativos, inclusive a própria chamada.'}</p><div className="capture-grid">{capture.sources.map(source => <button key={source.id} onClick={() => { window.desktop.selectCapture(capture.key, capture.requestId, source.id); setCapture(null); }}><img src={source.thumbnail} alt=""/><span><Monitor size={15}/>{source.name}</span></button>)}</div></Modal>}
    {toast && <div className="toast" role="status"><MessageCircle size={18}/><span>{toast}</span><button className="icon-button" onClick={() => setToast('')} aria-label="Fechar aviso"><X size={16}/></button></div>}
  </>;
}
createRoot(document.getElementById('root')).render(<App/>);
