import assert from 'node:assert/strict';
import {Call} from '../../src/rtc.js';
import type {CaptureTrack,LocalMedia,RemoteStream} from '../../src/rtc.js';
import type {CallAction,CallContext} from '../../shared/protocol.js';
import {required} from '../helpers/assertions.js';
const deferred = <T=void,>() => Promise.withResolvers<T>();
type Track=CaptureTrack&{onended:(()=>void)|null};
const stream = (kinds:string[] = ['audio']) => {
  const tracks:Track[] = kinds.map(kind => ({ kind, enabled: true, readyState: 'live', onended: null, stop() { this.readyState = 'ended'; } }));
  return { getTracks: () => tracks, getAudioTracks: () => tracks.filter(t => t.kind === 'audio'), getVideoTracks: () => tracks.filter(t => t.kind === 'video') };
};
class Clock {
  time = 0; next = 0; jobs = new Map<number,{at:number;fn():void}>();
  now = () => this.time;
  setTimeout = (fn:()=>void, ms:number) => { const id=++this.next; this.jobs.set(id, { at:this.time+ms, fn }); return id; };
  clearTimeout = (id:unknown) => {if(typeof id==='number')this.jobs.delete(id);};
  tick(ms:number) { this.time+=ms; for (const [id,job] of [...this.jobs]) if (job.at<=this.time) { this.jobs.delete(id); job.fn(); } }
}
type Slot={sender:{track:Track|null;fail:boolean;replaceTrack(track:Track|null):Promise<void>};direction:string};
type Event=CallAction&CallContext&{sharing?:boolean;muted?:boolean};
type ReportedError=Error&Partial<{code:string;phase:string;callId:string;generation:number;operationId:string}>;
class PC {
  connectionState = 'new'; signalingState = 'stable'; slots:Slot[] = [];
  remoteDescription:RTCSessionDescriptionInit|undefined;localDescription:{toJSON():RTCSessionDescriptionInit}|null=null;
  ontrack:((event:{track:Track})=>void)|null=null;onicecandidate:((event:{candidate:{toJSON():unknown}|null})=>void)|null=null;onconnectionstatechange:(()=>void)|null=null;
  received:RTCIceCandidateInit[]=[];
  addTransceiver() { const sender:Slot['sender'] = { track: null, fail: false, async replaceTrack(track) { if (this.fail) throw Error('sender'); this.track=track; } }; const slot={ sender, direction:'sendrecv' }; this.slots.push(slot); return slot; }
  getTransceivers() { return this.slots; }
  async createOffer():Promise<RTCSessionDescriptionInit> { return { type:'offer', sdp:'offer' }; }
  async createAnswer():Promise<RTCSessionDescriptionInit> { return { type:'answer', sdp:'answer' }; }
  async setLocalDescription(d:RTCSessionDescriptionInit) { this.localDescription={ ...d, toJSON: () => d }; }
  async setRemoteDescription(d:NonNullable<RTCSessionDescriptionInit>&{type:'offer'|'answer';sdp:string}) { this.remoteDescription=d; if (!this.slots.length) for (let i=0;i<3;i++) this.addTransceiver(); }
  async addIceCandidate(c:RTCIceCandidateInit) { (this.received ||= []).push(c); }
  close() { this.connectionState='closed'; this.signalingState='closed'; }
}
const drain = async () => { for (let i=0;i<12;i++) await Promise.resolve(); };
type Stream=ReturnType<typeof stream>;
class Received implements RemoteStream<Track> {tracks:Track[]=[];addTrack(t:Track){this.tracks.push(t);}getTracks(){return this.tracks;}}
type FixtureCall=Call<Track,Stream,Received,Slot,PC>;
type Options=ConstructorParameters<typeof Call<Track,Stream,Received,Slot,PC>>[0];
function fixture(overrides:Partial<Pick<Options,'nextCallGeneration'|'captureDisplay'|'cancelDisplay'|'send'>>&{devices?:Partial<Options['mediaDevices']>} = {}) {
  const captures:Stream[]=[], events:Event[]=[], states:LocalMedia<Stream>[]=[], errors:ReportedError[]=[], clock=new Clock();
  const devices={ async getUserMedia() { const s=stream(); captures.push(s); return s; }, async getDisplayMedia() { const s=stream(['video','audio']); captures.push(s); return s; }, ...overrides.devices };
  const call = new Call<Track,Stream,Received,Slot,PC>({ id:'a', iceServers:[], mediaDevices:devices, PeerConnection:PC,
    nextCallGeneration: overrides.nextCallGeneration,
    captureDisplay: overrides.captureDisplay, cancelDisplay: overrides.cancelDisplay,
    Stream: Received, clock,
    send: overrides.send || (async e => { events.push(e); return { type:'ack', action:e.type, callId:e.callId, generation:e.generation, inCall:e.type!=='call-leave' }; }),
    onStreams() {}, onMedia: s=>states.push(s), onError: e=>errors.push(e) });
  return { call, captures, events, states, errors, clock };
}
const members = (call:FixtureCall) => [{ id:'a', inCall:true, callId:required(call.callId) }, { id:'b', inCall:true, callId:'remote-call' }];
const ended = (s:Stream|null) => assert.ok(required(s).getTracks().every(t => t.readyState==='ended'));

export {deferred,stream,fixture,drain,members,ended};
export type {Event,Stream,Options};
