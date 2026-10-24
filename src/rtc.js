import { LIMITS, ProtocolError, validSignal } from '../shared/protocol.js';

const stop = stream => stream?.getTracks().forEach(track => { track.onended = null; track.stop(); });
const realClock = { now: () => Date.now(), setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: id => clearTimeout(id) };

export class Call {
  constructor({ id, send, iceServers, onStreams, onMedia, onError,
    mediaDevices = navigator.mediaDevices, PeerConnection = globalThis.RTCPeerConnection,
    Stream = globalThis.MediaStream, clock = realClock }) {
    Object.assign(this, { id, send, iceServers, onStreams, onMedia, onError, mediaDevices, PeerConnection, Stream, clock });
    this.peers = new Map(); this.failed = new Set(); this.members = [];
    this.generation = 0; this.screenGeneration = 0;
    this.microphone = null; this.display = null;
    this.active = false; this.admitted = false; this.muted = true; this.closed = false;
  }
  current(generation) { return this.active && !this.closed && this.generation === generation; }
  notify() { this.onMedia({ muted: this.muted, display: this.display, pending: this.active && !this.admitted, admitted: this.admitted }); }
  report(error) { this.onError(error instanceof Error ? error : new Error(String(error))); }
  announce(event) {
    try { return Promise.resolve(this.send({ ...event, callId: this.callId })).catch(error => { this.report(error); }); }
    catch (error) { this.report(error); return Promise.resolve(); }
  }
  deadline(promise, ms) {
    let timer;
    return Promise.race([promise, new Promise((_, reject) => {
      timer = this.clock.setTimeout(() => reject(new ProtocolError('TIMEOUT')), ms);
    })]).finally(() => this.clock.clearTimeout(timer));
  }
  join() {
    if (this.closed) return Promise.reject(new ProtocolError('MEDIA_FAILED', 'Chamada encerrada.'));
    if (this.joining) return this.joining;
    if (this.admitted) return Promise.resolve();
    const generation = ++this.generation;
    this.callId = crypto.randomUUID(); this.active = true; this.admitted = false; this.notify();
    const operation = (async () => {
      try {
        try { await this.acquireMicrophone(generation); }
        catch { if (this.current(generation)) this.report(new ProtocolError('MEDIA_FAILED', 'Microfone indisponível. Você pode ouvir e compartilhar a tela.')); }
        if (!this.current(generation)) return;
        const ack = await this.deadline(Promise.resolve(this.send({ type: 'call-join', callId: this.callId, generation, muted: this.muted })), LIMITS.requestMs);
        if (!this.current(generation)) return;
        if (ack?.callId !== this.callId || ack?.inCall !== true) throw new ProtocolError('INVALID_EVENT');
        this.admitted = true; this.notify(); this.sync(this.members);
      } catch (error) {
        if (!this.current(generation)) return;
        this.leave();
        throw error;
      } finally { if (this.generation === generation) { this.joining = null; this.notify(); } }
    })();
    this.joining = operation;
    return operation;
  }
  acquireMicrophone(generation) {
    if (this.micPending?.generation === generation) return this.micPending.promise;
    const operation = (async () => {
      const stream = await this.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      if (!this.current(generation)) { stop(stream); return null; }
      stop(this.microphone); this.microphone = stream; this.muted = false;
      stream.getAudioTracks().forEach(track => { track.onended = () => { if (this.microphone === stream) { stop(stream); this.microphone = null; this.muted = true; this.notify(); void this.announce({ type: 'media', muted: true }); } }; });
      return stream;
    })();
    const pending = { generation, promise: operation };
    this.micPending = pending;
    operation.finally(() => { if (this.micPending === pending) this.micPending = null; }).catch(() => {});
    return operation;
  }
  async toggleMicrophone() {
    if (!this.active || !this.admitted || this.closed) return;
    const generation = this.generation;
    if (this.micPending?.generation === generation) return this.micPending.promise;
    if (!this.microphone || !this.microphone.getAudioTracks().some(t => t.readyState === 'live')) {
      const stream = await this.acquireMicrophone(generation);
      if (!stream || !this.current(generation)) return;
      await Promise.all([...this.peers.values()].map(async entry => {
        try { if (entry.mic) await this.deadline(entry.mic.sender.replaceTrack(stream.getAudioTracks()[0]), 1000); }
        catch { this.failPeer(entry.id); }
      }));
    } else {
      this.muted = !this.muted;
      this.microphone.getAudioTracks().forEach(track => { track.enabled = !this.muted; });
    }
    if (this.current(generation)) { this.notify(); await this.announce({ type: 'media', muted: this.muted }); }
  }
  peer(id, callId) {
    if (this.peers.has(id)) return this.peers.get(id);
    const pc = new this.PeerConnection({ iceServers: this.iceServers });
    const initiator = this.id < id;
    const entry = { id, callId, pc, stream: new this.Stream(), candidates: [], offered: false, queue: Promise.resolve() };
    for (const [name, kind] of [['mic', 'audio'], ['video', 'video'], ['audio', 'audio']]) entry[name] = initiator ? pc.addTransceiver(kind, { direction: 'sendrecv' }) : null;
    this.peers.set(id, entry);
    const generation = this.generation;
    const live = () => this.current(generation) && this.peers.get(id) === entry;
    entry.timer = this.clock.setTimeout(() => { if (live()) this.failPeer(id); }, LIMITS.negotiationMs);
    pc.onicecandidate = event => { if (live() && event.candidate) void this.announce({ type: 'signal', to: id, toCallId: entry.callId, signal: { candidate: event.candidate.toJSON() } }); };
    pc.ontrack = ({ track }) => { if (live()) { entry.stream.addTrack(track); this.publishStreams(); } };
    pc.onconnectionstatechange = () => {
      if (!live()) return;
      if (pc.connectionState === 'failed') this.failPeer(id);
      else this.publishStreams();
    };
    return entry;
  }
  dropPeer(id) {
    const entry = this.peers.get(id); if (!entry) return;
    this.peers.delete(id); this.clock.clearTimeout(entry.timer); this.clock.clearTimeout(entry.candidateTimer);
    entry.candidates.length = 0; entry.pc.ontrack = null; entry.pc.onicecandidate = null; entry.pc.onconnectionstatechange = null; entry.pc.close();
  }
  failPeer(id) { this.dropPeer(id); this.failed.add(id); this.report(new ProtocolError('MEDIA_FAILED', 'A mídia falhou. Tente reconectar a chamada.')); this.publishStreams(); }
  retryPeer(id) { this.dropPeer(id); this.failed.delete(id); this.sync(this.members); }
  async attachTracks(entry) {
    if (!entry.mic) return;
    for (const slot of [entry.mic, entry.video, entry.audio]) slot.direction = 'sendrecv';
    await Promise.all([
      entry.mic.sender.replaceTrack(this.microphone?.getAudioTracks()[0] || null),
      entry.video.sender.replaceTrack(this.display?.getVideoTracks()[0] || null),
      entry.audio.sender.replaceTrack(this.display?.getAudioTracks()[0] || null),
    ]);
  }
  publishStreams() {
    const streams = [...this.peers.entries()].map(([id, entry]) => {
      const ready = entry.pc.connectionState === 'connected' && entry.stream.getTracks().some(t => t.readyState === 'live');
      if (ready) this.clock.clearTimeout(entry.timer);
      return { id, stream: entry.stream, state: ready ? 'connected' : entry.pc.connectionState === 'connected' ? 'connecting' : entry.pc.connectionState };
    });
    this.onStreams(streams);
  }
  sync(members) {
    this.members = members;
    if (!this.active || !this.admitted || this.closed) return;
    const own = members.find(m => m.id === this.id);
    if (!own?.inCall || own.callId !== this.callId) return;
    const others = members.filter(m => m.inCall && m.id !== this.id);
    for (const [id, entry] of this.peers) if (!others.some(m => m.id === id && m.callId === entry.callId)) { this.dropPeer(id); this.failed.delete(id); }
    for (const member of others) {
      if (this.failed.has(member.id)) continue;
      const entry = this.peer(member.id, member.callId), generation = this.generation;
      if (this.id < member.id && !entry.offered) {
        entry.offered = true;
        entry.queue = entry.queue.then(async () => {
          if (!this.current(generation) || this.peers.get(member.id) !== entry) return;
          await this.attachTracks(entry);
          await entry.pc.setLocalDescription(await entry.pc.createOffer());
          if (this.current(generation) && this.peers.get(member.id) === entry) await this.announce({ type: 'signal', to: member.id, toCallId: entry.callId, signal: { description: entry.pc.localDescription.toJSON() } });
        }).catch(() => { if (this.current(generation) && this.peers.get(member.id) === entry) this.failPeer(member.id); });
      }
    }
    this.publishStreams();
  }
  expireCandidates(entry) {
    this.clock.clearTimeout(entry.candidateTimer);
    entry.candidates = entry.candidates.filter(c => this.clock.now() - c.at < LIMITS.candidateMs);
    if (entry.candidates.length) entry.candidateTimer = this.clock.setTimeout(() => this.expireCandidates(entry), Math.max(1, LIMITS.candidateMs - (this.clock.now() - entry.candidates[0].at)));
  }
  signal(from, signal, fromCallId) {
    if (!this.active || !this.admitted || !validSignal(signal) || !this.members.some(m => m.id === from && m.inCall && m.callId === fromCallId) || this.failed.has(from)) return;
    const entry = this.peer(from, fromCallId), generation = this.generation;
    entry.queue = entry.queue.then(async () => {
      if (!this.current(generation) || this.peers.get(from) !== entry) return;
      if (signal.description) {
        await entry.pc.setRemoteDescription(signal.description);
        this.expireCandidates(entry);
        for (const item of entry.candidates.splice(0)) await entry.pc.addIceCandidate(item.candidate);
        if (signal.description.type === 'offer') {
          [entry.mic, entry.video, entry.audio] = entry.pc.getTransceivers();
          if (!entry.mic || !entry.video || !entry.audio) throw new ProtocolError('INVALID_EVENT');
          await this.attachTracks(entry);
          await entry.pc.setLocalDescription(await entry.pc.createAnswer());
          if (this.current(generation) && this.peers.get(from) === entry) await this.announce({ type: 'signal', to: from, toCallId: entry.callId, signal: { description: entry.pc.localDescription.toJSON() } });
        }
      } else if (entry.pc.remoteDescription) await entry.pc.addIceCandidate(signal.candidate);
      else { this.expireCandidates(entry); if (entry.candidates.length < LIMITS.candidates) entry.candidates.push({ candidate: signal.candidate, at: this.clock.now() }); this.expireCandidates(entry); }
    }).catch(() => { if (this.current(generation) && this.peers.get(from) === entry) this.failPeer(from); });
    return entry.queue;
  }
  shareScreen(systemAudio, quality) {
    if (!this.active || !this.admitted || this.closed) return Promise.resolve();
    if (this.screenPending) return this.screenPending;
    if (this.display) return Promise.resolve();
    const generation = this.generation, screenGeneration = ++this.screenGeneration;
    const operation = (async () => {
      const display = await this.mediaDevices.getDisplayMedia({ video: { height: { ideal: Number(quality) }, frameRate: { ideal: 30, max: 30 } }, audio: systemAudio === true });
      if (!this.current(generation) || this.screenGeneration !== screenGeneration) { stop(display); return; }
      this.display = display;
      display.getVideoTracks()[0].onended = () => { void this.stopScreen().catch(error => this.report(error)); };
      this.notify();
      try {
        await Promise.all([...this.peers.values()].filter(p => p.video).map(async entry => {
          try { await this.deadline(Promise.all([entry.video.sender.replaceTrack(display.getVideoTracks()[0]), entry.audio.sender.replaceTrack(display.getAudioTracks()[0] || null)]), LIMITS.requestMs); }
          catch (error) { if (this.current(generation) && this.screenGeneration === screenGeneration && this.peers.get(entry.id) === entry) this.failPeer(entry.id); throw error; }
        }));
        if (!this.current(generation) || this.screenGeneration !== screenGeneration) { stop(display); return; }
        await this.announce({ type: 'media', sharing: true }); this.notify();
      } catch (error) { if (this.display === display) await this.stopScreen(); else stop(display); throw error; }
    })();
    this.screenPending = operation;
    operation.finally(() => { if (this.screenPending === operation) this.screenPending = null; }).catch(() => {});
    return operation;
  }
  async stopScreen() {
    ++this.screenGeneration;
    const display = this.display; this.display = null; stop(display); this.notify();
    const notice = this.active && this.admitted ? this.announce({ type: 'media', sharing: false }) : Promise.resolve();
    await Promise.all([...this.peers.values()].filter(p => p.video).map(async entry => {
      try { await this.deadline(Promise.all([entry.video.sender.replaceTrack(null), entry.audio.sender.replaceTrack(null)]), 1000); }
      catch { this.failPeer(entry.id); }
    }));
    await notice;
  }
  leave(announce = true) {
    const callId = this.callId;
    ++this.generation; ++this.screenGeneration;
    this.active = false; this.admitted = false; this.joining = null; this.screenPending = null;
    stop(this.microphone); this.microphone = null; stop(this.display); this.display = null;
    for (const id of [...this.peers.keys()]) this.dropPeer(id);
    this.failed.clear(); this.members = []; this.muted = true;
    this.publishStreams(); this.notify();
    if (announce && callId) return this.announce({ type: 'call-leave' });
    return Promise.resolve();
  }
  close() { if (this.closed) return; this.closed = true; void this.leave(false); }
}
