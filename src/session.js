import { LIMITS, PROTOCOL_VERSION, ProtocolError, parseServerEvent, readIceServers } from '../shared/protocol.js';

const realClock = { setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: id => clearTimeout(id) };
const emptyState = () => ({ session: null, connected: false, connecting: false, rooms: [], room: null, roomPending: false, members: [], messages: [], draft: '', outbox: [], config: null });
const responseTypes = { join: 'joined', message: 'message-accepted', 'create-room': 'room-created', 'call-join': 'ack', 'call-leave': 'ack', media: 'ack' };

export function parseInvite(input, fallback, defaultRoom = 'geral') {
  try {
    const url = new URL(input.trim() || fallback);
    const room = url.searchParams.has('room') ? url.searchParams.get('room') : defaultRoom;
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !room || room.length > 128 || url.searchParams.getAll('room').length > 1) throw new Error();
    return { server: url.origin, room };
  } catch { throw new ProtocolError('INVALID_INPUT', 'Endereço ou sala inválidos.'); }
}

export class Session {
  constructor({ onState = () => {}, onError = () => {}, onSignal = () => {}, onPresence = () => {}, onDisconnect = () => {},
    fetch: fetcher = globalThis.fetch?.bind(globalThis), WebSocket: Socket = globalThis.WebSocket, clock = realClock,
    localOrigin = globalThis.location?.origin || 'http://127.0.0.1' } = {}) {
    Object.assign(this, { onState, onError, onSignal, onPresence, onDisconnect, fetcher, Socket, clock, localOrigin });
    this.state = emptyState(); this.epoch = 0; this.callGeneration = 0; this.presenceRevision = 0;
    this.pending = new Map(); this.phases = new Set(); this.drafts = new Map(); this.outbox = new Map();
  }
  nextCallGeneration(epoch) {
    if (epoch !== this.epoch || !this.state.connected || !this.ws || this.ws.readyState !== 1) throw new ProtocolError('CANCELLED');
    return ++this.callGeneration;
  }
  cancelCall(callId, generation) {
    for (const [requestId, item] of this.pending) if (item.event.callId === callId && item.event.generation === generation && item.event.type !== 'call-leave') {
      this.pending.delete(requestId); this.clock.clearTimeout(item.timer);
      item.reject(Object.assign(new ProtocolError('CANCELLED'), { requestId, callId, generation, phase: item.event.type }));
    }
  }
  key(room = this.state.room?.id) { return JSON.stringify([this.origin, room]); }
  publish(patch = {}) {
    this.state = { ...this.state, ...patch };
    this.state.outbox = [...this.outbox.values()].filter(e => e.server === this.origin && e.room === this.state.room?.id).map(e => ({ ...e }));
    this.onState(this.state);
  }
  setDraft(text) { if (this.state.room) this.drafts.set(this.key(), text); this.publish({ draft: text }); }
  wait(promise, phase) {
    let timer, cancel;
    return Promise.race([promise, new Promise((_, reject) => {
      cancel = error => reject(error);
      this.phases.add(cancel);
      timer = this.clock.setTimeout(() => reject(Object.assign(new ProtocolError('TIMEOUT', 'O servidor não confirmou a operação. Tente novamente.'), { phase })), LIMITS.requestMs);
    })]).catch(error => { error.phase ||= phase; throw error; }).finally(() => { this.clock.clearTimeout(timer); this.phases.delete(cancel); });
  }
  cancelTransport(error) {
    this.controller?.abort(); this.controller = null;
    for (const cancel of this.phases) cancel(error); this.phases.clear();
    for (const item of this.pending.values()) { this.clock.clearTimeout(item.timer); item.reject(error); }
    this.pending.clear();
    const ws = this.ws; this.ws = null;
    if (ws) { ws.onopen = null; ws.onclose = null; ws.onerror = null; ws.onmessage = null; ws.close(); }
    this.activeCallId = null; this.activeCallGeneration = null; this.roomContext = null; this.presenceRevision = 0;
  }
  lose(error, welcome = false) {
    ++this.epoch; this.cancelTransport(error); this.onDisconnect();
    for (const item of this.outbox.values()) if (item.status === 'pending') { item.status = 'failed'; item.error = error.code; }
    this.publish({ connected: false, connecting: false, roomPending: false, members: [], ...(welcome ? { session: null, room: null, messages: [], draft: '' } : {}) });
    if (error.code !== 'CANCELLED') this.onError(error);
  }
  disconnect() { this.lose(new ProtocolError('CANCELLED'), true); }
  async connect({ name, server, room = 'geral' }) {
    let destination;
    try {
      if (typeof name !== 'string' || !name.trim() || name.trim().length > 32) throw new ProtocolError('INVALID_INPUT');
      destination = parseInvite(server, this.localOrigin, room);
    } catch (error) { this.onError(error); throw error; }
    const epoch = ++this.epoch;
    this.callGeneration = 0;
    this.cancelTransport(new ProtocolError('CANCELLED')); this.onDisconnect();
    this.origin = destination.server; this.name = name.trim();
    this.publish({ ...emptyState(), connecting: true });
    this.controller = new AbortController();
    try {
      const config = await this.wait((async () => {
        const response = await this.fetcher(`${this.origin}/api/config`, { signal: this.controller.signal });
        if (!response.ok) throw new ProtocolError('CONNECTION_FAILED');
        return response.json();
      })(), 'configuration');
      if (epoch !== this.epoch) return;
      if (config?.protocolVersion !== PROTOCOL_VERSION) throw new ProtocolError('INCOMPATIBLE_PROTOCOL');
      if (!Array.isArray(config.iceServers)) throw new ProtocolError('INVALID_EVENT');
      config.iceServers = readIceServers(config.iceServers);
      if (config.maxCallMembers !== LIMITS.callMembers) throw new ProtocolError('INVALID_EVENT');
      const address = new URL('/ws', this.origin); address.protocol = address.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new this.Socket(address.href); this.ws = ws;
      let resolveOpen, rejectOpen, resolveHello, rejectHello, helloWaiting, greeted = false;
      const opened = new Promise((a, b) => { resolveOpen = a; rejectOpen = b; });
      const hello = new Promise((a, b) => { resolveHello = a; rejectHello = b; }); hello.catch(() => {});
      const current = () => epoch === this.epoch && this.ws === ws;
      ws.onopen = () => { if (current()) { helloWaiting = this.wait(hello, 'hello'); helloWaiting.catch(() => {}); resolveOpen(); } };
      const failed = () => {
        if (!current()) return;
        const error = new ProtocolError('CONNECTION_FAILED', 'Conexão encerrada. Reconecte para continuar.');
        if (greeted) this.lose(error); else { rejectOpen(error); rejectHello(error); }
      };
      ws.onerror = failed; ws.onclose = failed;
      ws.onmessage = ({ data }) => {
        if (!current()) return;
        try {
          const event = parseServerEvent(data);
          if (!greeted) {
            if (event.type === 'error') throw new ProtocolError(event.code, event.message);
            if (event.type !== 'hello') throw new ProtocolError('INVALID_EVENT');
            greeted = true; resolveHello(event);
          } else this.receive(event);
        } catch (error) { if (greeted) this.lose(error); else { rejectOpen(error); rejectHello(error); } }
      };
      await this.wait(opened, 'websocket');
      const greeting = await helloWaiting;
      if (epoch !== this.epoch) return;
      if (!greeting.rooms.some(r => r.id === destination.room)) throw new ProtocolError('INVALID_INPUT', 'A sala do endereço não existe.');
      this.publish({ connected: true, connecting: false, rooms: greeting.rooms, config,
        session: { id: greeting.id, name: this.name, server: this.origin } });
      await this.changeRoom(destination.room);
      if (epoch === this.epoch) return this.state.session;
    } catch (error) {
      if (epoch !== this.epoch) return;
      this.lose(error); throw error;
    }
  }
  request(event) {
    if (!this.ws || this.ws.readyState !== 1) return Promise.reject(new ProtocolError('CONNECTION_FAILED'));
    if (Number.isSafeInteger(event.generation)) this.callGeneration = Math.max(this.callGeneration, event.generation);
    if (event.type === 'call-join') {
      if (this.activeCallId && (this.activeCallId !== event.callId || this.activeCallGeneration !== event.generation)) this.cancelCall(this.activeCallId, this.activeCallGeneration);
      this.activeCallId = event.callId; this.activeCallGeneration = event.generation;
    }
    if (event.type === 'call-leave') {
      this.cancelCall(event.callId, event.generation);
      if (event.callId === this.activeCallId && event.generation === this.activeCallGeneration) { this.activeCallId = null; this.activeCallGeneration = null; }
    }
    const requestId = crypto.randomUUID(), epoch = this.epoch, context = this.roomContext, envelope = { ...event, v: PROTOCOL_VERSION, requestId };
    if (event.type === 'signal') {
      try { this.ws.send(JSON.stringify(envelope)); return Promise.resolve(); }
      catch { return Promise.reject(new ProtocolError('CONNECTION_FAILED')); }
    }
    return new Promise((resolve, reject) => {
      const timer = this.clock.setTimeout(() => {
        this.pending.delete(requestId); const error = Object.assign(new ProtocolError('TIMEOUT', 'O servidor não confirmou a operação.'), { phase: event.type, requestId, callId: event.callId, generation: event.generation });
        reject(error);
        if ((event.type === 'call-leave' || (event.type === 'media' && event.sharing === false)) && epoch === this.epoch && context === this.roomContext && event.generation === this.callGeneration) this.lose(error);
      }, LIMITS.requestMs);
      this.pending.set(requestId, { event, resolve, reject, timer, epoch, context });
      try { this.ws.send(JSON.stringify(envelope)); }
      catch { this.pending.delete(requestId); this.clock.clearTimeout(timer); reject(new ProtocolError('CONNECTION_FAILED')); }
    });
  }
  receive(event) {
    const item = this.pending.get(event.requestId);
    if (item) {
      const { event: sent } = item;
      if (item.epoch !== this.epoch) return;
      if (event.type !== 'error' && event.type !== responseTypes[sent.type]) return;
      if (event.type === 'joined' && event.room.id !== sent.room) throw new ProtocolError('INVALID_EVENT');
      if (event.type === 'message-accepted' && (event.message.operationId !== sent.operationId || event.message.room !== sent.room)) throw new ProtocolError('INVALID_EVENT');
      if (event.type === 'ack' && (event.action !== sent.type || event.callId !== sent.callId || event.generation !== sent.generation)) throw new ProtocolError('INVALID_EVENT');
      if (event.type === 'joined') {
        this.roomContext = event.requestId;
        this.presenceRevision = 0;
        event.messages.forEach(message => this.confirmMessage(message));
        this.publish({ room: event.room, roomPending: false, messages: event.messages, members: [], draft: this.drafts.get(this.key(event.room.id)) || '' });
      }
      this.pending.delete(event.requestId); this.clock.clearTimeout(item.timer);
      if (event.type === 'error') item.reject(Object.assign(new ProtocolError(event.code, event.message), { phase: event.phase, requestId: event.requestId, callId: sent.callId, generation: sent.generation }));
      else if (sent.type === 'call-join' && (this.activeCallId !== sent.callId || this.activeCallGeneration !== sent.generation || item.context !== this.roomContext)) item.reject(new ProtocolError('CANCELLED'));
      else item.resolve(event);
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
  async changeRoom(id) {
    if (this.state.roomPending) throw new ProtocolError('INVALID_EVENT', 'Aguarde a troca de sala.');
    const epoch = this.epoch;
    this.publish({ roomPending: true });
    try {
      const joined = await this.request({ type: 'join', name: this.name, room: id });
      if (epoch !== this.epoch) return;
      return joined.room;
    } finally { if (epoch === this.epoch && this.state.roomPending) this.publish({ roomPending: false }); }
  }
  confirmMessage(message) {
    const item = this.outbox.get(message.operationId);
    if (item && item.server === this.origin && item.room === message.room) { item.confirmed = message; this.outbox.delete(item.operationId); }
  }
  addMessage(message) {
    this.confirmMessage(message);
    const messages = [...this.state.messages.filter(m => m.id !== message.id), message].sort((a, b) => a.sequence - b.sequence).slice(-200);
    this.publish({ messages });
  }
  async sendText(text = this.state.draft) {
    if (!this.state.connected || this.state.roomPending || !this.state.room) throw new ProtocolError('INVALID_EVENT');
    if (!text.trim() || text.trim().length > LIMITS.text) throw new ProtocolError('INVALID_INPUT');
    const item = { server: this.origin, room: this.state.room.id, text, operationId: crypto.randomUUID(), status: 'pending' };
    this.outbox.set(item.operationId, item); this.setDraft('');
    return this.submit(item);
  }
  async retry(operationId) {
    const item = this.outbox.get(operationId);
    if (!item || item.server !== this.origin || item.room !== this.state.room?.id || this.state.roomPending) throw new ProtocolError('ROOM_MISMATCH');
    if (item.status === 'pending') return;
    return this.submit(item);
  }
  async submit(item) {
    item.status = 'pending'; item.error = null; this.publish();
    try {
      const accepted = await this.request({ type: 'message', room: item.room, operationId: item.operationId, text: item.text });
      item.confirmed = accepted.message; this.outbox.delete(item.operationId);
      if (this.state.room?.id === item.room && this.origin === item.server) this.addMessage(accepted.message);
      else this.publish();
      return accepted.message;
    } catch (error) {
      if (item.confirmed) return item.confirmed;
      item.status = 'failed'; item.error = error.code; this.publish(); throw error;
    }
  }
}
