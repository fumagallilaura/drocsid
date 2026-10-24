import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { Call } from '../src/rtc.js';

const results = [];
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function stream(id, kind = 'audio') {
  const track = { kind, readyState: 'live', enabled: true, stop() { this.readyState = 'ended'; } };
  return { id, track, getTracks: () => [track], getAudioTracks: () => kind === 'audio' ? [track] : [], getVideoTracks: () => kind === 'video' ? [track] : [] };
}
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: {} } });
function makeCall() {
  const events = [], updates = [], errors = [];
  const call = new Call({ id: 'a', iceServers: [], send: e => events.push(e), onStreams: () => {}, onMedia: m => updates.push({ ...m }), onError: e => errors.push(e) });
  return { call, events, updates, errors };
}

// An old permission request completes after the user has left and joined again.
{
  const firstRequest = deferred(), nextRequest = deferred();
  let requests = 0;
  navigator.mediaDevices.getUserMedia = () => requests++ === 0 ? firstRequest.promise : nextRequest.promise;
  const { call, events } = makeCall();
  const oldJoin = call.join(); call.leave(); const newJoin = call.join();
  const oldStream = stream('old'), newStream = stream('new');
  firstRequest.resolve(oldStream); await oldJoin;
  const staleRequestAccepted = events.filter(e => e.type === 'call-join').length === 1;
  nextRequest.resolve(newStream); await newJoin;
  call.close();
  assert.equal(staleRequestAccepted, true);
  assert.equal(oldStream.track.readyState, 'live');
  results.push({ id: 'RTC-01', confirmed: true, observation: 'Stale join accepted after re-entry; previous microphone remains live even after close().', staleRequestAccepted, oldMicrophoneAfterClose: oldStream.track.readyState, newMicrophoneAfterClose: newStream.track.readyState });
  oldStream.track.stop();
}

// Two clicks while the microphone permission request is pending.
{
  const firstRequest = deferred(), nextRequest = deferred(); let requests = 0;
  navigator.mediaDevices.getUserMedia = () => requests++ === 0 ? firstRequest.promise : nextRequest.promise;
  const { call } = makeCall(); call.active = true;
  const first = call.toggleMicrophone(), second = call.toggleMicrophone();
  const firstStream = stream('first'), secondStream = stream('second');
  firstRequest.resolve(firstStream); await first;
  nextRequest.resolve(secondStream); await second;
  call.close();
  assert.equal(firstStream.track.readyState, 'live');
  results.push({ id: 'RTC-02', confirmed: true, observation: 'Concurrent microphone acquisition loses the first stream; close() cannot stop it.', microphoneRequests: requests, lostMicrophoneAfterClose: firstStream.track.readyState });
  firstStream.track.stop();
}

// Capture succeeds, but one peer rejects its sender replacement.
{
  const captured = stream('display', 'video');
  navigator.mediaDevices.getDisplayMedia = async () => captured;
  const { call, events, updates } = makeCall(); call.active = true;
  const sender = { replaceTrack: async () => { throw new Error('simulated sender failure'); } };
  call.peers.set('b', { video: { sender }, audio: { sender }, pc: { close() {} } });
  await assert.rejects(call.shareScreen(false, 1080), /sender failure/);
  assert.equal(captured.track.readyState, 'live');
  assert.equal(updates.length, 0);
  results.push({ id: 'RTC-03', confirmed: true, observation: 'Sender failure leaves screen capture live without notifying the UI or sending sharing=true.', trackAfterFailure: captured.track.readyState, uiUpdates: updates.length, announcedSharing: events.some(e => e.sharing === true) });
  call.close();
}

// Joining after close() still performs an unnecessary acquisition.
{
  let requests = 0;
  const mic = stream('after-close');
  navigator.mediaDevices.getUserMedia = async () => { requests++; return mic; };
  const { call } = makeCall(); call.close(); await call.join();
  assert.equal(requests, 1);
  results.push({ id: 'RTC-04', confirmed: true, observation: 'join() on a closed instance still requests microphone access before stopping the result.', requests, stoppedEventually: mic.track.readyState === 'ended' });
}

// Sender failures prevent UI/server cleanup even though capture is already stopped.
{
  const captured = stream('stopping', 'video');
  const { call, events, updates } = makeCall(); call.active = true; call.display = captured;
  const sender = { replaceTrack: async () => { throw new Error('closed peer'); } };
  call.peers.set('b', { video: { sender }, audio: { sender }, pc: { close() {} } });
  await assert.rejects(call.stopScreen(), /closed peer/);
  results.push({ id: 'RTC-05', confirmed: true, observation: 'stopScreen() failure skips sharing=false and UI notification.', captureStopped: captured.track.readyState === 'ended', uiUpdates: updates.length, sharingFalseSent: events.some(e => e.sharing === false) });
  call.close();
}

writeFileSync(new URL('rtc-probes.json', import.meta.url), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
