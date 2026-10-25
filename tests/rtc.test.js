import test from 'node:test';
import assert from 'node:assert/strict';
import { Call } from '../src/rtc.js';

const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; };
const stream = (kinds = ['audio']) => {
  const tracks = kinds.map(kind => ({ kind, enabled: true, readyState: 'live', onended: null, stop() { this.readyState = 'ended'; } }));
  return { getTracks: () => tracks, getAudioTracks: () => tracks.filter(t => t.kind === 'audio'), getVideoTracks: () => tracks.filter(t => t.kind === 'video') };
};
class Clock {
  time = 0; next = 0; jobs = new Map();
  now = () => this.time;
  setTimeout = (fn, ms) => { const id=++this.next; this.jobs.set(id, { at:this.time+ms, fn }); return id; };
  clearTimeout = id => this.jobs.delete(id);
  tick(ms) { this.time+=ms; for (const [id,job] of [...this.jobs]) if (job.at<=this.time) { this.jobs.delete(id); job.fn(); } }
}
class PC {
  connectionState = 'new'; signalingState = 'stable'; slots = [];
  addTransceiver() { const sender = { track: null, fail: false, async replaceTrack(track) { if (this.fail) throw Error('sender'); this.track=track; } }; const slot={ sender, direction:'sendrecv' }; this.slots.push(slot); return slot; }
  getTransceivers() { return this.slots; }
  async createOffer() { return { type:'offer', sdp:'offer' }; }
  async createAnswer() { return { type:'answer', sdp:'answer' }; }
  async setLocalDescription(d) { this.localDescription={ ...d, toJSON: () => d }; }
  async setRemoteDescription(d) { this.remoteDescription=d; if (!this.slots.length) for (let i=0;i<3;i++) this.addTransceiver(); }
  async addIceCandidate(c) { (this.received ||= []).push(c); }
  close() { this.connectionState='closed'; this.signalingState='closed'; }
}
const drain = async () => { for (let i=0;i<12;i++) await Promise.resolve(); };
function fixture(overrides = {}) {
  const captures=[], events=[], states=[], errors=[], clock=new Clock();
  const devices={ async getUserMedia() { const s=stream(); captures.push(s); return s; }, async getDisplayMedia() { const s=stream(['video','audio']); captures.push(s); return s; }, ...overrides.devices };
  const call = new Call({ id:'a', iceServers:[], mediaDevices:devices, PeerConnection:PC,
    nextCallGeneration: overrides.nextCallGeneration,
    Stream: class { tracks=[]; addTrack(t) { this.tracks.push(t); } getTracks() { return this.tracks; } }, clock,
    send: overrides.send || (async e => { events.push(e); return { type:'ack', action:e.type, callId:e.callId, inCall:e.type!=='call-leave' }; }),
    onStreams() {}, onMedia: s=>states.push(s), onError: e=>errors.push(e) });
  return { call, captures, events, states, errors, clock };
}
const members = call => [{ id:'a', inCall:true, callId:call.callId }, { id:'b', inCall:true, callId:'remote-call' }];
const ended = s => assert.ok(s.getTracks().every(t => t.readyState==='ended'));

test('STAB-01/03/04/05: no startup capture; old permission cannot attach after leave/rejoin or close', async () => {
  const first=deferred(), second=deferred(); let requests=0;
  const f=fixture({ devices:{ getUserMedia: () => (++requests===1 ? first.promise : second.promise) } });
  assert.equal(requests,0);
  const a=f.call.join(); f.call.leave(); const b=f.call.join();
  const old=stream(), current=stream(); first.resolve(old); await a; ended(old);
  second.resolve(current); await b; assert.equal(f.call.microphone,current);
  f.call.close(); ended(current); assert.equal(f.call.peers.size,0);
  await assert.rejects(() => f.call.join()); assert.equal(requests,2);
});

test('STAB-02/06/08/09: acquisition is exclusive, pending is observable, listen-only admission works', async () => {
  const permission=deferred(); let requests=0; const f=fixture({ devices:{ getUserMedia:()=>{ requests++; return permission.promise; } } });
  const first=f.call.join(), second=f.call.join();
  assert.equal(requests,1); assert.equal(f.states.at(-1).pending,true);
  permission.reject(Error('permission denied')); await Promise.all([first,second]);
  assert.equal(f.call.admitted,true); assert.equal(f.call.microphone,null); assert.equal(f.events.at(-1).muted,true);
  assert.equal(f.states.at(-1).pending,false);
  f.call.leave(); assert.equal(f.call.active,false);
});

test('STAB-07: every admission rejection releases provisional microphone', async () => {
  for (const code of ['CALL_FULL','RATE_LIMITED','TIMEOUT','INVALID_EVENT']) {
    const f=fixture({ send:async e=>{ if(e.type==='call-join') throw Object.assign(Error('texto traduzido'),{code}); } });
    await assert.rejects(() => f.call.join(), e=>e.code===code);
    ended(f.captures[0]); assert.equal(f.call.active,false); assert.equal(f.call.microphone,null); assert.equal(f.states.at(-1).pending,false);
  }
});

test('STAB-02/03: simultaneous microphone activation acquires once; cancel stops late track', async () => {
  const permission=deferred(); let requests=0;
  const f=fixture({devices:{getUserMedia:()=>{requests++; if(requests===1) return Promise.reject(Error('absent')); return permission.promise;}}});
  await f.call.join(); const a=f.call.toggleMicrophone(), b=f.call.toggleMicrophone();
  assert.equal(requests,2); f.call.leave(); const late=stream(); permission.resolve(late); await Promise.all([a,b]); ended(late);
  assert.equal(f.call.microphone,null);
});

test('STAB-10/11: screen capture is explicit and late picker result is released', async () => {
  const picker=deferred(); let request;
  const f=fixture({devices:{getDisplayMedia: options=>{request=options;return picker.promise;}}});
  await f.call.join(); const sharing=f.call.shareScreen(false,'720');
  assert.equal(request.audio,false); assert.equal(request.video.height.ideal,720);
  f.call.leave(); const late=stream(['video','audio']); picker.resolve(late); await sharing; ended(late); assert.equal(f.call.display,null);
});

test('STAB-12/13/15/16/68: partial publication rolls back screen and preserves healthy microphone', async () => {
  const f=fixture(); await f.call.join(); f.call.sync(members(f.call)); await drain();
  const healthy=f.call.peers.get('b'); const bad=f.call.peer('c','call-c'); bad.video.sender.fail=true;
  await assert.rejects(() => f.call.shareScreen(true,'1080'));
  ended(f.captures[1]); assert.equal(f.call.display,null); assert.equal(f.states.at(-1).display,null);
  assert.equal(healthy.video.sender.track,null); assert.equal(healthy.mic.sender.track,f.call.microphone.getAudioTracks()[0]);
  assert.equal(f.call.microphone.getTracks()[0].readyState,'live'); assert.equal(f.call.admitted,true);
  assert.equal(bad.pc.connectionState,'closed'); assert.equal(f.events.at(-1).sharing,false);
  f.call.close();
});

test('STAB-14/15/68: source ending stops every display track even when detaching rejects', async () => {
  const f=fixture(); await f.call.join(); f.call.sync(members(f.call)); await drain();
  await f.call.shareScreen(true,'1080'); const display=f.call.display; const peer=f.call.peers.get('b'); peer.audio.sender.fail=true;
  display.getVideoTracks()[0].onended(); await drain();
  ended(display); assert.equal(f.call.display,null); assert.equal(peer.pc.connectionState,'closed');
  assert.equal(f.states.at(-1).display,null); assert.equal(f.events.at(-1).sharing,false); f.call.close();
});

test('STAB-12/13: one stalled sender cannot delay rollback after another sender fails', async () => {
  const f=fixture(); await f.call.join(); const slow=f.call.peer('b','slow-call'), bad=f.call.peer('c','bad-call');
  const pending=deferred(); slow.video.sender.replaceTrack=async track=>{ if(track) await pending.promise; slow.video.sender.track=track; };
  bad.video.sender.fail=true;
  const sharing=f.call.shareScreen(true,'1080'); const rejection=assert.rejects(sharing);
  await drain(); ended(f.captures[1]); assert.equal(f.call.display,null);
  await rejection; pending.resolve(); await drain(); f.call.close();
});

test('STAB-42/43: stalled peers terminate at 15s; candidates are bounded and expire', async () => {
  const f=fixture(); await f.call.join(); f.call.sync(members(f.call)); await drain();
  const peer=f.call.peers.get('b');
  for(let i=0;i<129;i++) f.call.signal('b',{candidate:{candidate:String(i)}},'remote-call');
  await drain(); await peer.queue;
  assert.equal(peer.candidates.length,128);
  f.clock.tick(15000); await drain(); assert.equal(peer.pc.connectionState,'closed'); assert.equal(peer.candidates.length,0);
  assert.ok(f.errors.length>0); f.call.sync(members(f.call)); assert.equal(f.call.peers.has('b'),false);
  f.call.retryPeer('b'); assert.equal(f.call.peers.has('b'),true); f.call.close();
});

test('MEDIA-05/21/28: cancellation keeps the original context while admission and leave replies are delayed', async () => {
  for (const lateFailure of [false, true]) {
    const admission=deferred(), departure=deferred(), events=[];
    const f=fixture({ send:e=>{
      events.push(e);
      if(e.type==='call-join' && events.filter(e=>e.type==='call-join').length===1) return admission.promise;
      if(e.type==='call-leave') return departure.promise;
      return Promise.resolve({ callId:e.callId, generation:e.generation, inCall:true });
    } });
    const oldJoin=f.call.join(); await drain(); const original=events[0];
    f.call.sync(members(f.call));
    assert.equal(f.call.admitted,false); assert.equal(f.call.peers.size,0);
    const oldMic=f.captures[0], leaving=f.call.leave();
    ended(oldMic); assert.equal(f.call.active,false); assert.equal(f.states.at(-1).pending,false);
    assert.deepEqual(events[1], { type:'call-leave', callId:original.callId, generation:original.generation });
    await f.call.join(); const current=f.call.microphone, currentId=f.call.callId, currentGeneration=f.call.generation;
    if(lateFailure) admission.reject(Object.assign(Error('erro antigo'),{code:'CALL_FULL'}));
    else admission.resolve({ callId:original.callId, generation:original.generation, inCall:true });
    await oldJoin;
    departure.reject(Object.assign(Error('erro antigo de saída'),{code:'TIMEOUT'})); await leaving;
    assert.equal(f.call.callId,currentId); assert.equal(f.call.generation,currentGeneration);
    assert.equal(f.call.microphone,current); assert.equal(current.getTracks()[0].readyState,'live');
    assert.equal(f.call.admitted,true); assert.deepEqual(f.errors,[]); f.call.close(); ended(current);
  }
});

test('MEDIA-03/28: permissions resolved in either order release every old track and preserve the new attempt', async () => {
  for(const oldFirst of [true,false]) {
    const oldPermission=deferred(), newPermission=deferred(); let requests=0;
    const f=fixture({ devices:{getUserMedia:()=>++requests===1 ? oldPermission.promise : newPermission.promise} });
    const oldJoin=f.call.join(); f.call.leave(); const newJoin=f.call.join();
    const old=stream(['audio','audio']), current=stream(['audio','audio']);
    if(oldFirst) { oldPermission.resolve(old); await oldJoin; newPermission.resolve(current); await newJoin; }
    else { newPermission.resolve(current); await newJoin; oldPermission.resolve(old); await oldJoin; }
    ended(old); assert.equal(f.call.microphone,current); assert.equal(f.call.admitted,true);
    assert.ok(current.getTracks().every(t=>t.readyState==='live'));
    f.call.close(); ended(current);
  }
});

test('MEDIA-06/31: the actual 8s admission deadline releases the provisional stream and identifies the attempt', async () => {
  const pending=deferred(), events=[];
  const f=fixture({ send:e=>{ events.push(e); return e.type==='call-join' ? pending.promise : Promise.resolve(); } });
  const joined=f.call.join(), rejected=assert.rejects(joined,e=>e.code==='TIMEOUT' && e.phase==='call-join' && e.callId===events[0].callId && e.generation===events[0].generation);
  await drain(); f.clock.tick(7999); await drain();
  assert.equal(f.states.at(-1).pending,true); assert.equal(f.captures[0].getTracks()[0].readyState,'live');
  f.clock.tick(1); await rejected;
  ended(f.captures[0]); assert.equal(f.call.admitted,false); assert.equal(f.call.active,false);
  assert.deepEqual(events[1], { type:'call-leave', callId:events[0].callId, generation:events[0].generation });
  assert.equal(f.clock.jobs.size,0); f.call.close();
});

test('MEDIA-04/28: a stale generation allocator fails before any capture and close rejects capture actions', async () => {
  const f=fixture({ nextCallGeneration:()=>{ throw Object.assign(Error('epoch antigo'),{code:'CANCELLED'}); } });
  await assert.rejects(()=>f.call.join(),e=>e.code==='CANCELLED');
  assert.equal(f.captures.length,0); assert.equal(f.call.active,false);
  f.call.close(); await assert.rejects(()=>f.call.join()); await f.call.toggleMicrophone(); await f.call.shareScreen(false,'720');
  assert.equal(f.captures.length,0);
});

test('MEDIA-02/05/08/30/31: allocated context covers all sends, listen-only needs an explicit mic action and mute preserves capture', async () => {
  let generation=40, requests=0;
  const f=fixture({nextCallGeneration:()=>++generation,devices:{getUserMedia:async()=>{
    if(++requests===1) throw Error('dispositivo indisponível'); const s=stream(); f.captures.push(s); return s;
  }}});
  await f.call.join(); const callId=f.call.callId;
  assert.equal(f.call.generation,41); assert.equal(f.call.admitted,true); assert.equal(f.call.microphone,null);
  f.call.sync(members(f.call)); await drain();
  assert.equal(requests,1); assert.equal(f.call.peers.get('b').mic.sender.track,null);
  assert.equal(f.errors[0].code,'MEDIA_FAILED'); assert.equal(f.errors[0].phase,'microphone');
  assert.equal(f.errors[0].callId,callId); assert.equal(f.errors[0].generation,41);
  await f.call.toggleMicrophone(); const mic=f.call.microphone;
  assert.equal(requests,2); assert.equal(f.call.peers.get('b').mic.sender.track,mic.getAudioTracks()[0]);
  await f.call.toggleMicrophone();
  assert.equal(f.call.muted,true); assert.equal(mic.getAudioTracks()[0].enabled,false); assert.equal(mic.getAudioTracks()[0].readyState,'live');
  await f.call.toggleMicrophone(); assert.equal(mic.getAudioTracks()[0].enabled,true);
  await f.call.leave(); ended(mic); assert.equal(f.call.peers.size,0);
  for(const event of f.events) { assert.equal(event.callId,callId); assert.equal(event.generation,41); }
});
