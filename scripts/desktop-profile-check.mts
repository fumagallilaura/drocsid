import { _electron as electron } from 'playwright';
import type {ElectronApplication} from 'playwright';
import { expect } from '@playwright/test';
import { writeFileSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createServer } from 'node:net';
import type {Server} from 'node:net';
import { spawn } from 'node:child_process';
import { createTestProfile, removeTestProfile, closeDesktop, closeResources,testEnvironment } from './test-runtime.mjs';
import { startServer } from '../server/index.js';
import { createPostgresFixture } from '../tests/helpers/postgres.js';
import {testPort} from '../tests/helpers/service.js';
import {required} from '../tests/helpers/assertions.js';

const profile = createTestProfile();
const env = testEnvironment(); delete env.ELECTRON_RUN_AS_NODE;
const iceServers=[{urls:'stun:127.0.0.1:3478'}];env.ICE_SERVERS=JSON.stringify(iceServers);
const executablePath = process.env.CONVERSA_TEST_EXECUTABLE;
const args = [...(executablePath ? [] : [resolve('.')]), `--user-data-dir=${profile}`, '--use-fake-device-for-media-stream', '--mute-audio'];
const launch = () => electron.launch({ ...(executablePath ? { executablePath } : {}), args, env, timeout: 15000 });
const preferencesPath = join(profile, 'preferences.json');
let desktop:ElectronApplication|undefined, blocker:Server|undefined, comparison:Awaited<ReturnType<typeof startServer>>|undefined, postgres:Awaited<ReturnType<typeof createPostgresFixture>>|undefined;
const nativeErrors:string[] = [];
function observeNative(application:ElectronApplication) {
  required(application.process().stderr).on('data', bytes => { const text = bytes.toString(); if (/UnhandledPromiseRejection|uncaughtException/.test(text)) nativeErrors.push(text); });
}
try {
  postgres=await createPostgresFixture();env.DATABASE_URL=postgres.url;env.DROCSID_TRUSTED_LOCAL='1';env.DROCSID_HOST='1';
  writeFileSync(preferencesPath, '{invalid preferences');
  comparison=await startServer({production:true,env:{DATABASE_URL:postgres.url,DROCSID_TRUSTED_LOCAL:'1',HOST:'127.0.0.1',PORT:'0',ICE_SERVERS:env.ICE_SERVERS}});
  desktop = await launch();
  observeNative(desktop);
  let page = await required(desktop).firstWindow();
  await expect(page.getByRole('heading', { name: 'Vamos nos encontrar?' })).toBeVisible();
  const standalone=await(await fetch(`http://127.0.0.1:${testPort(comparison.server)}/api/config`)).json();
  const embedded=await page.evaluate(async()=>await(await fetch('/api/config')).json());
  expect(standalone.iceServers).toEqual(iceServers);expect(embedded.iceServers).toEqual(iceServers);expect(embedded.iceServers).toEqual(standalone.iceServers);
  expect(await page.evaluate(() => {if(!window.desktop)throw new Error('Missing desktop bridge');return window.desktop.preferences;})).toEqual({ name: '', server: '', quality: '1080' });
  expect(readFileSync(preferencesPath, 'utf8')).toBe('{invalid preferences');
  expect(await page.evaluate(async () => {
    try { const stream = await navigator.mediaDevices.getUserMedia({ video: true }); stream.getTracks().forEach(track => track.stop()); return 'granted'; }
    catch (error) { return error instanceof Error?error.name:'UnknownError'; }
  })).toBe('NotAllowedError');
  await page.evaluate(() => { const frame = document.createElement('iframe'); frame.src = '/'; document.body.append(frame); });
  await expect.poll(() => page.frames().filter(frame => frame.parentFrame()).length).toBe(1);
  const frame = required(page.frames().find(frame => frame.parentFrame()));
  await frame.waitForLoadState();
  expect(await frame.evaluate(async () => {
    try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); stream.getTracks().forEach(track => track.stop()); return 'granted'; }
    catch (error) { return error instanceof Error?error.name:'UnknownError'; }
  })).toBe('NotAllowedError');
  const saved = { name: 'Perfil persistente', server: 'http://localhost:4310/?room=cafe', quality: '720' as const };
  await page.evaluate(value => {if(!window.desktop)throw new Error('Missing desktop bridge');return window.desktop.savePreferences(value);}, saved);
  expect(JSON.parse(readFileSync(preferencesPath, 'utf8'))).toEqual(saved);
  const before = await required(desktop).windows();
  const executable = await required(desktop).evaluate(({ app }) => app.getPath('exe'));
  const second = spawn(executable, args, { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = ''; second.stderr.on('data', bytes => { stderr += bytes; });
  const code = await new Promise((resolveExit, reject) => {
    const timer = setTimeout(() => { second.kill(); reject(new Error('Second host did not exit within 5s')); }, 5000);
    second.once('error', error => { clearTimeout(timer); reject(error); });
    second.once('exit', value => { clearTimeout(timer); resolveExit(value); });
  });
  expect(code).toBe(1); expect(stderr).toContain('ALREADY_RUNNING');
  expect((await required(desktop).windows()).length).toBe(before.length);
  const oldPort = Number(new URL(page.url()).port);
  const previous = desktop; desktop = undefined; await closeDesktop(previous);
  blocker = createServer();
  const reservation=blocker;await new Promise<void>((resolveListen, reject) => { reservation.once('error', reject); reservation.listen(oldPort, '127.0.0.1', resolveListen); });
  desktop = await launch(); observeNative(desktop); page = await required(desktop).firstWindow();
  await expect(page.getByLabel('Seu nome', { exact: true })).toHaveValue(saved.name);
  await expect(page.getByLabel('Servidor do grupo')).toHaveValue(saved.server);
  expect(Number(new URL(page.url()).port)).not.toBe(oldPort);
  expect(await page.evaluate(() => {if(!window.desktop)throw new Error('Missing desktop bridge');return window.desktop.preferences;})).toEqual(saved);
  await page.getByLabel('Servidor do grupo').fill('');
  const configuration=page.waitForRequest(request=>new URL(request.url()).pathname==='/api/config');
  await page.getByRole('button', { name: 'Entrar no Drocsid', exact: true }).click();
  expect(new URL((await configuration).url()).origin).toBe(new URL(page.url()).origin);
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await expect(page.getByLabel('Qualidade do compartilhamento')).toHaveValue('720');
  await expect(page.getByRole('checkbox', { name: /Incluir áudio do sistema/ })).not.toBeChecked();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Entrar na chamada', exact: true }).click();
  await required(desktop).evaluate(({ desktopCapturer }) => {
    globalThis.__originalSources = desktopCapturer.getSources;
    desktopCapturer.getSources = async () => { throw new Error('inventory test failure'); };
  });
  await page.getByRole('button', { name: 'Compartilhar tela', exact: true }).click();
  await expect(page.getByText('Não foi possível listar as fontes de tela.', { exact: true })).toBeVisible();
  await required(desktop).evaluate(({ desktopCapturer }) => {
    desktopCapturer.getSources = () => new Promise(resolveSources => { globalThis.__releaseInventory = resolveSources; });
  });
  await page.getByRole('button', { name: 'Compartilhar tela', exact: true }).click();
  await expect.poll(() => required(desktop).evaluate(() => typeof globalThis.__releaseInventory)).toBe('function');
  await page.reload();
  await required(desktop).evaluate(({ desktopCapturer }) => { globalThis.__releaseInventory([]); desktopCapturer.getSources = globalThis.__originalSources; });
  await page.getByRole('button', { name: 'Entrar no Drocsid', exact: true }).click();
  await page.getByRole('button', { name: 'Entrar na chamada', exact: true }).click();
  await page.getByRole('button', { name: 'Compartilhar tela', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'O que vamos compartilhar?' });
  await expect(picker).toBeVisible(); await page.keyboard.press('Escape'); await expect(picker).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Compartilhar tela', exact: true })).toBeEnabled();
  expect(nativeErrors).toEqual([]);
  console.log('PASS: profile survives a forced port change; camera/subframe denied; duplicate host exits 1; system audio starts off.');
} finally {
  try { await closeResources([() => closeDesktop(desktop), () => {const reservation=blocker;return reservation&&new Promise<void>((resolveClose, reject) => reservation.close(error => error ? reject(error) : resolveClose()));},()=>comparison?.close()]); }
  finally { try{await postgres?.close();}finally{removeTestProfile(profile);} }
}
