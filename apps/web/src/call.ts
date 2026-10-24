// ponytail: malha P2P, cada participante envia uma cópia da mídia para cada outro; acima de ~5 pessoas com vídeo, trocar por um SFU (ex.: mediasoup).
// ponytail: só STUN; usuários atrás de NAT simétrico precisam de um servidor TURN aqui.
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

type Source = 'mic' | 'camera' | 'screen';
type Signal = { description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
type Peer = { pc: RTCPeerConnection; streams: Map<string, MediaStream>; handle: (signal: Signal) => Promise<void> };

export type Call = ReturnType<typeof createCall>;

export function createCall(myId: string, signal: (to: string, data: Signal) => void, onChange: () => void) {
  const peers = new Map<string, Peer>();
  const local: Partial<Record<Source, MediaStream>> = {};

  function connect(id: string) {
    const existing = peers.get(id);
    if (existing) return existing;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const streams = new Map<string, MediaStream>();
    // Perfect negotiation: https://developer.mozilla.org/docs/Web/API/WebRTC_API/Perfect_negotiation
    const polite = BigInt(myId) < BigInt(id);
    let makingOffer = false;
    let ignoreOffer = false;

    pc.ontrack = ({ streams: [stream] }) => {
      streams.set(stream.id, stream);
      stream.onremovetrack = () => {
        if (!stream.getTracks().length) streams.delete(stream.id);
        onChange();
      };
      onChange();
    };
    pc.onicecandidate = ({ candidate }) => candidate && signal(id, { candidate: candidate.toJSON() });
    pc.onnegotiationneeded = async () => {
      try {
        makingOffer = true;
        await pc.setLocalDescription();
        signal(id, { description: pc.localDescription!.toJSON() });
      } finally {
        makingOffer = false;
      }
    };

    async function handle({ description, candidate }: Signal) {
      if (description) {
        const collision = description.type === 'offer' && (makingOffer || pc.signalingState !== 'stable');
        ignoreOffer = !polite && collision;
        if (ignoreOffer) return;
        await pc.setRemoteDescription(description);
        if (description.type === 'offer') {
          await pc.setLocalDescription();
          signal(id, { description: pc.localDescription!.toJSON() });
        }
      } else if (candidate) {
        await pc.addIceCandidate(candidate).catch((err) => {
          if (!ignoreOffer) throw err;
        });
      }
    }

    for (const stream of Object.values(local)) stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    const peer = { pc, streams, handle };
    peers.set(id, peer);
    onChange();
    return peer;
  }

  function disconnect(id: string) {
    peers.get(id)?.pc.close();
    if (peers.delete(id)) onChange();
  }

  function stop(source: Source) {
    const stream = local[source];
    if (!stream) return;
    for (const track of stream.getTracks()) {
      track.stop();
      for (const { pc } of peers.values()) {
        const sender = pc.getSenders().find((s) => s.track === track);
        if (sender) pc.removeTrack(sender);
      }
    }
    delete local[source];
    onChange();
  }

  async function start(source: Source) {
    const stream =
      source === 'mic' ? await navigator.mediaDevices.getUserMedia({ audio: true })
      : source === 'camera' ? await navigator.mediaDevices.getUserMedia({ video: true })
      : await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    local[source] = stream;
    for (const track of stream.getTracks()) {
      track.onended = () => stop(source);
      for (const { pc } of peers.values()) pc.addTrack(track, stream);
    }
    onChange();
  }

  return {
    local,
    peers,
    start,
    stop,
    async toggle(source: Source) {
      if (local[source]) stop(source);
      else await start(source);
    },
    setMuted(muted: boolean) {
      local.mic?.getAudioTracks().forEach((track) => (track.enabled = !muted));
      onChange();
    },
    sync(ids: string[]) {
      for (const id of peers.keys()) if (!ids.includes(id)) disconnect(id);
      for (const id of ids) connect(id);
    },
    receive: (from: string, data: Signal) => connect(from).handle(data).catch(console.error),
    leave() {
      (Object.keys(local) as Source[]).forEach(stop);
      for (const id of [...peers.keys()]) disconnect(id);
    },
  };
}
