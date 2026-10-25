import { app, session, ipcMain } from 'electron';

// Observe the public native boundary before the real entrypoint installs it.
// The production entrypoint and its request ownership remain unchanged.
const ready = app.whenReady.bind(app);
const probe = globalThis.__captureProbe = { requests: [], deliveries: 0 };
const details = globalThis.__captureDetails = { gestures: [], outcomes: [], grants: [] };
globalThis.__captureIpc = {};
globalThis.__captureMessages = [];
const listen = ipcMain.on.bind(ipcMain);
ipcMain.on = (channel, handler) => {
  if (!channel.startsWith('capture-')) return listen(channel, handler);
  globalThis.__captureIpc[channel] = handler;
  return listen(channel, (event, value) => {
    globalThis.__captureMessages.push({ channel, value, sender:event.sender, senderFrame:event.senderFrame });
    let result;
    const observed = { sender:event.sender, senderFrame:event.senderFrame, set returnValue(value) { result = value; event.returnValue = value; } };
    handler(observed, value);
    if (channel === 'capture-finish') details.outcomes.push(result);
  });
};
const timeout = globalThis.setTimeout, clear = globalThis.clearTimeout, timers = new Map();
let captureTime = 0;
globalThis.setTimeout = (fn, ms, ...args) => {
  const id = timeout(fn, ms, ...args);
  if (ms === 60000) timers.set(id, { fn, at:captureTime + ms });
  return id;
};
globalThis.clearTimeout = id => { timers.delete(id); return clear(id); };
globalThis.__advanceCapture = ms => {
  captureTime += ms;
  for (const [id, timer] of [...timers]) if (timer.at <= captureTime) { clearTimeout(id); timer.fn(); }
};
let installed = false;
app.whenReady = () => ready().then(() => {
  if (installed) return; installed = true;
  const setHandler = session.defaultSession.setDisplayMediaRequestHandler.bind(session.defaultSession);
  globalThis.__holdNative = false;
  session.defaultSession.setDisplayMediaRequestHandler = handler => setHandler(handler && ((request, callback) => {
    globalThis.__nativeCapture = handler; globalThis.__lastCaptureRequest = request;
    details.gestures.push(request.userGesture);
    const record = { calls: 0, results: [], finished: false }; probe.requests.push(record);
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
