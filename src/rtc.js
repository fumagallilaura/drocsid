import { LIMITS, ProtocolError, validSignal } from '../shared/protocol.js';

const stop = stream => stream?.getTracks().forEach(track => { track.onended = null; track.stop(); });
const realClock = { now: () => performance.now(), setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: id => clearTimeout(id) };

export class Call {
  constructor({ id, send, iceServers, onStreams, onMedia, onError,
    mediaDevices = navigator.mediaDevices, PeerConnection = globalThis.RTCPeerConnection,
    Stream = globalThis.MediaStream, clock = realClock, nextCallGeneration, captureDisplay, cancelDisplay = () => {} }) {
    Object.assign(this, { id, send, iceServers, onStreams, onMedia, onError, mediaDevices, PeerConnection, Stream, clock });
    this.peers = new Map(); this.failed = new Set(); this.members = [];
    this.generation = 0; this.screenGeneration = 0;
    let localGeneration = 0;
    this.nextCallGeneration = nextCallGeneration || (() => ++localGeneration);
    this.attempt = null;
    this.captureDisplay = captureDisplay || ((_key, constraints) => this.mediaDevices.getDisplayMedia(constraints));
    this.cancelDisplay = cancelDisplay;
    this.microphone = null; this.display = null;
    this.active = false; this.admitted = false; this.muted = true; this.closed = false;
  }
  current(attempt) { return this.active && !this.closed && this.attempt === attempt && attempt.state !== 'terminal'; }
  notify() { this.onMedia({ muted: this.muted, display: this.display, pending: this.active && !this.admitted, admitted: this.admitted,
    sharingState: this.screenOperation?.state === 'terminal' ? 'idle' : this.screenOperation?.state || 'idle' }); }
  report(error) { this.onError(error instanceof Error ? error : new Error(String(error))); }
  failure(error, phase, attempt) {
    return Object.assign(new ProtocolError(error.code || 'MEDIA_FAILED', error.message), {
      phase: error.phase || phase, requestId: error.requestId || null, callId: attempt.callId, generation: attempt.generation,
    });
  }
  announce(event, attempt = this.attempt, operation = null) {
    if (!attempt) return Promise.resolve();
    const failed = error => { if (this.attempt === attempt && !this.closed && (!operation || this.screenOperation === operation)) this.report(Object.assign(this.failure(error, event.type, attempt), operation ? { operationId: operation.operationId } : {})); };
    try { return Promise.resolve(this.send({ ...event, callId: attempt.callId, generation: attempt.generation })).catch(failed); }
    catch (error) { failed(error); return Promise.resolve(); }
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
    let generation;
    try { generation = this.nextCallGeneration(); } catch (error) { return Promise.reject(error); }
    const attempt = { callId: crypto.randomUUID(), generation, state: 'acquiring' };
    this.attempt = attempt; this.generation = generation; this.callId = attempt.callId;
    this.active = true; this.admitted = false; this.notify();
    const operation = (async () => {
      try {
        try { await this.acquireMicrophone(attempt); }
        catch { if (this.current(attempt)) this.report(this.failure(new ProtocolError('MEDIA_FAILED', 'Microfone indisponível. Você pode ouvir e compartilhar a tela.'), 'microphone', attempt)); }
        if (!this.current(attempt)) return;
        attempt.state = 'admitting';
        const ack = await this.deadline(Promise.resolve(this.send({ type: 'call-join', callId: attempt.callId, generation, muted: this.muted })), LIMITS.requestMs);
        if (!this.current(attempt)) return;
        if (ack?.callId !== attempt.callId || ack?.inCall !== true || ack.generation !== generation) throw new ProtocolError('INVALID_EVENT');
        attempt.state = 'admitted'; this.admitted = true; this.notify(); this.sync(this.members);
      } catch (error) {
        if (!this.current(attempt)) return;
        this.leave();
        throw this.failure(error, 'call-join', attempt);
      } finally { if (this.attempt === attempt) { this.joining = null; this.notify(); } }
    })();
    this.joining = operation;
    return operation;
  }
  acquireMicrophone(attempt) {
    if (!this.current(attempt)) return Promise.resolve(null);
    if (this.micPending?.attempt === attempt) return this.micPending.promise;
    const operation = (async () => {
      const stream = await this.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      if (!this.current(attempt)) { stop(stream); return null; }
      stop(this.microphone); this.microphone = stream; this.muted = false;
      stream.getAudioTracks().forEach(track => { track.onended = () => { if (this.current(attempt) && this.microphone === stream) { stop(stream); this.microphone = null; this.muted = true; this.notify(); void this.announce({ type: 'media', muted: true }, attempt); } }; });
      return stream;
    })();
    const pending = { attempt, promise: operation };
    this.micPending = pending;
    operation.finally(() => { if (this.micPending === pending) this.micPending = null; }).catch(() => {});
    return operation;
  }
  async toggleMicrophone() {
    if (!this.active || !this.admitted || this.closed) return;
    const attempt = this.attempt;
    if (this.micPending?.attempt === attempt) return this.micPending.promise;
    if (!this.microphone || !this.microphone.getAudioTracks().some(t => t.readyState === 'live')) {
      const stream = await this.acquireMicrophone(attempt);
      if (!stream || !this.current(attempt)) return;
      await Promise.all([...this.peers.values()].map(async entry => {
        const work = entry.queue.then(() => { if (entry.mic && this.current(attempt) && this.peers.get(entry.id) === entry) return entry.mic.sender.replaceTrack(stream.getAudioTracks()[0]); });
        entry.queue = work.catch(() => {});
        try { await this.deadline(work, 1000); }
        catch { if (this.current(attempt) && this.peers.get(entry.id) === entry) this.failPeer(entry.id); }
      }));
    } else {
      this.muted = !this.muted;
      this.microphone.getAudioTracks().forEach(track => { track.enabled = !this.muted; });
    }
    if (this.current(attempt)) { this.notify(); await this.announce({ type: 'media', muted: this.muted }, attempt); }
  }
  peer(id, callId) {
    if (this.peers.has(id)) return this.peers.get(id);
    const pc = new this.PeerConnection({ iceServers: this.iceServers });
    const initiator = this.id < id;
    const entry = { id, callId, pc, stream: new this.Stream(), candidates: [], offered: false, queue: Promise.resolve() };
    for (const [name, kind] of [['mic', 'audio'], ['video', 'video'], ['audio', 'audio']]) entry[name] = initiator ? pc.addTransceiver(kind, { direction: 'sendrecv' }) : null;
    this.peers.set(id, entry);
    const attempt = this.attempt;
    const live = () => this.current(attempt) && this.peers.get(id) === entry;
    entry.timer = this.clock.setTimeout(() => { if (live()) this.failPeer(id); }, LIMITS.negotiationMs);
    pc.onicecandidate = event => { if (live() && event.candidate) void this.announce({ type: 'signal', to: id, toCallId: entry.callId, signal: { candidate: event.candidate.toJSON() } }, attempt); };
    pc.ontrack = ({ track }) => { if (live()) { entry.stream.addTrack(track); this.publishStreams(); } };
    pc.onconnectionstatechange = () => {
      if (!live()) return;
      if (['failed', 'closed'].includes(pc.connectionState)) this.failPeer(id);
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
  screenCurrent(operation) { return operation && this.screenOperation === operation && operation.state !== 'terminal' && this.current(operation.attempt); }
  async replaceTracks(entry, tracks, operation) {
    if (operation) entry.screenWrites = (entry.screenWrites || 0) + 1;
    const results = await Promise.allSettled(tracks.map(async ([slot, track]) => {
      try { await slot.sender.replaceTrack(track); }
      catch (error) { operation?.reject(error); throw error; }
    }));
    if (operation) --entry.screenWrites;
    const failed = results.find(result => result.status === 'rejected');
    if (failed) throw failed.reason;
  }
  async attachTracks(entry) {
    const attempt = this.attempt, operation = this.screenOperation;
    if (!entry.mic || !this.current(attempt) || this.peers.get(entry.id) !== entry) return;
    for (const slot of [entry.mic, entry.video, entry.audio]) slot.direction = 'sendrecv';
    const display = this.screenCurrent(operation) ? operation.stream : null;
    if (display) operation.affected.add(entry);
    await this.replaceTracks(entry, [[entry.mic, this.microphone?.getAudioTracks()[0] || null],
      [entry.video, display?.getVideoTracks()[0] || null], [entry.audio, display?.getAudioTracks().find(track => track.readyState === 'live') || null]], display ? operation : null);
  }
  publishStreams() {
    const streams = [...this.peers.entries()].map(([id, entry]) => {
      const ready = entry.pc.connectionState === 'connected' && entry.stream.getTracks().some(t => t.readyState === 'live');
      if (ready) this.clock.clearTimeout(entry.timer);
      return { id, stream: entry.stream, state: ready ? 'connected' : entry.pc.connectionState === 'connected' ? 'connecting' : entry.pc.connectionState };
    });
    this.onStreams([...streams, ...[...this.failed].map(id => ({ id, stream: null, state: 'failed' }))]);
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
      const entry = this.peer(member.id, member.callId), attempt = this.attempt;
      if (this.id < member.id && !entry.offered) {
        entry.offered = true;
        entry.queue = entry.queue.then(async () => {
          if (!this.current(attempt) || this.peers.get(member.id) !== entry) return;
          await this.attachTracks(entry);
          await entry.pc.setLocalDescription(await entry.pc.createOffer());
          if (this.current(attempt) && this.peers.get(member.id) === entry) await this.announce({ type: 'signal', to: member.id, toCallId: entry.callId, signal: { description: entry.pc.localDescription.toJSON() } }, attempt);
        }).catch(() => { if (this.current(attempt) && this.peers.get(member.id) === entry) this.failPeer(member.id); });
        this.trackScreenWork(entry, entry.queue);
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
    const entry = this.peer(from, fromCallId), attempt = this.attempt;
    entry.queue = entry.queue.then(async () => {
      if (!this.current(attempt) || this.peers.get(from) !== entry) return;
      if (signal.description) {
        await entry.pc.setRemoteDescription(signal.description);
        this.expireCandidates(entry);
        for (const item of entry.candidates.splice(0)) await entry.pc.addIceCandidate(item.candidate);
        if (signal.description.type === 'offer') {
          [entry.mic, entry.video, entry.audio] = entry.pc.getTransceivers();
          if (!entry.mic || !entry.video || !entry.audio) throw new ProtocolError('INVALID_EVENT');
          await this.attachTracks(entry);
          await entry.pc.setLocalDescription(await entry.pc.createAnswer());
          if (this.current(attempt) && this.peers.get(from) === entry) await this.announce({ type: 'signal', to: from, toCallId: entry.callId, signal: { description: entry.pc.localDescription.toJSON() } }, attempt);
        }
      } else if (entry.pc.remoteDescription) await entry.pc.addIceCandidate(signal.candidate);
      else { this.expireCandidates(entry); if (entry.candidates.length < LIMITS.candidates) entry.candidates.push({ candidate: signal.candidate, at: this.clock.now() }); this.expireCandidates(entry); }
    }).catch(() => { if (this.current(attempt) && this.peers.get(from) === entry) this.failPeer(from); });
    this.trackScreenWork(entry, entry.queue);
    return entry.queue;
  }
  trackScreenWork(entry, work) {
    const operation = this.screenOperation;
    if (!this.screenCurrent(operation) || !operation.stream) return;
    operation.affected.add(entry); operation.publications.add(work);
    work.catch(operation.reject).finally(() => operation.publications.delete(work));
  }
  shareScreen(systemAudio, quality) {
    if (!this.active || !this.admitted || this.closed) return Promise.resolve();
    if (this.screenPending) return this.screenPending;
    if (this.display) return Promise.resolve();
    const attempt = this.attempt;
    let reject;
    const failed = new Promise((_, no) => { reject = no; }); failed.catch(() => {});
    const operation = { operationId: crypto.randomUUID(), attempt, state: 'selecting', stream: null, affected: new Set(), publications: new Set(), reject };
    operation.key = { callId: attempt.callId, generation: attempt.generation, operationId: operation.operationId };
    this.screenOperation = operation; this.notify();
    const pending = (async () => {
      try {
        const display = await this.captureDisplay(operation.key, { video: { height: { ideal: Number(quality) }, frameRate: { ideal: 30, max: 30 } }, audio: systemAudio === true });
        operation.stream = display;
        if (!this.screenCurrent(operation)) { stop(display); return; }
        operation.acquiredAt = this.clock.now();
        if (!systemAudio) display.getAudioTracks().forEach(track => { track.onended = null; track.stop(); });
        operation.state = 'publishing'; this.notify();
        display.getVideoTracks()[0].onended = () => { void this.stopScreen(operation).catch(error => this.report(error)); };
        const publish = (async () => {
          for (const entry of this.peers.values()) if (entry.video) {
            const work = entry.queue.then(() => {
              if (!this.screenCurrent(operation) || this.peers.get(entry.id) !== entry) return;
              return this.replaceTracks(entry, [[entry.video, display.getVideoTracks()[0]], [entry.audio, display.getAudioTracks().find(track => track.readyState === 'live') || null]], operation);
            });
            entry.queue = work.catch(() => {}); this.trackScreenWork(entry, work);
          }
          while (operation.publications.size) await Promise.all([...operation.publications]);
          if (!this.screenCurrent(operation)) return;
          await this.send({ type: 'media', sharing: true, callId: attempt.callId, generation: attempt.generation });
          while (operation.publications.size) await Promise.all([...operation.publications]);
        })();
        await this.deadline(Promise.race([publish, failed]), Math.max(0, operation.acquiredAt + LIMITS.requestMs - this.clock.now()));
        if (!this.screenCurrent(operation)) return;
        operation.state = 'active'; this.display = display; this.notify();
      } catch (error) {
        if (!this.screenCurrent(operation)) return;
        const phase = operation.state === 'selecting' ? 'capture' : 'screen-publication';
        await this.stopScreen(operation);
        throw Object.assign(this.failure(error, phase, attempt), { operationId: operation.operationId });
      }
    })();
    this.screenPending = pending;
    pending.finally(() => { if (this.screenPending === pending) this.screenPending = null; }).catch(() => {});
    return pending;
  }
  stopScreen(operation = this.screenOperation) {
    if (!operation) return Promise.resolve();
    if (operation.cleanup) return operation.cleanup;
    operation.state = 'terminal'; operation.terminalAt = this.clock.now();
    stop(operation.stream); this.cancelDisplay(operation.key);
    if (this.screenOperation === operation) { this.display = null; this.notify(); }
    operation.reject(new ProtocolError('CANCELLED'));
    if (this.current(operation.attempt) && this.admitted) void this.announce({ type: 'media', sharing: false }, operation.attempt, operation);
    operation.cleanup = (async () => {
      await Promise.all([...operation.affected].map(async entry => {
        if (this.peers.get(entry.id) !== entry) return;
        if (entry.screenWrites) { this.failPeer(entry.id); return; }
        const work = entry.queue.then(() => this.replaceTracks(entry, [[entry.video, null], [entry.audio, null]]));
        entry.queue = work.catch(() => {});
        try { await this.deadline(work, Math.max(0, operation.terminalAt + 1000 - this.clock.now())); }
        catch { if (this.peers.get(entry.id) === entry) this.failPeer(entry.id); }
      }));
    })();
    return operation.cleanup;
  }
  leave(announce = true) {
    const attempt = this.attempt;
    if (attempt) attempt.state = 'terminal';
    ++this.screenGeneration;
    const screen = this.screenOperation;
    if (screen) { screen.state = 'terminal'; stop(screen.stream); this.cancelDisplay(screen.key); screen.reject(new ProtocolError('CANCELLED')); }
    this.active = false; this.admitted = false; this.joining = null; this.screenPending = null;
    stop(this.microphone); this.microphone = null; stop(this.display); this.display = null;
    for (const id of [...this.peers.keys()]) this.dropPeer(id);
    this.failed.clear(); this.members = []; this.muted = true;
    this.publishStreams(); this.notify();
    if (announce && attempt) return this.announce({ type: 'call-leave' }, attempt);
    return Promise.resolve();
  }
  close() { if (this.closed) return; this.closed = true; void this.leave(false); }
}
