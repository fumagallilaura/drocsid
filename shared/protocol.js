export const PROTOCOL_VERSION = 1;
export const LIMITS = Object.freeze({
  requestMs: 8000, negotiationMs: 15000, candidateMs: 15000, candidates: 128,
  callMembers: 6, connections: 24, rooms: 100, text: 2000,
  payloadBytes: 65536, outboundBytes: 1024 * 1024, shutdownMs: 5000,
});

export class ProtocolError extends Error {
  constructor(code, message = code) { super(message); this.code = code; }
}
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const string = (value, max = 128) => typeof value === 'string' && value.length > 0 && value.length <= max;
const integer = value => Number.isSafeInteger(value) && value >= 0;
const optionalString = value => value == null || (typeof value === 'string' && value.length <= 256);
const fail = (code = 'INVALID_EVENT') => { throw new ProtocolError(code); };

function envelope(raw) {
  let event;
  try { event = JSON.parse(raw); } catch { fail(); }
  if (!object(event)) fail();
  if (event.v !== PROTOCOL_VERSION) fail('INCOMPATIBLE_PROTOCOL');
  if (!string(event.type, 32)) fail();
  return event;
}

export function validSignal(signal) {
  if (!object(signal) || !!signal.description === !!signal.candidate) return false;
  if (signal.description) {
    const d = signal.description;
    return object(d) && ['offer', 'answer'].includes(d.type) && typeof d.sdp === 'string' && d.sdp.length <= 60000;
  }
  const c = signal.candidate;
  return object(c) && typeof c.candidate === 'string' && c.candidate.length <= 8192 &&
    optionalString(c.sdpMid) && optionalString(c.usernameFragment) &&
    (c.sdpMLineIndex == null || (integer(c.sdpMLineIndex) && c.sdpMLineIndex <= 65535));
}

export function parseClientEvent(raw) {
  const e = envelope(raw);
  if (!string(e.requestId)) fail();
  switch (e.type) {
    case 'join':
      if (!string(e.room) || !string(e.name, 32) || !e.name.trim()) fail('INVALID_INPUT');
      break;
    case 'message':
      if (!string(e.room) || !string(e.operationId) || typeof e.text !== 'string') fail();
      if (!e.text.trim() || e.text.trim().length > LIMITS.text) fail('INVALID_INPUT');
      break;
    case 'create-room':
      if (!string(e.name, 32) || !e.name.trim()) fail('INVALID_INPUT');
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
  return e;
}

const room = r => object(r) && string(r.id) && string(r.name, 32) && typeof r.description === 'string' && r.description.length <= 2000;
const rooms = list => Array.isArray(list) && list.length <= LIMITS.rooms && list.every(room);
const message = m => object(m) && string(m.id) && string(m.room) && string(m.author, 32) &&
  string(m.text, LIMITS.text) && integer(m.created) && integer(m.sequence) && m.sequence > 0 &&
  (m.authorId === null || string(m.authorId)) && (m.operationId === null || string(m.operationId));
const member = m => object(m) && string(m.id) && string(m.name, 32) &&
  typeof m.inCall === 'boolean' && typeof m.muted === 'boolean' && typeof m.sharing === 'boolean' &&
  (m.callId === null || string(m.callId)) && integer(m.generation);

export function parseServerEvent(raw) {
  const e = envelope(raw);
  let valid = false;
  switch (e.type) {
    case 'hello': valid = string(e.id) && rooms(e.rooms); break;
    case 'joined': valid = string(e.requestId) && room(e.room) && Array.isArray(e.messages) && e.messages.length <= 200 && e.messages.every(message); break;
    case 'rooms': valid = rooms(e.rooms); break;
    case 'room-created': valid = string(e.requestId) && room(e.room); break;
    case 'presence': valid = string(e.room) && Array.isArray(e.members) && e.members.length <= LIMITS.connections && e.members.every(member); break;
    case 'message': valid = message(e.message); break;
    case 'message-accepted': valid = string(e.requestId) && message(e.message); break;
    case 'ack': valid = string(e.requestId) && ['call-join', 'call-leave', 'media'].includes(e.action) &&
      string(e.callId) && typeof e.inCall === 'boolean' && typeof e.muted === 'boolean' && typeof e.sharing === 'boolean'; break;
    case 'signal': valid = string(e.from) && string(e.fromCallId) && string(e.callId) && validSignal(e.signal); break;
    case 'error': valid = string(e.code, 64) && string(e.message, 512) && string(e.phase, 64) && (e.requestId == null || string(e.requestId)); break;
  }
  if (!valid) fail();
  return e;
}

export function readIceServers(value = [{ urls: 'stun:stun.l.google.com:19302' }]) {
  if (!Array.isArray(value)) fail('INVALID_INPUT');
  return value.map(entry => {
    if (!object(entry)) fail('INVALID_INPUT');
    const urls = Array.isArray(entry.urls) ? entry.urls : [entry.urls];
    if (!urls.length || !urls.every(url => typeof url === 'string' && /^(stun|stuns|turn|turns):\S+$/.test(url)) ||
        (entry.username !== undefined && typeof entry.username !== 'string') ||
        (entry.credential !== undefined && typeof entry.credential !== 'string')) fail('INVALID_INPUT');
    return { urls: Array.isArray(entry.urls) ? [...urls] : entry.urls,
      ...(entry.username !== undefined ? { username: entry.username } : {}),
      ...(entry.credential !== undefined ? { credential: entry.credential } : {}) };
  });
}

export function parsePort(value = '4310') {
  if (!/^\d+$/.test(String(value))) fail('INVALID_INPUT');
  const port = Number(value);
  if (!integer(port) || port > 65535) fail('INVALID_INPUT');
  return port;
}
