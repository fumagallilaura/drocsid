import test from 'node:test';
import assert from 'node:assert/strict';
import { parseClientEvent, parseServerEvent, readIceServers, parsePort, readGroups, LIMITS, PROTOCOL_VERSION, ProtocolError } from '../shared/protocol.js';

const event = (type: string, fields: Record<string, unknown> = {}) => ({ v: PROTOCOL_VERSION, type, requestId: 'request-1', ...fields });
const decode = (value: unknown) => parseClientEvent(JSON.stringify(value));
const rejects = (fn: () => unknown, code: string) => assert.throws(fn, e => e instanceof ProtocolError && e.code === code);

test('MERGE-09/13: group responses require bounded identities and complete room data',()=>{
  const group={id:'group-a',name:'Equipe A',ownerId:'account-a',rooms:[{id:'room-a',name:'geral',description:'Sala inicial'}]};
  assert.deepEqual(readGroups([group]),[group]);assert.deepEqual(readGroups([]),[]);
  for(const value of [null,{},[null],[{...group,ownerId:false}],[{...group,name:''}],[{...group,rooms:[]}],[{...group,rooms:[{id:'room',name:'geral'}]}],Array.from({length:101},()=>group)])rejects(()=>readGroups(value),'INVALID_EVENT');
});

test('STAB-40/41: version and malformed client events have stable distinct outcomes', () => {
  for (const value of [null, [], 12, {}, { type: 'join' }, event('unknown')]) {
    rejects(() => decode(value), value && typeof value === 'object' && !Array.isArray(value) && (!('v' in value) || value.v !== PROTOCOL_VERSION) ? 'INCOMPATIBLE_PROTOCOL' : 'INVALID_EVENT');
  }
  rejects(() => parseClientEvent('{'), 'INVALID_EVENT');
  rejects(() => decode({ ...event('join'), v: 1 }), 'INCOMPATIBLE_PROTOCOL');
  const valid = [
    event('join', { name: 'Ana', room: 'geral' }),
    event('message', { room: 'geral', operationId: 'operation-1', text: 'oi' }),
    event('create-room', { name: 'Jogos' }),
    event('call-join', { callId: 'call-1', generation: 1, muted: false }),
    event('call-leave', { callId: 'call-1', generation:1 }),
    event('media', { callId: 'call-1', generation:1, sharing: false }),
    event('signal', { callId: 'call-1', generation:1, to: 'peer-2', toCallId: 'call-2', signal: { candidate: { candidate: '', sdpMid: null, sdpMLineIndex: 0 } } }),
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
  assert.equal(parseServerEvent(JSON.stringify({ v: 2, type: 'hello', id: 'client', rooms: [{ id: 'geral', name: 'geral', description: '' }] })).id, 'client');
  for (const value of [[], { v: 2, type: 'hello', id: 'client', rooms: [null] }, { v: 2, type: 'presence', room: 'geral', members: {} }, { v: 2, type: 'message', message: { author: [] } }]) {
    rejects(() => parseServerEvent(JSON.stringify(value)), 'INVALID_EVENT');
  }
});

test('STAB-40: received display and room names have 1 to 32 UTF-16 units after trim',()=>{
  const received=(name: unknown)=>[
    {v:2,type:'hello',id:'client',rooms:[{id:'geral',name,description:''}]},
    {v:2,type:'presence',room:'geral',context:'context',revision:1,members:[{id:'guest',name,inCall:false,muted:true,sharing:false,callId:null,generation:0}]},
    {v:2,type:'message',context:'context',message:{id:'message',room:'geral',author:name,text:'oi',created:1,sequence:1,authorId:null,operationId:null}},
  ];
  for(const name of ['', ' '.repeat(17), 'x'.repeat(33), null, []]){
    for(const payload of received(name))rejects(()=>parseServerEvent(JSON.stringify(payload)),'INVALID_EVENT');
    for(const type of ['join','create-room'])rejects(()=>decode(event(type,{name,room:'geral'})),'INVALID_INPUT');
  }
  for(const name of ['A','x'.repeat(32),'  Ana  ',`  ${'x'.repeat(32)}  `]){
    for(const payload of received(name))assert.deepEqual(parseServerEvent(JSON.stringify(payload)),payload);
    for(const type of ['join','create-room']){
      const payload=event(type,{name,room:'geral'});assert.deepEqual(decode(payload),payload);
    }
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

test('MEDIA-05/24/25/28: v2 requires bounded positive generations in every call event and rejects v1',()=>{
  assert.equal(PROTOCOL_VERSION,2);
  for(const type of ['call-join','call-leave','media','signal']) {
    const value=event(type,{callId:'call',generation:1,muted:true,sharing:false,to:'peer',toCallId:'peer-call',signal:{candidate:{candidate:''}}});
    assert.equal(decode(value).generation,1);
    assert.equal(decode({...value,generation:Number.MAX_SAFE_INTEGER}).generation,Number.MAX_SAFE_INTEGER);
    for(const generation of [undefined,null,0,-1,1.5,'1',Number.MAX_SAFE_INTEGER+1])rejects(()=>decode({...value,generation}),'INVALID_EVENT');
    rejects(()=>decode({...value,v:1}),'INCOMPATIBLE_PROTOCOL');
  }
});

test('MEDIA-26/28: v2 requires positive ack generations and presence revisions',()=>{
  const decodeServer=(value: unknown)=>parseServerEvent(JSON.stringify(value));
  const ack=event('ack',{action:'call-leave',callId:'call',generation:1,inCall:false,muted:true,sharing:false});
  const presence=event('presence',{room:'geral',context:'room-context',revision:1,members:[]});
  assert.equal(decodeServer(ack).generation,1);assert.equal(decodeServer(presence).revision,1);
  for(const invalid of [undefined,null,0,-1,1.5,'1',Number.MAX_SAFE_INTEGER+1]) {
    rejects(()=>decodeServer({...ack,generation:invalid}),'INVALID_EVENT');
    rejects(()=>decodeServer({...presence,revision:invalid}),'INVALID_EVENT');
  }
  assert.equal(decodeServer({...presence,revision:Number.MAX_SAFE_INTEGER}).revision,Number.MAX_SAFE_INTEGER);
  rejects(()=>decodeServer({...ack,v:1}),'INCOMPATIBLE_PROTOCOL');
});
