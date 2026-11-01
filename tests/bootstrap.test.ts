import {isRecord} from './helpers/assertions.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { WebSocket } from 'ws';
import { startServer } from '../server/index.js';
import { postgresFixture } from './helpers/postgres.js';
import {testPort} from './helpers/service.js';

const env = (extra:Record<string,string|undefined>={},fixture?:Awaited<ReturnType<typeof postgresFixture>>) => ({ DATABASE_URL:fixture?.url, DROCSID_TRUSTED_LOCAL:'1', HOST: '127.0.0.1', PORT: '0', ICE_SERVERS: '[]', ...extra });

test('STAB-49: invalid configuration and occupied port fail without signal/listener leaks', async t => {
  const signals = process.listenerCount('SIGINT');
  for (const config of [{ PORT: '-1' }, { PORT: '65536' }, { ICE_SERVERS: '{' }, { ICE_SERVERS: '[{"urls":17}]' }]) {
    await assert.rejects(startServer({ production: true, env: env(config) }), e => isRecord(e)&&e.code === 'INVALID_INPUT');
  }
  const occupied = createServer(); await new Promise<void>(resolveListen => occupied.listen(0, '127.0.0.1', resolveListen));
  const fixture=await postgresFixture(t);
  t.after(() => new Promise<void>((resolveClose,reject) => occupied.close(error=>error?reject(error):resolveClose())));
  await assert.rejects(startServer({ production: true, env: env({ PORT: String(testPort(occupied)) },fixture) }), e => isRecord(e)&&e.code === 'BOOTSTRAP_FAILED');
  assert.equal(process.listenerCount('SIGINT'), signals);
});

test('STAB-49/50: separate server serves validated ICE config and closes idempotently', async t => {
  const fixture=await postgresFixture(t);
  const host = await startServer({ production: true, env: env({ ICE_SERVERS: '[{"urls":"stun:localhost:3478"}]' },fixture) });
  t.after(() => host.close());
  const config = await (await fetch(`http://127.0.0.1:${testPort(host.server)}/api/config`)).json();
  assert.deepEqual(config.iceServers, [{ urls: 'stun:localhost:3478' }]); assert.equal(config.protocolVersion, 2);
  await Promise.all([host.close(), host.close()]); assert.equal(host.server.listening, false);
});

test('STAB-49: a database open failure retains its cause and leaves bootstrap retryable',async t=>{
  const directory=mkdtempSync(resolve(tmpdir(),'conversa-bootstrap-'));
  t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const signals=['SIGINT','SIGTERM'].map(name=>process.listenerCount(name));
  const fixture=await postgresFixture(t);
  await assert.rejects(startServer({production:true,env:env({DATABASE_URL:'postgres://unavailable:fictional@127.0.0.1:1/missing'})}),error=>isRecord(error)&&error.code==='BOOTSTRAP_FAILED'&&isRecord(error.cause)&&error.cause?.code==='PERSISTENCE_FAILED');
  assert.deepEqual(['SIGINT','SIGTERM'].map(name=>process.listenerCount(name)),signals);
  const retry=await startServer({production:true,env:env({},fixture)});t.after(()=>retry.close());
  assert.equal((await fetch(`http://127.0.0.1:${testPort(retry.server)}/api/health`)).status,200);
  await retry.close();assert.equal(retry.server.listening,false);
  assert.deepEqual(['SIGINT','SIGTERM'].map(name=>process.listenerCount(name)),signals);
});

test('STAB-34: registered Vite HMR upgrade works while unknown paths are rejected', async t => {
  const fixture=await postgresFixture(t);
  const host = await startServer({ production: false, env: env({},fixture) }); t.after(() => host.close());
  const address = `ws://127.0.0.1:${testPort(host.server)}`;
  const ping = new WebSocket(address + '/', 'vite-ping', { handshakeTimeout: 1500 }), opened = once(ping, 'open'), closed = once(ping, 'close');
  await opened; assert.equal((await closed)[0], 1000);
  const wrong = new WebSocket(address + '/unused-upgrade', 'vite-hmr', { handshakeTimeout: 1500 }); wrong.on('error', () => {});
  const status = await new Promise((resolveStatus, reject) => { wrong.once('error', reject); wrong.once('unexpected-response', (_req, res) => { resolveStatus(res.statusCode); res.resume(); wrong.terminate(); }); });
  assert.equal(status, 404);
});

test('STAB-36/37: both signal handlers close a separate process inside five seconds', async t => {
  const fixture=await postgresFixture(t);
  for (const signal of ['SIGINT', 'SIGTERM']) {
    const moduleUrl = pathToFileURL(resolve('server/index.js')).href;
    const script = `import {startServer} from ${JSON.stringify(moduleUrl)}; await startServer({production:true}); process.emit(${JSON.stringify(signal)});`;
    const started = performance.now(), child = spawn(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env, ...env({},fixture) }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let stderr = ''; child.stderr.on('data', bytes => { stderr += bytes; }); child.stdout.resume();
    const deadline = setTimeout(() => child.kill(), 5000);
    const [code] = await once(child, 'exit'); clearTimeout(deadline);
    assert.equal(code, 0, stderr); assert.ok(performance.now() - started < 5000);
  }
});
