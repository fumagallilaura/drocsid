import { app, session } from 'electron';

// Observe the public native boundary before the real entrypoint installs it.
// The production entrypoint and its request ownership remain unchanged.
const ready = app.whenReady.bind(app);
const probe = globalThis.__captureProbe = { requests: [], deliveries: 0 };
let installed = false;
app.whenReady = () => ready().then(() => {
  if (installed) return; installed = true;
  const setHandler = session.defaultSession.setDisplayMediaRequestHandler.bind(session.defaultSession);
  session.defaultSession.setDisplayMediaRequestHandler = handler => setHandler(handler && ((request, callback) => {
    const record = { calls: 0, results: [], finished: false }; probe.requests.push(record);
    return Promise.resolve(handler(request, result => {
      record.calls++; record.results.push(result === null ? 'cancelled' : 'granted');
      return callback(result);
    })).finally(() => { record.finished = true; });
  }));
});
app.on('web-contents-created', (_event, contents) => {
  const send = contents.send.bind(contents);
  contents.send = (channel, ...values) => { if (channel === 'capture-sources') probe.deliveries++; return send(channel, ...values); };
});
await import('../../electron/main.js');
