import { LIMITS, PROTOCOL_VERSION, ProtocolError, parseServerEvent, readIceServers } from '../shared/protocol.js';
import type { CallContext, ClientAction, ClientEvent, IceServer, Member, Message, Room, ServerEvent } from '../shared/protocol.js';

type Reply = Extract<ServerEvent,{type:'joined'|'room-created'|'message-accepted'|'ack'}>;
type Hello = Extract<ServerEvent,{type:'hello'}>;
export type SessionInfo = { id:string; name:string; server:string };
type Configuration = Record<string,unknown> & { protocolVersion:typeof PROTOCOL_VERSION; iceServers:IceServer[]; maxCallMembers:number };
export type OutboxItem = { server:string; accountId:string|null; room:string; text:string; operationId:string; status:'pending'|'failed'; error?:string|null; confirmed?:Message };
export type SessionState = { session:SessionInfo|null; connected:boolean; connecting:boolean; rooms:Room[]; room:Room|null; roomPending:boolean;
  members:Member[]; messages:Message[]; draft:string; outbox:OutboxItem[]; config:Configuration|null };
interface SocketPort {
  readyState:number; send(bytes:string):void; close():void;
  onopen:WebSocket['onopen']|(()=>void); onclose:WebSocket['onclose']|(()=>void); onerror:WebSocket['onerror']|(()=>void);
  onmessage:WebSocket['onmessage']|((event:{data:unknown})=>void);
}
interface Clock { setTimeout(fn:()=>void,ms:number):unknown; clearTimeout(token:unknown):void }
type Fetcher = (url:string, options:{signal:AbortSignal;method?:string;headers?:Record<string,string>;body?:string})=>Promise<{ok:boolean;json():Promise<unknown>}>;
type Options = { onState?:(state:SessionState)=>void; onError?:(error:ProtocolError)=>void; onSignal?:(event:Extract<ServerEvent,{type:'signal'}>)=>void;
  onPresence?:(members:Member[])=>void; onDisconnect?:()=>void; fetch?:Fetcher; WebSocket?:new(url:string)=>SocketPort; clock?:Clock; localOrigin?:string };
type RequestAction = Exclude<ClientAction,{type:'signal'}>;
type Pending = { event:RequestAction;resolve(value:Reply):void;reject(error:unknown):void;timer:unknown;epoch:number;context:string|null };

const object = (value:unknown): value is Record<string,unknown> => typeof value==='object'&&value!==null&&!Array.isArray(value);
const callContext = (event:ClientAction): Partial<CallContext> => 'callId' in event ? {callId:event.callId,generation:event.generation} : {};
function failure(error:unknown): ProtocolError {
  if(error instanceof ProtocolError)return error;
  const info=object(error)?error:{};
  const result=new ProtocolError(typeof info.code==='string'?info.code:'CONNECTION_FAILED',typeof info.message==='string'?info.message:'Falha na comunicação com o servidor.');
  if(error instanceof Error)result.name=error.name;
  if(typeof info.phase==='string')result.phase=info.phase;
  return result;
}

const realClock = { setTimeout: (fn:()=>void, ms:number) => setTimeout(fn, ms), clearTimeout: (id:ReturnType<typeof setTimeout>|undefined) => clearTimeout(id) };
const emptyState = (): SessionState => ({ session: null, connected: false, connecting: false, rooms: [], room: null, roomPending: false, members: [], messages: [], draft: '', outbox: [], config: null });
const responseTypes = { join: 'joined', message: 'message-accepted', 'create-room': 'room-created', 'call-join': 'ack', 'call-leave': 'ack', media: 'ack' };

export function parseInvite(input:unknown, fallback:string, defaultRoom = 'geral') {
  try {
    if(typeof input!=='string')throw new Error();
    const url = new URL(input.trim() || fallback);
    const room = url.searchParams.has('room') ? url.searchParams.get('room') : defaultRoom;
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !room || room.length > 128 || url.searchParams.getAll('room').length > 1) throw new Error();
    return { server: url.origin, room };
  } catch { throw new ProtocolError('INVALID_INPUT', 'Endereço ou sala inválidos.'); }
}

export class Session {
  onState:NonNullable<Options['onState']>;onError:NonNullable<Options['onError']>;onSignal:NonNullable<Options['onSignal']>;
  onPresence:NonNullable<Options['onPresence']>;onDisconnect:NonNullable<Options['onDisconnect']>;
  fetcher:Fetcher;Socket:new(url:string)=>SocketPort;clock:Clock;localOrigin:string;
  state:SessionState;epoch:number;callGeneration:number;presenceRevision:number;
  pending:Map<string,Pending>;phases:Set<(error:ProtocolError)=>void>;drafts:Map<string,string>;outbox:Map<string,OutboxItem>;
  ws:SocketPort|null=null;controller:AbortController|null=null;origin='';name='';
  accessToken:string|null=null;accountId:string|null=null;
  activeCallId:string|null=null;activeCallGeneration:number|null=null;screenRequest:ClientEvent|null=null;roomContext:string|null=null;
  constructor({ onState = () => {}, onError = () => {}, onSignal = () => {}, onPresence = () => {}, onDisconnect = () => {},
    fetch: fetcher = globalThis.fetch?.bind(globalThis), WebSocket: Socket = globalThis.WebSocket, clock = realClock,
    localOrigin = globalThis.location?.origin || 'http://127.0.0.1' }:Options = {}) {
    this.onState=onState;this.onError=onError;this.onSignal=onSignal;this.onPresence=onPresence;this.onDisconnect=onDisconnect;
    this.fetcher=fetcher;this.Socket=Socket;this.clock=clock;this.localOrigin=localOrigin;
    this.state = emptyState(); this.epoch = 0; this.callGeneration = 0; this.presenceRevision = 0;
    this.pending = new Map(); this.phases = new Set(); this.drafts = new Map(); this.outbox = new Map();
  }
  nextCallGeneration(epoch:number) {
    if (epoch !== this.epoch || !this.state.connected || !this.ws || this.ws.readyState !== 1) throw new ProtocolError('CANCELLED');
    return ++this.callGeneration;
  }
  cancelCall(callId:string, generation:number|null) {
    for (const [requestId, item] of this.pending) if ('callId' in item.event && item.event.callId === callId && item.event.generation === generation && item.event.type !== 'call-leave') {
      this.pending.delete(requestId); this.clock.clearTimeout(item.timer);
      item.reject(Object.assign(new ProtocolError('CANCELLED'), { requestId, callId, generation, phase: item.event.type }));
    }
  }
  key(room:string|undefined = this.state.room?.id) { return JSON.stringify([this.origin, this.accountId, room]); }
  publish(patch:Partial<SessionState> = {}) {
    this.state = { ...this.state, ...patch };
    this.state.outbox = [...this.outbox.values()].filter(e => e.server === this.origin && e.accountId === this.accountId && e.room === this.state.room?.id).map(e => ({ ...e }));
    this.onState(this.state);
  }
  setDraft(text:string) { if (this.state.room) this.drafts.set(this.key(), text); this.publish({ draft: text }); }
  wait<T>(promise:Promise<T>, phase:string): Promise<T> {
    const {promise:deadline,reject}=Promise.withResolvers<never>();
    const cancel=(error:ProtocolError)=>reject(error);this.phases.add(cancel);
    const timer=this.clock.setTimeout(()=>reject(Object.assign(new ProtocolError('TIMEOUT','O servidor não confirmou a operação. Tente novamente.'),{phase})),LIMITS.requestMs);
    return Promise.race([promise,deadline]).catch(error => { const cause=failure(error);cause.phase ||= phase;throw cause; }).finally(() => { this.clock.clearTimeout(timer); this.phases.delete(cancel); });
  }
  cancelTransport(error:ProtocolError) {
    this.controller?.abort(); this.controller = null;
    for (const cancel of this.phases) cancel(error); this.phases.clear();
    for (const item of this.pending.values()) { this.clock.clearTimeout(item.timer); item.reject(error); }
    this.pending.clear();
    const ws = this.ws; this.ws = null;
    if (ws) { ws.onopen = null; ws.onclose = null; ws.onerror = null; ws.onmessage = null; ws.close(); }
    this.activeCallId = null; this.activeCallGeneration = null; this.screenRequest = null; this.roomContext = null; this.presenceRevision = 0;
  }
  lose(error:ProtocolError, welcome = false) {
    ++this.epoch; this.cancelTransport(error); this.onDisconnect();
    for (const item of this.outbox.values()) if (item.status === 'pending') { item.status = 'failed'; item.error = error.code; }
    this.publish({ connected: false, connecting: false, roomPending: false, members: [], ...(welcome ? { session: null, room: null, messages: [], draft: '' } : {}) });
    if (error.code !== 'CANCELLED') this.onError(error);
  }
  disconnect() {
    if(this.accountId!==null){this.drafts.clear();this.outbox.clear();}
    this.accountId=null;this.accessToken=null;this.lose(new ProtocolError('CANCELLED'), true);
  }
  async logout() {
    const token=this.accessToken,origin=this.origin;this.disconnect();
    if(token)await this.wait((async()=>{
      const response=await this.fetcher(`${origin}/api/auth/logout`,{method:'POST',headers:{Authorization:`Bearer ${token}`},signal:new AbortController().signal});
      if(!response.ok)throw new ProtocolError('CONNECTION_FAILED','Sessão local encerrada. Não foi possível confirmar a saída no servidor.');
    })(),'logout');
  }
  async connect({ name, server, room, token }:{name?:string;server:string;room?:string;token?:string}) {
    let destination;
    try {
      if (token ? !/^[A-Za-z0-9_-]{43}$/.test(token) : typeof name !== 'string' || !name.trim() || name.trim().length > 32) throw new ProtocolError('INVALID_INPUT');
      destination = parseInvite(server, this.localOrigin, room??'geral');
    } catch (error) { const cause=failure(error);this.onError(cause);throw cause; }
    const epoch = ++this.epoch;
    this.callGeneration = 0;
    this.cancelTransport(new ProtocolError('CANCELLED')); this.onDisconnect();
    this.origin = destination.server; this.name = name?.trim()??'';this.accessToken=token??null;
    this.publish({ ...emptyState(), connecting: true });
    const controller=new AbortController();this.controller=controller;
    const headers:Record<string,string>=token?{Authorization:`Bearer ${token}`} : {};
    const read=async(path:string,method='GET')=>{
      const response=await this.fetcher(`${destination.server}${path}`,{signal:controller.signal,headers,method});
      const value=await response.json();
      if(!response.ok)throw new ProtocolError(object(value)&&typeof value.code==='string'?value.code:'CONNECTION_FAILED',object(value)&&typeof value.message==='string'?value.message:'Falha na comunicação com o servidor.');
      return value;
    };
    try {
      let accountId:string|null=null;
      if(token){
        const profile=await this.wait(read('/api/me'),'authentication');if(epoch!==this.epoch)return;
        if(!object(profile)||!object(profile.user)||typeof profile.user.id!=='string'||!profile.user.id||profile.user.id.length>128||typeof profile.user.username!=='string'||!/^[a-z0-9_.]{2,32}$/.test(profile.user.username))throw new ProtocolError('INVALID_EVENT');
        accountId=profile.user.id;this.name=profile.user.username;
      }
      if(this.accountId!==accountId){this.drafts.clear();this.outbox.clear();}
      this.accountId=accountId;
      const value = await this.wait((async () => {
        return read('/api/config');
      })(), 'configuration');
      if (epoch !== this.epoch) return;
      if (!object(value)||value.protocolVersion !== PROTOCOL_VERSION) throw new ProtocolError('INCOMPATIBLE_PROTOCOL');
      if (!Array.isArray(value.iceServers)) throw new ProtocolError('INVALID_EVENT');
      if (value.maxCallMembers !== LIMITS.callMembers) throw new ProtocolError('INVALID_EVENT');
      const config:Configuration={...value,protocolVersion:PROTOCOL_VERSION,iceServers:readIceServers(value.iceServers),maxCallMembers:value.maxCallMembers};
      const address = new URL('/ws', this.origin); address.protocol = address.protocol === 'https:' ? 'wss:' : 'ws:';
      if(token){
        const ticket=await this.wait(read('/api/ws-ticket','POST'),'ticket');if(epoch!==this.epoch)return;
        if(!object(ticket)||typeof ticket.ticket!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(ticket.ticket))throw new ProtocolError('INVALID_EVENT');
        address.searchParams.set('ticket',ticket.ticket);
      }
      const ws = new this.Socket(address.href); this.ws = ws;
      let greeted=false;
      const opened=Promise.withResolvers<void>(),hello=Promise.withResolvers<Hello>();hello.promise.catch(()=>{});
      let helloWaiting=hello.promise;
      const current = () => epoch === this.epoch && this.ws === ws;
      ws.onopen = () => { if (current()) { helloWaiting = this.wait(hello.promise, 'hello'); helloWaiting.catch(() => {}); opened.resolve(); } };
      const failed = () => {
        if (!current()) return;
        const error = new ProtocolError('CONNECTION_FAILED', 'Conexão encerrada. Reconecte para continuar.');
        if (greeted) this.lose(error); else { opened.reject(error); hello.reject(error); }
      };
      ws.onerror = failed; ws.onclose = failed;
      ws.onmessage = ({ data }:{data:unknown}) => {
        if (!current()) return;
        try {
          if(typeof data!=='string')throw new ProtocolError('INVALID_EVENT');
          const event = parseServerEvent(data);
          if (!greeted) {
            if (event.type === 'error') throw new ProtocolError(event.code, event.message);
            if (event.type !== 'hello') throw new ProtocolError('INVALID_EVENT');
            greeted = true; hello.resolve(event);
          } else this.receive(event);
        } catch (error) { const cause=failure(error);if (greeted) this.lose(cause); else { opened.reject(cause); hello.reject(cause); } }
      };
      await this.wait(opened.promise, 'websocket');
      const greeting = await helloWaiting;
      if (epoch !== this.epoch) return;
      const explicitRoom=room!==undefined||new URL(server.trim()||this.localOrigin).searchParams.has('room');
      const requested=token&&!explicitRoom?greeting.rooms[0]?.id:destination.room;
      if (requested&&!greeting.rooms.some(r => r.id === requested)) throw new ProtocolError('INVALID_INPUT', 'A sala do endereço não existe.');
      this.publish({ connected: true, connecting: false, rooms: greeting.rooms, config,
        session: { id: greeting.id, name: this.name, server: this.origin } });
      if(requested)await this.changeRoom(requested);
      if (epoch === this.epoch) return this.state.session;
    } catch (error) {
      if (epoch !== this.epoch) return;
      const cause=failure(error);this.lose(cause);throw cause;
    }
  }
  request(event:Extract<ClientAction,{type:'join'}>):Promise<Extract<Reply,{type:'joined'}>>;
  request(event:Extract<ClientAction,{type:'message'}>):Promise<Extract<Reply,{type:'message-accepted'}>>;
  request(event:Extract<ClientAction,{type:'create-room'}>):Promise<Extract<Reply,{type:'room-created'}>>;
  request(event:ClientAction):Promise<Reply|void>;
  request(event:ClientAction):Promise<Reply|void> {
    const ws=this.ws;
    if (!ws || ws.readyState !== 1) return Promise.reject(new ProtocolError('CONNECTION_FAILED'));
    const contextFields=callContext(event);
    if (contextFields.generation!==undefined&&Number.isSafeInteger(contextFields.generation)) this.callGeneration = Math.max(this.callGeneration, contextFields.generation);
    if (event.type === 'call-join') {
      if (this.activeCallId && (this.activeCallId !== event.callId || this.activeCallGeneration !== event.generation)) this.cancelCall(this.activeCallId, this.activeCallGeneration);
      this.activeCallId = event.callId; this.activeCallGeneration = event.generation;
    }
    if (event.type === 'call-leave') {
      this.cancelCall(event.callId, event.generation);
      if (event.callId === this.activeCallId && event.generation === this.activeCallGeneration) { this.activeCallId = null; this.activeCallGeneration = null; }
    }
    const requestId = crypto.randomUUID(), epoch = this.epoch, context = this.roomContext;
    const envelope:ClientEvent = { ...event, v: PROTOCOL_VERSION, requestId };
    if (event.type === 'media' && typeof event.sharing === 'boolean') this.screenRequest = envelope;
    if (event.type === 'signal') {
      try { ws.send(JSON.stringify(envelope)); return Promise.resolve(); }
      catch { return Promise.reject(new ProtocolError('CONNECTION_FAILED')); }
    }
    return new Promise<Reply>((resolve, reject) => {
      const timer = this.clock.setTimeout(() => {
        this.pending.delete(requestId); const error = Object.assign(new ProtocolError('TIMEOUT', 'O servidor não confirmou a operação.'), { phase: event.type, requestId, ...contextFields });
        reject(error);
        if ((event.type === 'call-leave' || (event.type === 'media' && event.sharing === false && this.screenRequest === envelope)) && epoch === this.epoch && context === this.roomContext && event.generation === this.callGeneration) this.lose(error);
      }, LIMITS.requestMs);
      this.pending.set(requestId, { event, resolve, reject, timer, epoch, context });
      try { ws.send(JSON.stringify(envelope)); }
      catch { this.pending.delete(requestId); this.clock.clearTimeout(timer); reject(new ProtocolError('CONNECTION_FAILED')); }
    });
  }
  receive(event:ServerEvent) {
    const requestId=typeof event.requestId==='string'?event.requestId:undefined;
    const item = requestId?this.pending.get(requestId):undefined;
    if (item && requestId) {
      const { event: sent } = item;
      if (item.epoch !== this.epoch) return;
      if (event.type !== 'error' && event.type !== responseTypes[sent.type]) return;
      if (event.type === 'joined' && (sent.type!=='join'||event.room.id !== sent.room)) throw new ProtocolError('INVALID_EVENT');
      if (event.type === 'message-accepted' && (sent.type!=='message'||event.message.operationId !== sent.operationId || event.message.room !== sent.room)) throw new ProtocolError('INVALID_EVENT');
      if (event.type === 'ack' && (event.action !== sent.type || !('callId' in sent) || event.callId !== sent.callId || event.generation !== sent.generation)) throw new ProtocolError('INVALID_EVENT');
      if (event.type === 'joined') {
        this.roomContext = event.requestId;
        this.presenceRevision = 0;
        event.messages.forEach(message => this.confirmMessage(message));
        this.publish({ room: event.room, roomPending: false, messages: event.messages, members: [], draft: this.drafts.get(this.key(event.room.id)) || '' });
      }
      this.pending.delete(requestId); this.clock.clearTimeout(item.timer);
      if (event.type === 'error') item.reject(Object.assign(new ProtocolError(event.code, event.message), { phase: event.phase, requestId: event.requestId, ...callContext(sent) }));
      else if (sent.type === 'call-join' && (this.activeCallId !== sent.callId || this.activeCallGeneration !== sent.generation || item.context !== this.roomContext)) item.reject(new ProtocolError('CANCELLED'));
      else if(event.type==='joined'||event.type==='room-created'||event.type==='message-accepted'||event.type==='ack')item.resolve(event);
      else throw new ProtocolError('INVALID_EVENT');
      return;
    }
    if (event.type === 'rooms') { this.publish({ rooms: event.rooms }); return; }
    if (event.type === 'error') { if (!event.requestId) this.onError(Object.assign(new ProtocolError(event.code, event.message), { phase: event.phase })); return; }
    if (event.context !== this.roomContext) return;
    if (event.type === 'message' && event.message.room === this.state.room?.id) this.addMessage(event.message);
    else if (event.type === 'presence' && event.room === this.state.room?.id) {
      if (event.revision <= this.presenceRevision) return;
      this.presenceRevision = event.revision;
      const members = event.members.map(member => member.id === this.state.session?.id && (member.callId !== this.activeCallId || member.generation !== this.activeCallGeneration) ? { ...member, inCall: false, sharing: false } : member);
      this.publish({ members }); this.onPresence(members);
    } else if (event.type === 'signal' && event.callId === this.activeCallId) this.onSignal(event);
  }
  async changeRoom(id:string) {
    if (this.state.roomPending) throw new ProtocolError('INVALID_EVENT', 'Aguarde a troca de sala.');
    const epoch = this.epoch;
    this.publish({ roomPending: true });
    try {
      const joined = await this.request({ type: 'join', name: this.name, room: id });
      if (epoch !== this.epoch) return;
      return joined.room;
    } finally { if (epoch === this.epoch && this.state.roomPending) this.publish({ roomPending: false }); }
  }
  confirmMessage(message:Message) {
    if(message.operationId===null)return;
    const item = this.outbox.get(message.operationId);
    if (item && item.server === this.origin && item.accountId === this.accountId && item.room === message.room) { item.confirmed = message; this.outbox.delete(item.operationId); }
  }
  addMessage(message:Message) {
    this.confirmMessage(message);
    const messages = [...this.state.messages.filter(m => m.id !== message.id), message].sort((a, b) => a.sequence - b.sequence).slice(-200);
    this.publish({ messages });
  }
  async sendText(text = this.state.draft) {
    if (!this.state.connected || this.state.roomPending || !this.state.room) throw new ProtocolError('INVALID_EVENT');
    if (!text.trim() || text.trim().length > LIMITS.text) throw new ProtocolError('INVALID_INPUT');
    const item:OutboxItem = { server: this.origin, accountId:this.accountId, room: this.state.room.id, text, operationId: crypto.randomUUID(), status: 'pending' };
    this.outbox.set(item.operationId, item); this.setDraft('');
    return this.submit(item);
  }
  async retry(operationId:string) {
    const item = this.outbox.get(operationId);
    if (!item || item.server !== this.origin || item.accountId !== this.accountId || item.room !== this.state.room?.id || this.state.roomPending) throw new ProtocolError('ROOM_MISMATCH');
    if (item.status === 'pending') return;
    return this.submit(item);
  }
  async submit(item:OutboxItem) {
    item.status = 'pending'; item.error = null; this.publish();
    try {
      const accepted = await this.request({ type: 'message', room: item.room, operationId: item.operationId, text: item.text });
      item.confirmed = accepted.message; this.outbox.delete(item.operationId);
      if (this.state.room?.id === item.room && this.origin === item.server && this.accountId === item.accountId) this.addMessage(accepted.message);
      else this.publish();
      return accepted.message;
    } catch (error) {
      if (item.confirmed) return item.confirmed;
      const cause=failure(error);item.status = 'failed'; item.error = cause.code; this.publish(); throw cause;
    }
  }
}
