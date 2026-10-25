import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, connect } from 'node:net';
import { resolve } from 'node:path';
import { readFlag, desktopTarget, closeResources, closeDesktop, createTestProfile, removeTestProfile } from '../scripts/test-runtime.mjs';
import { createService } from '../server/service.js';
import { client } from './helpers/client.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

test('BUILD-07/09: source never reads a release manifest and flags distinguish 0/1', () => {
  assert.equal(readFlag('FLAG', false, { FLAG: '0' }), false);
  assert.equal(readFlag('FLAG', false, { FLAG: '1' }), true);
  assert.equal(readFlag('FLAG', true, {}), true);
  for (const FLAG of ['', 'false', 'yes', '2']) assert.throws(() => readFlag('FLAG', false, { FLAG }), /must be 0 or 1/);
  assert.deepEqual(desktopTarget({ CONVERSA_CHECK_SOURCE: '1', CONVERSA_BUILD_MANIFEST: 'nonexistent-manifest.json' }), { args: [resolve('.')] });
  assert.deepEqual(desktopTarget({ CONVERSA_CHECK_SOURCE: '0', CONVERSA_TEST_EXECUTABLE: 'application.exe' }), { args: [], executablePath: resolve('application.exe') });
});

test('BUILD-08: failed desktop cleanup still closes a listening test server', async () => {
  const server = createServer(); await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  const port = server.address().port; let killed = false;
  const desktop = { close: async () => { throw new Error('close failed'); }, process: () => ({ kill: () => { killed = true; } }) };
  await assert.rejects(closeResources([() => closeDesktop(desktop), () => new Promise(resolveClose => server.close(resolveClose))]), AggregateError);
  assert.equal(killed, true); assert.equal(server.listening, false);
  await assert.rejects(new Promise((resolveConnection, reject) => { const socket = connect(port, '127.0.0.1'); socket.once('error', reject); socket.once('connect', () => { socket.destroy(); resolveConnection(); }); }), { code: 'ECONNREFUSED' });
});

test('BUILD-08: a stalled cleanup has a terminal result within five seconds', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const waiting = closeResources([() => new Promise(() => {})]);
  const result = assert.rejects(waiting, error => error instanceof AggregateError && error.errors.some(cause => /timed out/.test(cause.message)));
  t.mock.timers.tick(5000); await result;
});

test('BUILD-08: WS closure rejects a pending event instead of waiting for its timeout', async () => {
  const service = createService({ dbPath: ':memory:', iceServers: [] });
  await new Promise(resolveListen => service.server.listen(0, '127.0.0.1', resolveListen));
  try {
    const c = await client(`ws://127.0.0.1:${service.server.address().port}/ws`);
    const waiting = c.next('never'); c.ws.terminate(); await assert.rejects(waiting, /WS closed/);
  } finally { await service.close(); }
});

test('BUILD-08: only an isolated temporary test profile may be removed', () => {
  const profile = createTestProfile(); removeTestProfile(profile);
  assert.throws(() => removeTestProfile(resolve('.')), /Unsafe test profile/);
});

test('BUILD-08: a real launch failure exits without leaving the external test server alive', async () => {
  const started = performance.now();
  await assert.rejects(promisify(execFile)(process.execPath, ['scripts/desktop-smoke.mjs'], {
    cwd: resolve('.'), env: { ...process.env, CONVERSA_TEST_EXTERNAL: '1', CONVERSA_TEST_EXECUTABLE: resolve('test-results/nonexistent-conversa.exe') },
    timeout: 5000, windowsHide: true,
  }), error => { assert.equal(error.code, 1); assert.equal(error.killed, false); assert.match(error.stderr, /ENOENT|failed to launch/i); return true; });
  assert.ok(performance.now() - started < 5000);
});
