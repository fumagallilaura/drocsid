// Fixed transceiver slots allow microphone/screen replacement without renegotiation.
export class Call {
  constructor({ id, send, iceServers, onStreams, onMedia, onError }) {
    Object.assign(this, { id, send, iceServers, onStreams, onMedia, onError });
    this.peers = new Map(); this.microphone = null; this.display = null;
    this.active = false; this.muted = true; this.closed = false;
  }
  async join() {
    this.active = true;
    try {
      this.microphone = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      if (!this.active || this.closed) { this.microphone.getTracks().forEach(t => t.stop()); this.microphone = null; return; }
      this.muted = false;
    } catch { this.onError('Microfone indisponível. Você pode entrar para ouvir e compartilhar a tela.'); }
    if (this.active && !this.closed) this.send({ type: 'call-join', muted: this.muted });
    this.notify();
  }
  notify() { this.onMedia({ muted: this.muted, display: this.display }); }
  peer(id) {
    if (this.peers.has(id)) return this.peers.get(id);
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const initiator = this.id < id;
    const mic = initiator ? pc.addTransceiver('audio', { direction: 'sendrecv' }) : null;
    const video = initiator ? pc.addTransceiver('video', { direction: 'sendrecv' }) : null;
    const audio = initiator ? pc.addTransceiver('audio', { direction: 'sendrecv' }) : null;
    const stream = new MediaStream();
    const entry = { pc, mic, video, audio, stream, candidates: [], offered: false, queue: Promise.resolve() };
    this.peers.set(id, entry);
    pc.onicecandidate = event => { if (event.candidate) this.send({ type: 'signal', to: id, signal: { candidate: event.candidate.toJSON() } }); };
    pc.ontrack = ({ track }) => { stream.addTrack(track); this.publishStreams(); };
    pc.onconnectionstatechange = () => {
      this.publishStreams();
      if (pc.connectionState === 'failed') this.onError('Uma conexão de mídia falhou. Saia e entre novamente na chamada; redes restritas podem exigir um servidor TURN.');
    };
    return entry;
  }
  async attachTracks(entry) {
    if (!entry.mic) return;
    // Transceivers created by an incoming offer default to receive-only.
    // Replacing their sender track alone does not enable the outbound stream.
    for (const transceiver of [entry.mic, entry.video, entry.audio]) transceiver.direction = 'sendrecv';
    await Promise.all([
      entry.mic.sender.replaceTrack(this.microphone?.getAudioTracks()[0] || null),
      entry.video.sender.replaceTrack(this.display?.getVideoTracks()[0] || null),
      entry.audio.sender.replaceTrack(this.display?.getAudioTracks()[0] || null),
    ]);
  }
  publishStreams() {
    this.onStreams([...this.peers.entries()].map(([id, peer]) => ({ id, stream: peer.stream, state: peer.pc.connectionState })));
  }
  sync(members) {
    if (!this.active || this.closed) return;
    const own = members.find(m => m.id === this.id);
    if (!own?.inCall) return;
    const participants = members.filter(m => m.inCall && m.id !== this.id);
    const ids = new Set(participants.map(m => m.id));
    for (const [id, entry] of this.peers) if (!ids.has(id)) { entry.pc.close(); this.peers.delete(id); }
    for (const member of participants) {
      const entry = this.peer(member.id);
      if (this.id < member.id && !entry.offered) {
        entry.offered = true;
        entry.queue = entry.queue.then(async () => {
          if (entry.pc.signalingState === 'closed') return;
          await this.attachTracks(entry);
          await entry.pc.setLocalDescription(await entry.pc.createOffer());
          this.send({ type: 'signal', to: member.id, signal: { description: entry.pc.localDescription.toJSON() } });
        }).catch(error => { if (this.active) this.onError(`Falha ao iniciar a chamada: ${error.message}`); });
      }
    }
    this.publishStreams();
  }
  signal(from, signal) {
    if (!this.active || this.closed) return;
    const entry = this.peer(from);
    entry.queue = entry.queue.then(async () => {
      if (entry.pc.signalingState === 'closed') return;
      if (signal.description) {
        await entry.pc.setRemoteDescription(signal.description);
        for (const candidate of entry.candidates.splice(0)) await entry.pc.addIceCandidate(candidate);
        if (signal.description.type === 'offer') {
          [entry.mic, entry.video, entry.audio] = entry.pc.getTransceivers();
          await this.attachTracks(entry);
          await entry.pc.setLocalDescription(await entry.pc.createAnswer());
          this.send({ type: 'signal', to: from, signal: { description: entry.pc.localDescription.toJSON() } });
        }
      } else if (signal.candidate) {
        if (entry.pc.remoteDescription) await entry.pc.addIceCandidate(signal.candidate);
        else entry.candidates.push(signal.candidate);
      }
    }).catch(error => { if (this.active) this.onError(`Não foi possível conectar a mídia: ${error.message}`); });
  }
  async toggleMicrophone() {
    if (!this.active) return;
    if (!this.microphone) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      if (!this.active) { stream.getTracks().forEach(t => t.stop()); return; }
      this.microphone = stream;
      await Promise.all([...this.peers.values()].filter(p => p.mic).map(p => p.mic.sender.replaceTrack(stream.getAudioTracks()[0])));
      this.muted = false;
    } else {
      this.muted = !this.muted;
      this.microphone.getAudioTracks().forEach(t => { t.enabled = !this.muted; });
    }
    this.send({ type: 'media', muted: this.muted }); this.notify();
  }
  async shareScreen(systemAudio, quality) {
    if (!this.active) return;
    const display = await navigator.mediaDevices.getDisplayMedia({ video: { height: { ideal: Number(quality) }, frameRate: { ideal: 30, max: 30 } }, audio: systemAudio });
    if (!this.active) { display.getTracks().forEach(t => t.stop()); return; }
    this.display = display;
    display.getVideoTracks()[0].onended = () => this.stopScreen();
    await Promise.all([...this.peers.values()].filter(p => p.video).flatMap(p => [p.video.sender.replaceTrack(display.getVideoTracks()[0]), p.audio.sender.replaceTrack(display.getAudioTracks()[0] || null)]));
    this.send({ type: 'media', sharing: true }); this.notify();
  }
  async stopScreen() {
    const display = this.display; this.display = null;
    display?.getTracks().forEach(t => { t.onended = null; t.stop(); });
    await Promise.all([...this.peers.values()].filter(p => p.video).flatMap(p => [p.video.sender.replaceTrack(null), p.audio.sender.replaceTrack(null)]));
    if (this.active) this.send({ type: 'media', sharing: false }); this.notify();
  }
  leave(announce = true) {
    this.active = false;
    this.microphone?.getTracks().forEach(t => t.stop()); this.microphone = null;
    this.display?.getTracks().forEach(t => { t.onended = null; t.stop(); }); this.display = null;
    for (const peer of this.peers.values()) peer.pc.close();
    this.peers.clear(); this.muted = true;
    if (announce) this.send({ type: 'call-leave' });
    this.publishStreams(); this.notify();
  }
  close() { this.leave(false); this.closed = true; }
}
