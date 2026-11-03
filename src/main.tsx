import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { AudioLines, ArrowRight, Check, ChevronDown, Clipboard, Coffee, Hash, Headphones, LogOut, MessageCircle, Mic, MicOff, Monitor, MonitorUp, MoreHorizontal, Phone, PhoneOff, Plus, Radio, Settings2, Signal, Sparkles, Users, Volume2, VolumeX, X } from 'lucide-react';
import metadata from '../package.json' with {type:'json'};
import { createBrowserCall } from './rtc.js';
import type { LocalMedia, RemoteMedia } from './rtc.js';
import { Session, parseInvite } from './session.js';
import type { SessionState } from './session.js';
import { ProtocolError, PROTOCOL_VERSION, LIMITS, readGroup, readGroups } from '../shared/protocol.js';
import type { Group, Room } from '../shared/protocol.js';
import type { CaptureKey, CaptureSources, Preferences } from '../shared/desktop.js';
import './style.css';
const version=metadata.version;

const object=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const initials = (name:string) => name.trim().split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase();
const colors = ['mint', 'peach', 'lavender', 'blue', 'pink'];
const colorFor = (name:string) => colors[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length];
function Avatar({ name, large = false, status = false }:{name:string;large?:boolean;status?:boolean}) { return <span className={`avatar ${colorFor(name)} ${large ? 'large' : ''}`}>{initials(name)}{status && <i />}</span>; }
function diagnostic(value:unknown, phase:string) {
  const error=object(value)?value:{};
  const codes = ['MEDIA_FAILED','INVALID_EVENT','INVALID_INPUT','INCOMPATIBLE_PROTOCOL','ROOM_MISMATCH','OPERATION_CONFLICT','RATE_LIMITED','CALL_FULL','TIMEOUT','PERSISTENCE_FAILED','CONNECTION_FAILED','CANCELLED'];
  const phases = ['client','media','microphone','admission','call-join','call-leave','capture','capture-prepare','capture-inventory','capture-selection','capture-finish','screen-publication','playback','preferences','join','message','create-room','configuration','websocket','hello','protocol'];
  codes.push('UNAUTHENTICATED','USERNAME_TAKEN','FORBIDDEN','NOT_FOUND','SERVER_REQUIRED','SHUTTING_DOWN');phases.push('authentication','ticket','logout','groups','group-create','invite-create','invite-accept','invite-revoke');
  const id = (value:unknown) => typeof value === 'string' && value.length > 0 && value.length <= 128 ? value : null;
  const cause = typeof error.name==='string'&&['Error','TypeError','RangeError','SyntaxError','AbortError','NotAllowedError','NotFoundError','NotReadableError','InvalidStateError','OverconstrainedError'].includes(error.name) ? error.name : 'Error';
  console.warn(JSON.stringify({ phase: typeof error.phase==='string'&&phases.includes(error.phase) ? error.phase : phase, code: typeof error.code==='string'&&codes.includes(error.code) ? error.code : 'MEDIA_FAILED',
    requestId:id(error.requestId), callId:id(error.callId), operationId:id(error.operationId), generation:typeof error.generation==='number'&&Number.isSafeInteger(error.generation) && error.generation > 0 ? error.generation : null,
    version, runtime:navigator.userAgent, cause }));
}
function Media({ stream, callId, generation, video = false, muted = false }:{stream?:MediaStream|null;callId?:string;generation?:number;video?:boolean;muted?:boolean}) {
  const ref = useRef<HTMLVideoElement|HTMLAudioElement|null>(null);
  useEffect(() => {
    const element = ref.current;
    if(!element)return;
    element.srcObject = stream || null;
    if (stream) element.play().catch((error:unknown) => diagnostic({name:object(error)?error.name:undefined,callId,generation}, 'playback'));
    return () => { element.pause(); element.srcObject = null; };
  }, [stream, callId, generation]);
  const attach=(element:HTMLVideoElement|HTMLAudioElement|null)=>{ref.current=element;};
  return video ? <video ref={attach} autoPlay playsInline muted={muted} /> : <audio ref={attach} autoPlay muted={muted} />;
}
function Modal({ title, children, onClose, wide = false }:{title:string;children:ReactNode;onClose?:()=>void;wide?:boolean}) {
  const ref = useRef<HTMLElement|null>(null), closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    const dialog = ref.current, previous = document.activeElement;
    const root=document.getElementById('root');if(!dialog||!root)return;
    const background = Array.from(root.children).filter((element):element is HTMLElement => element instanceof HTMLElement&&!element.contains(dialog));
    const prior = background.map(element => ({element,inert:element.inert}));
    background.forEach(element => { element.inert = true; });
    const focusable = () => Array.from(dialog.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[href],[tabindex]:not([tabindex="-1"])')).filter((element):element is HTMLElement => element instanceof HTMLElement&&element.getClientRects().length>0);
    const preferred=dialog.querySelector('input,select,textarea');(preferred instanceof HTMLElement?preferred:focusable()[0]??dialog).focus();
    const keydown = (event:KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current?.(); }
      if (event.key === 'Tab') {
        const targets = focusable(), first = targets[0], last = targets.at(-1);
        if (!first) { event.preventDefault(); dialog.focus(); }
        else if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); (last??first).focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', keydown, true);
    return () => {
      document.removeEventListener('keydown', keydown, true);
      prior.forEach(({element, inert}) => { element.inert = inert; });
      const target = previous instanceof HTMLElement&&previous.isConnected&&(!('disabled' in previous)||previous.disabled!==true) ? previous : document.querySelector<HTMLButtonElement>('.call-controls button:not([disabled]),.app-shell button:not([disabled])');
      target?.focus();
    };
  }, [title]);
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose?.(); }}><section ref={ref} tabIndex={-1} className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}><div className="modal-title"><h2>{title}</h2>{onClose && <button className="icon-button" onClick={onClose} aria-label="Fechar"><X size={20} /></button>}</div>{children}</section></div>;
}
const emptyMedia=():LocalMedia<MediaStream>=>({muted:true,display:null,pending:false,admitted:false,sharingState:'idle'});
type NativeCall=ReturnType<typeof createBrowserCall>;
type Invitation={id:string;code:string;groupId:string;expiresAt:number;revoked:boolean};
function App() {
  const preferences = window.desktop?.preferences;
  const [name, setName] = useState(preferences?.name || localStorage.getItem('conversa.name') || '');
  const [serverInput, setServerInput] = useState(new URLSearchParams(location.search).get('server') || preferences?.server || localStorage.getItem('conversa.server') || '');
  const [transport, setTransport] = useState<SessionState|null>(null);
  const [streams, setStreams] = useState<RemoteMedia<MediaStream>[]>([]);
  const [media, setMedia] = useState<LocalMedia<MediaStream>>(emptyMedia);
  const [deafened, setDeafened] = useState(false);
  const [toast, setToast] = useState('');
  const [modal, setModal] = useState<'create'|'settings'|'group-create'|'group-join'|'invite'|null>(null);
  const [roomName, setRoomName] = useState('');
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [quality, setQuality] = useState<Preferences['quality']>(preferences?.quality || '1080');
  const [systemAudio, setSystemAudio] = useState(false);
  const [capture, setCapture] = useState<CaptureSources|null>(null);
  const [sharingPending, setSharingPending] = useState<false|'selecting'|'stopping'>(false);
  const [username,setUsername]=useState(''),[password,setPassword]=useState(''),[registering,setRegistering]=useState(true),[guestMode,setGuestMode]=useState(false);
  const [ownMode,setOwnMode]=useState<'loading'|'client'|'required'|'trusted-local'>('loading');
  const [groups,setGroups]=useState<Group[]>([]),[groupsError,setGroupsError]=useState(false),[groupName,setGroupName]=useState(''),[inviteCode,setInviteCode]=useState('');
  const [groupPending,setGroupPending]=useState(false),[creatingInvite,setCreatingInvite]=useState(false),[revokingInvite,setRevokingInvite]=useState(false),[invitation,setInvitation]=useState<Invitation|null>(null);
  const groupLoad=useRef(0);
  const sessionRef = useRef<Session|null>(null), callRef = useRef<NativeCall|null>(null), scrollRef = useRef<HTMLDivElement|null>(null), toastTimer = useRef<ReturnType<typeof setTimeout>|undefined>(undefined), captureRef = useRef<CaptureSources|null>(null), displayRequest = useRef<{key:CaptureKey}|null>(null), audioMuted = useRef(false), autoScroll = useRef(true), callAttempt = useRef(0);
  captureRef.current = capture;
  function notify(text:string) { setToast(text); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 6500); }
  function report(value:unknown, phase = 'client') {
    const error=object(value)?value:{};
    if (error.code === 'CANCELLED' || error.name === 'AbortError') return;
    diagnostic(error, phase);
    if(error.code==='UNAUTHENTICATED')setGuestMode(false);
    notify(error.code==='NOT_FOUND'&&phase==='invite-accept'?'Convite inválido, expirado ou já usado.':typeof error.message==='string'&&error.message!==error.code?error.message:'Não foi possível concluir. Confira a conexão e tente novamente.');
  }
  function cancelPicker() {
    if (displayRequest.current) cancelDisplay(displayRequest.current.key);
    captureRef.current = null; setCapture(null);
  }
  function captureMatches(key:CaptureKey) {
    const current = displayRequest.current?.key;
    return current && key && current.callId === key.callId && current.generation === key.generation && current.operationId === key.operationId;
  }
  function cancelDisplay(key:CaptureKey) { if (captureMatches(key)) window.desktop?.cancelCapture(key); }
  function captureDisplay(key:CaptureKey, constraints:DisplayMediaStreamOptions):Promise<MediaStream> {
    const desktop=window.desktop;
    if (!desktop?.prepareCapture) return navigator.mediaDevices.getDisplayMedia(constraints);
    const failure = (result:{code?:string|null;phase?:string;requestId?:string|null}) => Object.assign(new Error(result.phase === 'capture-inventory' ? 'Não foi possível listar as fontes de tela.' : 'Não foi possível concluir a captura de tela.'), { code:result.code || 'MEDIA_FAILED', phase:result.phase || 'capture', requestId:result.requestId || null, ...key });
    if (displayRequest.current) return Promise.reject(failure({ code:'INVALID_EVENT',phase:'capture-prepare' }));
    const prepared = desktop.prepareCapture(key);
    if (!prepared.ok) return Promise.reject(failure(prepared));
    const operation = { key }; displayRequest.current = operation;
    let acquisition:Promise<MediaStream>;
    try { acquisition = navigator.mediaDevices.getDisplayMedia(constraints); }
    catch (error) { acquisition = Promise.reject(error); }
    return Promise.resolve(acquisition).then(stream => {
      const result = desktop.finishCapture(key);
      if (result.outcome !== 'selected') { stream.getTracks().forEach(track => track.stop()); throw failure(result); }
      return stream;
    }, () => {
      const result = desktop.finishCapture(key);
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
      cancelPicker(); setStreams([]); setMedia(emptyMedia()); setSharingPending(false);
      ++groupLoad.current;setGroups([]);setGroupsError(false);setInvitation(null);setModal(null);
      window.desktop?.setPlaybackEnabled(false);
    },
  });
  const controller=sessionRef.current;
  const { session, connected, connecting: joining, rooms, room, roomPending, members, messages, draft, outbox } = transport || controller.state;
  const account=controller.accountId!==null;
  const activeGroup=account?(room?groups.find(group=>group.rooms.some(item=>item.id===room.id)):groups[0]):undefined;
  const visibleRooms=account?activeGroup?.rooms??[]:rooms;
  const canAdmin=!account||activeGroup?.ownerId===controller.accountId;
  const accountEmpty=account&&!room&&!roomPending&&!rooms.length;
  const inCall = connected && media.admitted, callPending = media.pending;
  useEffect(()=>{
    const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),LIMITS.requestMs);let current=true;
    void fetch('/api/server',{signal:abort.signal}).then(async response=>{const value:unknown=await response.json();if(!current)return;const mode=object(value)&&value.protocolVersion===PROTOCOL_VERSION&&(value.authentication==='trusted-local'||value.authentication==='required')?value.authentication:'client';if(mode==='trusted-local'){setOwnMode('trusted-local');setGuestMode(true);}else setOwnMode(mode==='required'?'required':'client');}).catch(()=>{if(current)setOwnMode('client');}).finally(()=>clearTimeout(timer));
    return ()=>{current=false;clearTimeout(timer);abort.abort();};
  },[]);
  async function refreshGroups(){
    const request=++groupLoad.current;
    try{const value=await controller.api('/api/groups');if(request!==groupLoad.current)return;if(!object(value))throw new ProtocolError('INVALID_EVENT');setGroups(readGroups(value.groups));setGroupsError(false);}
    catch(error){if(request===groupLoad.current){setGroupsError(true);report(error,'groups');}}
  }
  useEffect(()=>{if(connected&&controller.accountId!==null)void refreshGroups();},[connected,session?.id,rooms]);
  const screenState = sharingPending === 'stopping' ? 'stopping' : media.sharingState || 'idle';
  const screenLabel = {selecting:'Escolhendo…',publishing:'Publicando…',active:'Parar tela',stopping:'Parando…',idle:'Compartilhar'}[screenState];
  const setDraft = (value:string) => controller.setDraft(value);
  useEffect(() => {
    const unsubscribe = window.desktop?.onCaptureSources(value => {
      if (!captureMatches(value.key) || !callRef.current?.admitted) { window.desktop?.selectCapture(value.key, value.requestId, null); return; }
      setModal(null); captureRef.current = value; setCapture(value);
    });
    const unsubscribeError = window.desktop?.onCaptureError(value => { if (captureMatches(value.key)) { captureRef.current = null; setCapture(null); } });
    const cleanup = () => { controller.disconnect(); clearTimeout(toastTimer.current); };
    window.addEventListener('beforeunload', cleanup);
    return () => { unsubscribe?.(); unsubscribeError?.(); window.removeEventListener('beforeunload', cleanup); cleanup(); };
  }, []);
  useEffect(() => { if (autoScroll.current) scrollRef.current?.scrollIntoView({ behavior: 'auto' }); }, [messages]);
  useEffect(() => { window.desktop?.setPlaybackEnabled(!!(controller.state.connected && callRef.current?.admitted && !audioMuted.current)); }, [inCall, deafened]);
  function toggleAudio() {
    const next = !audioMuted.current; audioMuted.current = next;
    window.desktop?.setPlaybackEnabled(!!(controller.state.connected && callRef.current?.admitted && !next));
    setDeafened(next);
  }
  function savePreferences(nextQuality:Preferences['quality'] = quality, server=serverInput) {
    const value:Preferences = { name: controller.state.session?.name??name.trim(), server: server.trim(), quality: nextQuality };
    if (window.desktop?.savePreferences) window.desktop.savePreferences(value).catch(error => report(error, 'preferences'));
    else { localStorage.setItem('conversa.name', value.name); localStorage.setItem('conversa.server', value.server); }
  }
  async function enter(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const field=new FormData(event.currentTarget).get('server');
    const server=guestMode&&typeof field==='string'?field:'';
    setServerInput(server);
    if(guestMode){try{const destination=parseInvite(server,controller.localOrigin);if(!['localhost','127.0.0.1','[::1]'].includes(new URL(destination.server).hostname))throw new ProtocolError('INVALID_INPUT','Convidados estão disponíveis apenas no modo local de confiança.');}catch(error){report(error,'authentication');return;}}
    try {
      let result;
      if(guestMode){result=await controller.connect({name,server,room:new URLSearchParams(location.search).get('room')||'geral'});}
      else result=await controller.signIn({server,username,password,register:registering,...(new URLSearchParams(location.search).has('room')?{room:new URLSearchParams(location.search).get('room')??''}:{})});
      if(result){setPassword('');clearTimeout(toastTimer.current);setToast('');savePreferences(quality,server);}
    }catch{/* Session reports and terminates the failed attempt. */}
  }
  function leaveCall() {
    ++callAttempt.current;
    cancelPicker(); setSharingPending(false); window.desktop?.setPlaybackEnabled(false);
    void callRef.current?.leave();
    callRef.current?.close(); callRef.current = null;
  }
  async function changeRoom(next:Room) {
    if (next.id === room?.id || roomPending) return;
    leaveCall(); autoScroll.current = true;
    try { await controller.changeRoom(next.id); } catch (error) { report(error, 'join'); }
  }
  async function joinCall() {
    if (callPending || inCall || !connected || !room || roomPending || !session || !controller.state.config) return;
    let call = callRef.current;
    if (!call || call.closed) {
      const epoch = controller.epoch;
      call = createBrowserCall({ id: session.id, iceServers: controller.state.config.iceServers, send: event => controller.request(event),
        nextCallGeneration: () => controller.nextCallGeneration(epoch),
        captureDisplay, cancelDisplay,
        onStreams: value => { if (callRef.current === call) setStreams(value); },
        onMedia: value => { if (callRef.current === call) { window.desktop?.setPlaybackEnabled(!!(value.admitted && controller.state.connected && !audioMuted.current)); setMedia(value); } },
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
    catch (error) { if (callRef.current === call && call.generation === generation && (!object(error)||error.name !== 'NotAllowedError')) report(error, 'capture'); }
    finally { if (callRef.current === call && call.generation === generation) { setSharingPending(false); cancelPicker(); } }
  }
  function disconnect() {setPassword('');setModal(null);setGroups([]);setInvitation(null);setRegistering(false);if(account)void controller.logout().catch(error=>report(error,'logout'));else controller.disconnect();}
  async function reconnect(){const token=controller.accessToken;try{await controller.connect({name,server:controller.origin,...(room?{room:room.id}:{}),...(token?{token}:{})});}catch{/* Session reports the failed attempt. */}}
  async function startConnection(){
    if(groupPending||!connected)return;setGroupPending(true);
    try{const value=await controller.api('/api/groups',{method:'POST',input:{name:'Conexões'}},'group-create');if(!object(value))throw new ProtocolError('INVALID_EVENT');const created=readGroup(value.group);await refreshGroups();await changeRoom(created.rooms[0]);notify('Conexão pronta. Chame alguém quando quiser.');}
    catch(error){report(error,'group-create');}finally{setGroupPending(false);}
  }
  async function createGroup(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(groupPending||!groupName.trim())return;setGroupPending(true);
    try{const value=await controller.api('/api/groups',{method:'POST',input:{name:groupName}},'group-create');if(!object(value))throw new ProtocolError('INVALID_EVENT');const created=readGroup(value.group);await refreshGroups();await changeRoom(created.rooms[0]);setGroupName('');setModal(null);notify('Grupo criado.');}
    catch(error){report(error,'group-create');}finally{setGroupPending(false);}
  }
  async function acceptInvite(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(groupPending||!inviteCode.trim())return;setGroupPending(true);
    try{const value=await controller.api('/api/invites/accept',{method:'POST',input:{code:inviteCode.trim()}},'invite-accept');if(!object(value))throw new ProtocolError('INVALID_EVENT');const joined=readGroup(value.group);await refreshGroups();await changeRoom(joined.rooms[0]);setInviteCode('');setModal(null);notify('Você entrou no grupo.');}
    catch(error){report(error,'invite-accept');}finally{setGroupPending(false);}
  }
  async function copyInvite(){if(!invitation||invitation.revoked)return;try{await navigator.clipboard.writeText(invitation.code);notify('Código copiado.');}catch{notify('Selecione o código e use Ctrl+C para copiar.');}}
  async function revokeInvite(){if(!invitation||revokingInvite)return;setRevokingInvite(true);try{await controller.api(`/api/groups/${encodeURIComponent(invitation.groupId)}/invites/${encodeURIComponent(invitation.id)}`,{method:'DELETE'},'invite-revoke');setInvitation({...invitation,revoked:true});notify('Convite revogado.');}catch(error){report(error,'invite-revoke');}finally{setRevokingInvite(false);}}
  async function createRoom(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!roomName.trim() || creatingRoom) return;
    setCreatingRoom(true);
    try { const result = await controller.request({ type: 'create-room', name: roomName }); if(account)await refreshGroups();setModal(null); setRoomName(''); await changeRoom(result.room); }
    catch (error) { report(error, 'create-room'); }
    finally { setCreatingRoom(false); }
  }
  async function submitMessage(event:FormEvent<HTMLFormElement>) { event.preventDefault(); try { await controller.sendText(); } catch (error) { report(error, 'message'); } }
  async function invite() {
    if(!session||!room)return;
    if(account){if(!activeGroup||!canAdmin||creatingInvite)return;setCreatingInvite(true);try{const value=await controller.api(`/api/groups/${encodeURIComponent(activeGroup.id)}/invites`,{method:'POST',input:{}},'invite-create');if(!object(value)||typeof value.id!=='string'||!value.id||typeof value.code!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(value.code)||value.groupId!==activeGroup.id||typeof value.expiresAt!=='number'||!Number.isSafeInteger(value.expiresAt)||value.expiresAt<=0)throw new ProtocolError('INVALID_EVENT');setInvitation({id:value.id,code:value.code,groupId:activeGroup.id,expiresAt:value.expiresAt,revoked:false});setModal('invite');}catch(error){report(error,'invite-create');}finally{setCreatingInvite(false);}return;}
    const link = new URL(session.server); link.searchParams.set('room', room.id);
    try { await navigator.clipboard.writeText(link.href); notify(['localhost', '127.0.0.1'].includes(link.hostname) ? 'Link local copiado. Para outro computador, use um servidor de grupo acessível pela rede.' : 'Convite copiado. Cole o link no campo Servidor do grupo.'); }
    catch { notify(`Endereço do servidor: ${session.server} · sala: ${room.name}`); }
  }
  const callMembers = members.filter(member => member.inCall);
  const remoteStream = (id:string) => streams.find(stream => stream.id === id);
  const screenMembers = callMembers.filter(member => {if(!member.sharing)return false;if(member.id===session?.id)return !!media.display;const remote=remoteStream(member.id);return remote?.state==='connected'&&remote.stream?.getVideoTracks().some(track=>track.readyState==='live');});
  const statusText = !connected ? 'Desconectado' : callPending ? 'Preparando chamada' : !inCall ? 'Tudo pronto para conversar' : streams.some(stream => stream.state === 'connected') ? 'Voz conectada' : streams.some(stream => stream.state === 'failed') ? 'Mídia indisponível' : callMembers.length <= 1 ? 'Na chamada · aguardando participantes' : 'Conectando mídia…';

  return <>
    {!session ? <main className="welcome"><div className="welcome-art"><span className="brand"><MessageCircle size={28} fill="currentColor" strokeWidth={1.5}/> drocsid<span className="version">PRÉVIA</span></span><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="welcome-illustration"><div className="floating-bubble"><AudioLines size={62}/></div><div className="floating-screen"><Monitor size={64}/><span>ideias em boa companhia</span><i className="live-dot"/></div><div className="floating-smile">:)</div></div><div className="welcome-copy"><span className="eyebrow">MENOS DISTÂNCIA. MAIS CONVERSA.</span><h1>Suas conexões.<br/>No mesmo lugar.</h1><p>Um papo que flui, uma tela que aproxima.<br/>Chegue, conecte e fique à vontade.</p></div><span className="art-footer">Feito para estar junto <Sparkles size={15}/></span></div>
      <div className="welcome-form"><div className="form-inner"><span className="eyebrow">BEM-VINDO AO DROCSID</span><h2>Vamos nos encontrar?</h2><p>{guestMode?'Teste local com convidados de confiança.':registering?'Crie sua conta. As conexões vêm primeiro.':'Entre com sua conta. O servidor pode esperar.'}</p>
        <form onSubmit={enter}>
          {guestMode?<><label htmlFor="name">Seu nome</label><input id="name" autoFocus maxLength={32} value={name} onChange={event=>setName(event.target.value)} placeholder="Como você se chama?" required disabled={joining}/></>:<><label htmlFor="username">Usuário</label><input id="username" autoComplete="username" autoCapitalize="none" minLength={2} maxLength={32} pattern="[a-z0-9_.]{2,32}" value={username} onChange={event=>setUsername(event.target.value)} required disabled={joining}/><small>2–32 caracteres: letras minúsculas, números, _ ou .</small><label htmlFor="password">Senha</label><input id="password" type="password" minLength={15} maxLength={128} autoComplete={registering?'new-password':'current-password'} value={password} onChange={event=>setPassword(event.target.value)} required disabled={joining}/>{registering&&<small>Use uma senha de 15 a 128 caracteres.</small>}</>}
          {guestMode&&<><label htmlFor="server">Servidor do grupo <span>opcional</span></label><input id="server" name="server" value={serverInput} onChange={event=>setServerInput(event.target.value)} placeholder="https://seu-servidor.com" disabled={joining}/><small>Deixe vazio para testar neste computador. O servidor precisa habilitar o modo local de confiança.</small></>}
          <button className="primary enter" disabled={joining||ownMode==='loading'||(guestMode?!name.trim():!username.trim()||!password)}>{joining?'Conectando…':!guestMode&&registering?'Criar conta':'Entrar no Drocsid'}<ArrowRight size={18}/></button>
        </form>
        <div className="auth-actions">{guestMode?<button className="auth-link" disabled={joining} onClick={()=>{setGuestMode(false);setPassword('');}}>Entrar com conta</button>:<><button className="auth-link" disabled={joining} onClick={()=>{setRegistering(!registering);setPassword('');}}>{registering?'Já tenho conta':'Criar uma conta'}</button><button className="auth-link" disabled={joining} onClick={()=>{setGuestMode(true);setPassword('');}}>Teste local</button></>}</div>
        <div className="welcome-features"><span><MessageCircle size={16}/> Texto</span><span><Mic size={16}/> Voz</span><span><Monitor size={16}/> Tela</span></div><p className="guest-note">{guestMode?'Convidados somente no modo local de confiança.':'Contas e conexões. O servidor entra depois. Câmera indisponível nesta prévia.'}</p>
      </div></div></main> : <div className="app-shell">
      <nav className="workspace-rail" aria-label="Espaços"><div className="rail-logo"><MessageCircle size={26} fill="currentColor"/></div><div className="rail-separator"/>{account?<><div className="group-list" aria-label="Grupos">{groups.map(group=><button key={group.id} className={`workspace ${activeGroup?.id===group.id?'active':''}`} disabled={!connected||roomPending} onClick={()=>void changeRoom(group.rooms[0])} aria-label={`Abrir grupo ${group.name}`} title={group.name}><span>{initials(group.name)}</span>{activeGroup?.id===group.id&&<i/>}</button>)}</div><button className="workspace add" onClick={()=>setModal('group-create')} disabled={!connected} aria-label="Criar grupo"><Plus size={22}/></button><button className="workspace add" onClick={()=>setModal('group-join')} disabled={!connected} aria-label="Entrar em grupo"><Users size={20}/></button></>:<><button className="workspace active" title="Seu espaço"><span>D</span><i/></button><button className="workspace add" onClick={()=>setModal('create')} aria-label="Criar sala"><Plus size={22}/></button></>}<div className="rail-bottom"><span className="windows-label">PC</span><button className="icon-button" title="Configurações" onClick={() => setModal('settings')} aria-label="Configurações"><Settings2 size={22}/></button></div></nav>
      <aside className="room-sidebar"><div className="space-header"><div><span className="eyebrow">SEU PONTO DE ENCONTRO</span><h2>{account?activeGroup?.name??'Conexões':'Nosso espaço'} <ChevronDown size={17}/></h2></div></div><div className="sidebar-scroll"><div className="space-banner"><span className="banner-icon"><Sparkles size={18}/></span><strong>Boa companhia,<br/>a um clique.</strong><span className="banner-orb"/></div>{groupsError&&<div className="group-error" role="status">Não foi possível atualizar os grupos.<button className="auth-link" onClick={()=>void refreshGroups()}>Tentar novamente</button></div>}<div className="section-label">CONVERSAS<button className="icon-button" aria-label="Adicionar sala" disabled={!connected||roomPending||!canAdmin} onClick={() => setModal('create')}><Plus size={15}/></button></div><div className="channels">{visibleRooms.map(r => <button key={r.id} disabled={!connected || roomPending} onClick={() => changeRoom(r)} className={`channel ${room?.id === r.id ? 'selected' : ''}`}><Hash size={19}/><span>{r.name}</span>{room?.id === r.id && <i/>}</button>)}</div><div className="section-label voice-heading">ENCONTRO AO VIVO <Radio size={13}/></div><button disabled={!connected || callPending || !room || roomPending} className={`voice-channel ${inCall ? 'joined' : ''}`} onClick={inCall ? () => {} : joinCall}><Volume2 size={19}/><div><span>{room?.name || 'Sala de voz'}</span><small>{callMembers.length ? `${callMembers.length} em chamada` : 'Entre para conversar'}</small></div><span className="voice-count">{callMembers.length}/6</span></button><div className="sidebar-call-members">{callMembers.map(m => <div key={m.id}><Avatar name={m.name}/><span>{m.name}</span>{m.muted ? <MicOff size={13}/> : <Mic size={13}/>}</div>)}</div><div className="sidebar-tip"><Coffee size={23}/><p>As melhores ideias começam com uma boa conversa.</p></div></div><div className={`connection-panel ${!connected ? 'offline' : ''}`}><Signal size={17}/><div><strong>{statusText}</strong><small>{room?.name || 'Seu espaço'} / Drocsid</small></div>{inCall && <button className="icon-button" title="Sair da chamada" onClick={leaveCall} aria-label="Sair da chamada"><PhoneOff size={17}/></button>}</div><div className="profile"><Avatar name={session.name} status={connected}/><div><strong>{session.name}</strong><small>{connected ? 'Disponível' : 'Offline'}</small></div><button className="icon-button" onClick={() => setModal('settings')} aria-label="Configurar perfil"><Settings2 size={18}/></button></div></aside>
      <main className="main-panel"><header className="room-header"><div className="header-channel"><span className="hash-box"><Hash size={23}/></span><div><h1>{room?.name || (accountEmpty?'Suas conexões':'Conectando…')}</h1><p>{room?.description}</p></div></div><div className="header-actions"><span className="online-pill"><i/>{members.length} online</span><button className="secondary invite" onClick={invite} disabled={!room||!canAdmin||creatingInvite}><Users size={16}/> Convidar</button></div></header>
      {!connected && <div className="disconnect-banner">Você está desconectado. <button onClick={reconnect}>Reconectar <ArrowRight size={14}/></button></div>}
      {accountEmpty?<section className="account-empty"><Users size={42}/><h2>Suas conexões</h2><p>Chame alguém para conversar. Um servidor é um lugar a mais, e pode esperar.</p><div><button className="primary" onClick={()=>void startConnection()} disabled={!connected||groupPending}>Começar uma conexão <ArrowRight size={17}/></button><button className="secondary" onClick={()=>setModal('group-join')}>Tenho um convite</button></div></section>:<div className="room-content"><div className="conversation-column"><section className={`stage ${inCall ? 'in-call' : ''}`}><div className="stage-heading"><div><span className="eyebrow">{inCall ? 'VOCÊ ESTÁ NA CHAMADA' : 'UM ESPAÇO PARA ESTAR JUNTO'}</span><h2>{inCall ? 'A conversa acontece aqui.' : 'Aproxime a conversa.'}</h2></div><span className="stage-tag"><Radio size={13}/>{inCall ? 'Ao vivo' : 'Voz + tela'}</span></div>
      {inCall && screenMembers.length ? <div className="screens">{screenMembers.map(m => <div className="screen-card" key={m.id}><Media stream={m.id === session.id ? media.display : remoteStream(m.id)?.stream} callId={callRef.current?.callId} generation={callRef.current?.generation} video muted/><div className="screen-caption"><span><Monitor size={14}/> Tela de {m.name}</span><span className="live-label">AO VIVO</span></div></div>)}</div> : <div className="stage-tiles">{callMembers.length ? callMembers.map(m => <div className={`person-tile ${colorFor(m.name)}`} key={m.id}><Avatar name={m.name} large/><span className="tile-name">{m.name}{m.id === session.id ? ' (você)' : ''}</span><span className="tile-mic">{m.muted ? <MicOff size={15}/> : <Mic size={15}/>}</span>{m.id !== session.id && <small className="peer-status">{remoteStream(m.id)?.state === 'connected' ? 'Conectado' : remoteStream(m.id)?.state === 'failed' ? 'Falha na mídia. Saia e entre novamente.' : 'Conectando…'}</small>}</div>) : <div className="empty-stage"><div className="empty-symbol"><Headphones size={35}/><span><Monitor size={20}/></span></div><div><h3>Tem lugar para todo mundo.</h3><p>Entre na chamada, abra o microfone<br/>e compartilhe o que está na sua tela.</p></div><button className="primary" onClick={joinCall} disabled={!connected || callPending || !room || roomPending}><Headphones size={16}/>{callPending ? 'Preparando…' : 'Entrar na chamada'}<ArrowRight size={16}/></button></div>}</div>}
      {callPending && <div className="call-controls"><span>Preparando chamada…</span><button className="secondary" onClick={leaveCall}>Cancelar entrada</button></div>}{inCall && <div className="call-controls"><div className="call-quality"><i className="live-dot"/><span>{callMembers.length} {callMembers.length === 1 ? 'pessoa' : 'pessoas'} na chamada</span></div><div className="control-buttons"><button className={`call-button ${media.muted ? 'is-off' : ''}`} onClick={toggleMicrophone} aria-label={media.muted ? 'Ativar microfone' : 'Silenciar microfone'} title={media.muted ? 'Ativar microfone' : 'Silenciar microfone'}>{media.muted ? <MicOff size={19}/> : <Mic size={19}/>}</button><button className={`call-button ${deafened ? 'is-off' : ''}`} onClick={toggleAudio} aria-label={deafened ? 'Ativar áudio' : 'Silenciar áudio'} title={deafened ? 'Ativar áudio' : 'Silenciar áudio'}>{deafened ? <VolumeX size={19}/> : <Headphones size={19}/>}</button><div className="control-divider"/><button className={`call-button share-button ${media.display ? 'is-sharing' : ''}`} onClick={share} disabled={!!sharingPending} aria-busy={['selecting','publishing','stopping'].includes(screenState)} aria-label={media.display ? 'Parar compartilhamento' : 'Compartilhar tela'} title={media.display ? 'Parar compartilhamento' : 'Compartilhar tela'}><MonitorUp size={19}/><span>{screenLabel}</span></button><button className="call-button hangup" onClick={leaveCall} aria-label="Encerrar chamada" title="Sair da chamada"><PhoneOff size={20}/></button></div></div>}
      {!inCall && callMembers.length > 0 && <div className="call-controls"><span>{callMembers.length} em chamada agora</span><button className="primary" disabled={!connected || callPending || !room || roomPending} onClick={joinCall}><Headphones size={16}/>{callPending ? 'Preparando…' : 'Participar'}</button></div>}
      </section><section className="chat-section"><div className="chat-heading"><h2><MessageCircle size={17}/> Na conversa</h2><span>Um lugar para trocar ideias</span></div><div className="messages" role="log" aria-label="Mensagens da sala" onScroll={event => { const element = event.currentTarget; autoScroll.current = element.scrollHeight - element.scrollTop - element.clientHeight <= 100; }}>{!messages.length && <div className="chat-welcome"><span className="chat-welcome-icon"><Hash size={29}/></span><h3>Este é o começo de #{room?.name}.</h3><p>Mande um oi. O resto vem com a conversa.</p></div>}{messages.map((message, index) => { const previous = messages[index - 1]; const grouped = !!message.authorId && previous?.authorId === message.authorId && message.created - previous.created < 120000; return <article key={message.id} className={`message ${grouped ? 'grouped' : ''}`}>{!grouped ? <Avatar name={message.author}/> : <span className="message-spacer"/>}<div>{!grouped && <div className="message-meta"><strong>{message.author}</strong><time title={new Date(message.created).toLocaleString('pt-BR')}>{new Date(message.created).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time></div>}<p>{message.text}</p></div></article>; })}{outbox.map(item => <article className="pending-message" key={item.operationId} data-operation-id={item.operationId}><p>{item.text}</p><span>{item.status === 'pending' ? 'Enviando…' : 'Falha no envio. Seu texto está preservado.'}</span>{item.status === 'failed' && <button className="secondary" disabled={!connected || roomPending} aria-label="Reenviar mensagem" onClick={() => controller.retry(item.operationId).catch(error => report(error, 'message'))}>Reenviar</button>}</article>)}<div ref={scrollRef}/></div><form className="composer" onSubmit={submitMessage}><span className="composer-icon"><MessageCircle size={19}/></span><textarea aria-label="Mensagem" placeholder={`Conversar em #${room?.name || 'geral'}`} rows={1} maxLength={2000} value={draft} disabled={!connected || roomPending || !room} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}/><button className="send-button" disabled={!connected || roomPending || !room || !draft.trim()} aria-label="Enviar mensagem"><ArrowRight size={20}/></button></form><div className="composer-footer"><span><kbd>Enter</kbd> para enviar · <kbd>Shift + Enter</kbd> para nova linha</span><span>{draft.length}/2000</span></div></section></div>
      <aside className="members-panel"><div className="section-label">POR AQUI <span>{members.length.toString().padStart(2, '0')}</span></div>{members.map(m => <div className="member" key={m.id}><Avatar name={m.name} status/><div><strong>{m.name}{m.id === session.id && <span> você</span>}</strong><small>{m.sharing ? 'Compartilhando tela' : m.inCall ? 'Na chamada de voz' : 'Disponível para um papo'}</small></div>{m.sharing ? <Monitor size={14}/> : m.inCall && <Headphones size={14}/>}</div>)}<div className="member-invite"><div className="invite-art"><Users size={29}/><Sparkles size={16}/></div><h3>Melhor com o grupo.</h3><p>Chame alguém para fazer parte da conversa.</p><button className="secondary" onClick={invite} disabled={!room||!canAdmin||creatingInvite}><Plus size={15}/> Convidar pessoas</button></div><div className="room-details"><span className="eyebrow">SOBRE ESTE ESPAÇO</span><p>Conversas leves.<br/>Ideias compartilhadas.<br/>Gente por perto.</p><div><span className="tiny-logo"><MessageCircle size={15}/></span> drocsid <span>v{version}</span></div></div></aside></div>}<footer className="app-footer"><span><span className={`status-dot ${connected ? '' : 'offline'}`}/>{connected ? 'Conectado ao seu espaço' : 'Sem conexão'}</span><span>Feito para pequenos grupos <span className="footer-dot">·</span> Windows</span></footer></main>
      {inCall && streams.filter(s => s.stream).map(s => <Media key={s.id} stream={s.stream} callId={callRef.current?.callId} generation={callRef.current?.generation} muted={!inCall || deafened}/>)}
    </div>}
    {modal === 'create' && <Modal title="Um novo lugar para conversar" onClose={creatingRoom?undefined:()=>setModal(null)}><p className="modal-description">Crie uma sala para um assunto, um projeto ou só para reunir o grupo.</p><form onSubmit={createRoom}><label htmlFor="room-name">Nome da sala</label><input id="room-name" maxLength={32} required placeholder="Ex.: noite de jogos" value={roomName} onChange={e => setRoomName(e.target.value)}/><button className="primary modal-submit" disabled={!roomName.trim() || !connected || roomPending || !canAdmin || creatingRoom}>Criar sala <Plus size={17}/></button></form></Modal>}
    {modal === 'settings' && session && <Modal title="Do seu jeito" onClose={() => setModal(null)}><div className="settings-profile"><Avatar name={session.name} large/><div><h3>{session.name}</h3><p>{account?'Conta do grupo':'Convidado local de confiança'}</p></div></div><label htmlFor="quality">Qualidade do compartilhamento</label><select id="quality" value={quality} onChange={event => {const selected=event.target.value;if(selected==='720'||selected==='1080'){setQuality(selected);savePreferences(selected);}}}><option value="720">720p · mais leve</option><option value="1080">1080p · mais detalhes</option></select>{media.display && <p className="quality-note">A qualidade selecionada vale para a próxima captura.</p>}<label className="checkbox-label"><input type="checkbox" checked={systemAudio} onChange={e => setSystemAudio(e.target.checked)}/><span>Incluir áudio do sistema<small>No Windows, pode incluir o som de todos os aplicativos, inclusive da chamada.</small></span></label><div className="server-info"><span>Servidor conectado</span><code>{session.server}</code><small>{account?'Seu acesso depende da sua conta e da participação no grupo.':'Teste local para pessoas de confiança.'}</small></div><button className="secondary modal-submit" onClick={disconnect}><LogOut size={17}/> Sair</button></Modal>}
    {modal==='group-create'&&<Modal title="Um grupo para conversar" onClose={groupPending?undefined:()=>setModal(null)}><p className="modal-description">Seu grupo começa com uma sala geral. Você controla as salas e os convites.</p><form onSubmit={createGroup}><label htmlFor="group-name">Nome do grupo</label><input id="group-name" maxLength={32} required value={groupName} onChange={event=>setGroupName(event.target.value)} disabled={groupPending}/><button className="primary modal-submit" disabled={!groupName.trim()||groupPending||!connected}>{groupPending?'Criando…':'Criar grupo'}<Plus size={17}/></button></form></Modal>}
    {modal==='group-join'&&<Modal title="Entrar em um grupo" onClose={groupPending?undefined:()=>setModal(null)}><p className="modal-description">Peça um código ao dono do grupo. Cada convite pode ser usado uma vez e vence em 24 horas.</p><form onSubmit={acceptInvite}><label htmlFor="invite-code">Código do convite</label><input id="invite-code" autoComplete="off" maxLength={43} required value={inviteCode} onChange={event=>setInviteCode(event.target.value)} disabled={groupPending}/><button className="primary modal-submit" disabled={!inviteCode.trim()||groupPending||!connected}>{groupPending?'Entrando…':'Entrar no grupo'}<ArrowRight size={17}/></button></form></Modal>}
    {modal==='invite'&&invitation&&<Modal title="Convite do grupo" onClose={revokingInvite?undefined:()=>{setModal(null);setInvitation(null);}}><p className="modal-description">Envie este código a uma pessoa de confiança. Uso único, válido até {new Date(invitation.expiresAt).toLocaleString('pt-BR')}.</p><label htmlFor="generated-invite">Código do convite</label><input id="generated-invite" readOnly autoComplete="off" value={invitation.code} onFocus={event=>event.currentTarget.select()}/>{invitation.revoked?<p className="invite-status"><Check size={16}/> Convite revogado.</p>:<div className="invite-actions"><button className="primary" onClick={copyInvite}><Clipboard size={16}/> Copiar código</button><button className="secondary" onClick={revokeInvite} disabled={revokingInvite}>{revokingInvite?'Revogando…':'Revogar convite'}</button></div>}</Modal>}
    {capture && <Modal title="O que vamos compartilhar?" wide onClose={cancelPicker}><p className="modal-description">Escolha uma janela ou tela. Só o conteúdo selecionado será transmitido.{systemAudio && ' O áudio do sistema pode incluir todos os aplicativos, inclusive a própria chamada.'}</p><div className="capture-grid">{capture.sources.map(source => <button key={source.id} onClick={() => { window.desktop?.selectCapture(capture.key, capture.requestId, source.id); setCapture(null); }}><img src={source.thumbnail} alt=""/><span><Monitor size={15}/>{source.name}</span></button>)}</div></Modal>}
    {toast && <div className="toast" role="status"><MessageCircle size={18}/><span>{toast}</span><button className="icon-button" onClick={() => setToast('')} aria-label="Fechar aviso"><X size={16}/></button></div>}
  </>;
}
const root=document.getElementById('root');if(!root)throw new Error('App root unavailable');createRoot(root).render(<App/>);
