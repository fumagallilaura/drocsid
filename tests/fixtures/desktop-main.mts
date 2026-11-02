import { app, session, ipcMain } from 'electron';
import assert from 'node:assert/strict';
import {validCaptureKey} from '../../electron/policy.js';
import type {CaptureOutcome} from '../../shared/desktop.js';

// A broken fixture must fail the process instead of waiting behind a native dialog.
process.on('uncaughtException',error=>{console.error(error);app.exit(1);});
process.on('unhandledRejection',error=>{console.error(error);app.exit(1);});

// Observe the public native boundary before the real entrypoint installs it.
// The production entrypoint and its request ownership remain unchanged.
const ready = app.whenReady.bind(app);
const probe:typeof globalThis.__captureProbe = globalThis.__captureProbe = { requests: [], deliveries: 0 };
const details:typeof globalThis.__captureDetails = globalThis.__captureDetails = { gestures: [], outcomes: [], grants: [] };
globalThis.__captureIpc = {};
globalThis.__captureMessages = [];
const listen = ipcMain.on.bind(ipcMain);
ipcMain.on = (channel, handler) => {
  if (!channel.startsWith('capture-')||channel==='capture-document') return listen(channel, handler);
  globalThis.__captureIpc[channel] = handler;
  return listen(channel, (event, value) => {
    const payload:unknown=value;assert.ok(payload!==null&&typeof payload==='object'&&'key' in payload&&validCaptureKey(payload.key));
    globalThis.__captureMessages.push({ channel, value:{...payload,key:payload.key}, sender:event.sender, senderFrame:event.senderFrame,event });
    let result:unknown;
    const observed = new Proxy(event,{set(target,key,value:unknown){if(key==='returnValue')result=value;return Reflect.set(target,key,value);}});
    handler(observed, value);
    if (channel === 'capture-finish') {
      assert.ok(result!==null&&typeof result==='object'&&'outcome' in result&&'code' in result&&'phase' in result&&'requestId' in result);
      assert.ok(result.outcome==='selected'||result.outcome==='cancelled'||result.outcome==='failed');assert.ok(result.code===null||typeof result.code==='string');assert.ok(typeof result.phase==='string');assert.ok(result.requestId===null||typeof result.requestId==='string');
      const outcome:CaptureOutcome={outcome:result.outcome,code:result.code,phase:result.phase,requestId:result.requestId};details.outcomes.push(outcome);
    }
  });
};
const timeout = globalThis.setTimeout, clear = globalThis.clearTimeout, timers = new Map<unknown,{fn():void;cancel():void;at:number}>();
let captureTime = 0;
globalThis.setTimeout=new Proxy(timeout,{apply(target,receiver,args:unknown[]){
  const id:unknown=Reflect.apply(target,receiver,args);
  if(args[1]===60000){const [fn,,...values]=args;assert.ok(typeof fn==='function');timers.set(id,{fn:()=>Reflect.apply(fn,undefined,values),cancel:()=>Reflect.apply(clear,globalThis,[id]),at:captureTime+60000});}
  return id;
}});
globalThis.clearTimeout = id => { timers.delete(id); return clear(id); };
globalThis.__advanceCapture = (ms:number) => {
  captureTime += ms;
  for (const [id, timer] of [...timers]) if (timer.at <= captureTime) { timers.delete(id);timer.cancel();timer.fn(); }
};
let installed = false;
app.whenReady = () => ready().then(() => {
  if (installed) return; installed = true;
  const setHandler = session.defaultSession.setDisplayMediaRequestHandler.bind(session.defaultSession);
  globalThis.__holdNative = false;
  session.defaultSession.setDisplayMediaRequestHandler = handler => setHandler(handler && ((request, callback) => {
    globalThis.__nativeCapture = handler; globalThis.__lastCaptureRequest = request;
    details.gestures.push(request.userGesture);
    const record:typeof probe.requests[number] = { calls: 0, results: [], finished: false }; probe.requests.push(record);
    const run = () => handler(request, result => {
      if (result) details.grants.push({ audioRequested:request.audioRequested, audio:result.audio || null, video:!!result.video });
      record.calls++; record.results.push(result === null ? 'cancelled' : 'granted');
      return callback(result);
    });
    return Promise.resolve(globalThis.__holdNative ? new Promise(resolve => { globalThis.__releaseNative = () => resolve(run()); }) : run()).finally(() => { record.finished = true; });
  }));
});
app.on('web-contents-created', (_event, contents) => {
  const send = contents.send.bind(contents);
  contents.send = (channel, ...values) => { if (channel === 'capture-sources') probe.deliveries++; return send(channel, ...values); };
});
await import('../../electron/main.js');
