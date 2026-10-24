import test from 'node:test';
import assert from 'node:assert/strict';
import { parseClientEvent, parseServerEvent, readIceServers, parsePort, LIMITS } from '../shared/protocol.js';

const event = (type, fields = {}) => ({ v: 1, type, requestId: 'request-1', ...fields });
const decode = value => parseClientEvent(JSON.stringify(value));
const rejects = (fn, code) => assert.throws(fn, e => e.code === code);

test('STAB-40/41: version and malformed client events have stable distinct outcomes', () => {
  for (const value of [null, [], 12, {}, { type: 'join' }, event('unknown')]) {
    rejects(() => decode(value), value && typeof value === 'object' && !Array.isArray(value) && value.v !== 1 ? 'INCOMPATIBLE_PROTOCOL' : 'INVALID_EVENT');
  }
  rejects(() => parseClientEvent('{'), 'INVALID_EVENT');
  rejects(() => decode({ ...event('join'), v: 2 }), 'INCOMPATIBLE_PROTOCOL');
  const valid = [
    event('join', { name: 'Ana', room: 'geral' }),
    event('message', { room: 'geral', operationId: 'operation-1', text: 'oi' }),
    event('create-room', { name: 'Jogos' }),
    event('call-join', { callId: 'call-1', generation: 1, muted: false }),
    event('call-leave', { callId: 'call-1' }),
    event('media', { callId: 'call-1', sharing: false }),
    event('signal', { callId: 'call-1', to: 'peer-2', toCallId: 'call-2', signal: { candidate: { candidate: '', sdpMid: null, sdpMLineIndex: 0 } } }),
  ];
  for (const value of valid) assert.deepEqual(decode(value), value);
  for (const value of valid) rejects(() => decode({ ...value, requestId: [] }), 'INVALID_EVENT');
  rejects(() => decode(event('signal', { callId: 'call-1', to: 'peer-2', toCallId: 'call-2', signal: { candidate: 'bad' } })), 'INVALID_EVENT');
});

test('STAB-27: trimmed message bounds accept 1 and 2000 UTF-16 units', () => {
  for (const text of ['a', 'x'.repeat(2000)]) assert.equal(decode(event('message', { room: 'geral', operationId: 'op', text })).text, text);
  for (const text of ['', '   ', 'x'.repeat(2001)]) rejects(() => decode(event('message', { room: 'geral', operationId: 'op', text })), 'INVALID_INPUT');
});

test('STAB-40: server data is validated before rendering or signaling', () => {
  assert.equal(parseServerEvent(JSON.stringify({ v: 1, type: 'hello', id: 'client', rooms: [{ id: 'geral', name: 'geral', description: '' }] })).id, 'client');
  for (const value of [[], { v: 1, type: 'hello', id: 'client', rooms: [null] }, { v: 1, type: 'presence', room: 'geral', members: {} }, { v: 1, type: 'message', message: { author: [] } }]) {
    rejects(() => parseServerEvent(JSON.stringify(value)), 'INVALID_EVENT');
  }
});

test('STAB-49/50: ICE config and ports use the same explicit validation', () => {
  const ice = [{ urls: ['stun:localhost:3478', 'turns:relay.example:5349'], username: 'test', credential: 'fictional' }];
  assert.deepEqual(readIceServers(ice), ice);
  assert.deepEqual(readIceServers([]), []);
  for (const bad of [{}, [null], [{ urls: '' }], [{ urls: [] }], [{ urls: [''] }], [{ urls: 'https://bad' }], [{ urls: 'turn:relay', credential: 3 }]]) rejects(() => readIceServers(bad), 'INVALID_INPUT');
  for (const value of ['0', '4310', '65535']) assert.equal(parsePort(value), Number(value));
  for (const value of ['-1', '65536', 'abc', '1.5', '1e3', '']) rejects(() => parsePort(value), 'INVALID_INPUT');
  assert.equal(LIMITS.callMembers, 6);
  assert.equal(LIMITS.connections, 24);
  assert.equal(LIMITS.outboundBytes, 1048576);
});
