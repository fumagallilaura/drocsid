import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, connect } from 'node:net';
import { resolve,join } from 'node:path';
import {writeFileSync} from 'node:fs';
import { readFlag, desktopTarget, closeResources, closeDesktop, createTestProfile, removeTestProfile,readBuildManifest } from '../scripts/test-runtime.mjs';
import { startService, testPort } from './helpers/service.js';
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

test('MERGE-15: package validation requires a version, both artifacts and a complete SHA256',()=>{
  const profile=createTestProfile(),path=join(profile,'manifest.json');
  const valid={version:'0.1.1',portable:'Drocsid-Windows.exe',executable:'win-unpacked/Drocsid.exe',sha256:'a'.repeat(64)};
  try{
    writeFileSync(path,JSON.stringify(valid));assert.deepEqual(readBuildManifest(path),valid);
    for(const invalid of [null,[],{}, {...valid,version:''},{...valid,portable:''},{...valid,executable:false},{...valid,sha256:'a'.repeat(63)},{...valid,sha256:'g'.repeat(64)}]){
      writeFileSync(path,JSON.stringify(invalid));assert.throws(()=>readBuildManifest(path),/Invalid build manifest/);
    }
  }finally{removeTestProfile(profile);}
});

test('BUILD-08: failed desktop cleanup still closes a listening test server', async () => {
  const server = createServer(); await new Promise<void>(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  const port = testPort(server); let killed = false;
  const desktop = { close: async () => { throw new Error('close failed'); }, process: () => ({ kill: () => { killed = true; } }) };
  await assert.rejects(closeResources([() => closeDesktop(desktop), () => new Promise<void>((resolveClose,reject) => server.close(error=>error?reject(error):resolveClose()))]), AggregateError);
  assert.equal(killed, true); assert.equal(server.listening, false);
  await assert.rejects(new Promise<void>((resolveConnection, reject) => { const socket = connect(port, '127.0.0.1'); socket.once('error', reject); socket.once('connect', () => { socket.destroy(); resolveConnection(); }); }), { code: 'ECONNREFUSED' });
});

test('BUILD-08: a stalled cleanup has a terminal result within five seconds', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const waiting = closeResources([() => new Promise(() => {})]);
  let settled = false; waiting.catch(() => {}).finally(() => { settled = true; });
  const result = assert.rejects(waiting, error => error instanceof AggregateError && error.errors.some(cause => /timed out/.test(cause.message)));
  t.mock.timers.tick(5000); await new Promise(setImmediate);
  assert.equal(settled, true); await result;
  let killed = false;
  const closing = closeDesktop({ close: () => new Promise(() => {}), process: () => ({ kill: () => { killed = true; } }) });
  const desktopResult = assert.rejects(closing, /timed out/);
  t.mock.timers.tick(5000); await new Promise(setImmediate);
  assert.equal(killed, true); await desktopResult;
});

test('BUILD-08: WS closure rejects a pending event instead of waiting for its timeout', async t => {
  const service = await startService(t);
  try {
    const c = await client(`ws://127.0.0.1:${testPort(service.server)}/ws`);
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
  }), error => { assert.ok(error instanceof Error&&'code' in error&&'killed' in error&&'stderr' in error&&typeof error.stderr==='string');assert.equal(error.code, 1); assert.equal(error.killed, false); assert.match(error.stderr, /ENOENT|failed to launch/i); return true; });
  assert.ok(performance.now() - started < 5000);
});
