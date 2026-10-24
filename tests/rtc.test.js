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
