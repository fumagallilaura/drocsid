export const PROTOCOL_VERSION = 2;
export const LIMITS = Object.freeze({
  requestMs: 8000, negotiationMs: 15000, candidateMs: 15000, candidates: 128,
  callMembers: 6, connections: 24, rooms: 100, text: 2000,
  payloadBytes: 65536, outboundBytes: 1024 * 1024, shutdownMs: 5000,
});

export type Room = { id: string; name: string; description: string };
export type Message = { id: string; room: string; author: string; text: string; created: number; sequence: number; authorId: string | null; operationId: string | null };
export type Member = { id: string; name: string; inCall: boolean; muted: boolean; sharing: boolean; callId: string | null; generation: number };
export type Signal = { description: { type: 'offer' | 'answer'; sdp: string }; candidate?: never } |
  { candidate: { candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null; usernameFragment?: string | null }; description?: never };
export type IceServer = { urls: string | string[]; username?: string; credential?: string };
type Envelope = Record<string, unknown> & { v: typeof PROTOCOL_VERSION; type: string };
type Request = { requestId: string };
export type CallContext = { callId: string; generation: number };
export type ClientEvent = Envelope & Request & (
  { type: 'join'; room: string; name: string } |
  { type: 'message'; room: string; operationId: string; text: string } |
  { type: 'create-room'; name: string } |
  ({ type: 'call-join'; muted: boolean } & CallContext) |
  ({ type: 'call-leave' } & CallContext) |
  ({ type: 'media'; muted?: boolean; sharing?: boolean } & CallContext) |
  ({ type: 'signal'; to: string; toCallId: string; signal: Signal } & CallContext)
);
export type ServerEvent = Envelope & (
  { type: 'hello'; id: string; rooms: Room[] } |
  ({ type: 'joined'; room: Room; messages: Message[] } & Request) |
  { type: 'rooms'; rooms: Room[] } |
  ({ type: 'room-created'; room: Room } & Request) |
  { type: 'presence'; room: string; context: string; revision: number; members: Member[] } |
  { type: 'message'; context: string; message: Message } |
  ({ type: 'message-accepted'; message: Message } & Request) |
  ({ type: 'ack'; action: 'call-join' | 'call-leave' | 'media'; inCall: boolean; muted: boolean; sharing: boolean } & Request & CallContext) |
  { type: 'signal'; context: string; from: string; fromCallId: string; callId: string; signal: Signal } |
  { type: 'error'; code: string; message: string; phase: string; requestId?: string | null }
);

export class ProtocolError extends Error {
  code: string;
  phase?: string;
  requestId?: string | null;
  callId?: string;
  generation?: number;
  operationId?: string;
  constructor(code: string, message = code) { super(message); this.code = code; }
}
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const string = (value: unknown, max = 128): value is string => typeof value === 'string' && value.length > 0 && value.length <= max;
const name = (value: unknown): value is string => typeof value === 'string' && string(value.trim(), 32);
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const optionalString = (value: unknown) => value == null || (typeof value === 'string' && value.length <= 256);
function fail(code = 'INVALID_EVENT'): never { throw new ProtocolError(code); }

function envelope(raw: string): Envelope {
  let event: unknown;
  try { event = JSON.parse(raw); } catch { fail(); }
  if (!object(event)) fail();
  if (event.v !== PROTOCOL_VERSION) fail('INCOMPATIBLE_PROTOCOL');
  if (!string(event.type, 32)) fail();
  return { ...event, v: PROTOCOL_VERSION, type: event.type };
}

export function validSignal(signal: unknown): signal is Signal {
  if (!object(signal) || !!signal.description === !!signal.candidate) return false;
  if (signal.description) {
    const d = signal.description;
    return object(d) && (d.type === 'offer' || d.type === 'answer') && typeof d.sdp === 'string' && d.sdp.length <= 60000;
  }
  const c = signal.candidate;
  return object(c) && typeof c.candidate === 'string' && c.candidate.length <= 8192 &&
    optionalString(c.sdpMid) && optionalString(c.usernameFragment) &&
    (c.sdpMLineIndex == null || (integer(c.sdpMLineIndex) && c.sdpMLineIndex <= 65535));
}

function assertClientEvent(e: Envelope): asserts e is ClientEvent {
  if (!string(e.requestId)) fail();
  if (['call-join','call-leave','media','signal'].includes(e.type) && (!string(e.callId) || !integer(e.generation) || e.generation < 1)) fail();
  switch (e.type) {
    case 'join':
      if (!string(e.room) || !name(e.name)) fail('INVALID_INPUT');
      break;
    case 'message':
      if (!string(e.room) || !string(e.operationId) || typeof e.text !== 'string') fail();
      if (!e.text.trim() || e.text.trim().length > LIMITS.text) fail('INVALID_INPUT');
      break;
    case 'create-room':
      if (!name(e.name)) fail('INVALID_INPUT');
      break;
    case 'call-join':
      if (!string(e.callId) || !integer(e.generation) || e.generation < 1 || typeof e.muted !== 'boolean') fail();
      break;
    case 'call-leave':
      if (!string(e.callId)) fail();
      break;
    case 'media':
      if (!string(e.callId) || (e.muted === undefined && e.sharing === undefined) ||
          (e.muted !== undefined && typeof e.muted !== 'boolean') || (e.sharing !== undefined && typeof e.sharing !== 'boolean')) fail();
      break;
    case 'signal':
      if (!string(e.callId) || !string(e.to) || !string(e.toCallId) || !validSignal(e.signal)) fail();
      break;
    default: fail();
  }
}

export function parseClientEvent(raw: string): ClientEvent {
  const event = envelope(raw);
  assertClientEvent(event);
  return event;
}

const room = (r: unknown): r is Room => object(r) && string(r.id) && name(r.name) && typeof r.description === 'string' && r.description.length <= 2000;
const rooms = (list: unknown): list is Room[] => Array.isArray(list) && list.length <= LIMITS.rooms && list.every(room);
const message = (m: unknown): m is Message => object(m) && string(m.id) && string(m.room) && name(m.author) &&
  string(m.text, LIMITS.text) && integer(m.created) && integer(m.sequence) && m.sequence > 0 &&
  (m.authorId === null || string(m.authorId)) && (m.operationId === null || string(m.operationId));
const member = (m: unknown): m is Member => object(m) && string(m.id) && name(m.name) &&
  typeof m.inCall === 'boolean' && typeof m.muted === 'boolean' && typeof m.sharing === 'boolean' &&
  (m.inCall ? string(m.callId) : m.callId === null) && (!m.sharing || m.inCall) && integer(m.generation);

function assertServerEvent(e: Envelope): asserts e is ServerEvent {
  let valid = false;
  switch (e.type) {
    case 'hello': valid = string(e.id) && rooms(e.rooms); break;
    case 'joined': valid = string(e.requestId) && room(e.room) && Array.isArray(e.messages) && e.messages.length <= 200 && e.messages.every(message); break;
    case 'rooms': valid = rooms(e.rooms); break;
    case 'room-created': valid = string(e.requestId) && room(e.room); break;
    case 'presence': valid = string(e.room) && integer(e.revision) && e.revision > 0 && Array.isArray(e.members) && e.members.length <= LIMITS.connections && e.members.every(member); break;
    case 'message': valid = message(e.message); break;
    case 'message-accepted': valid = string(e.requestId) && message(e.message); break;
    case 'ack': valid = string(e.requestId) && (e.action === 'call-join' || e.action === 'call-leave' || e.action === 'media') &&
      string(e.callId) && integer(e.generation) && e.generation > 0 && typeof e.inCall === 'boolean' && typeof e.muted === 'boolean' && typeof e.sharing === 'boolean'; break;
    case 'signal': valid = string(e.from) && string(e.fromCallId) && string(e.callId) && validSignal(e.signal); break;
    case 'error': valid = string(e.code, 64) && string(e.message, 512) && string(e.phase, 64) && (e.requestId == null || string(e.requestId)); break;
  }
  if (!valid || (['presence','message','signal'].includes(e.type) && !string(e.context))) fail();
}

export function parseServerEvent(raw: string): ServerEvent {
  const event = envelope(raw);
  assertServerEvent(event);
  return event;
}

export function readIceServers(value: unknown = [{ urls: 'stun:stun.l.google.com:19302' }]): IceServer[] {
  if (!Array.isArray(value)) fail('INVALID_INPUT');
  return value.map(entry => {
    if (!object(entry)) fail('INVALID_INPUT');
    const urls: unknown[] = Array.isArray(entry.urls) ? entry.urls : [entry.urls];
    const validUrl = (url: unknown): url is string => typeof url === 'string' && /^(stun|stuns|turn|turns):\S+$/.test(url);
    if (!urls.length || !urls.every(validUrl) ||
        (entry.username !== undefined && typeof entry.username !== 'string') ||
        (entry.credential !== undefined && typeof entry.credential !== 'string')) fail('INVALID_INPUT');
    return { urls: Array.isArray(entry.urls) ? [...urls] : urls[0],
      ...(entry.username !== undefined ? { username: entry.username } : {}),
      ...(entry.credential !== undefined ? { credential: entry.credential } : {}) };
  });
}

export function parsePort(value: unknown = '4310') {
  if (!/^\d+$/.test(String(value))) fail('INVALID_INPUT');
  const port = Number(value);
  if (!integer(port) || port > 65535) fail('INVALID_INPUT');
  return port;
}
