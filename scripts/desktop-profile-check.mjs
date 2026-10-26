import { _electron as electron } from 'playwright';
import { expect } from '@playwright/test';
import { writeFileSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { createTestProfile, removeTestProfile, closeDesktop, closeResources } from './test-runtime.mjs';
import { startServer } from '../server/index.js';

const profile = createTestProfile();
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
const iceServers=[{urls:'stun:127.0.0.1:3478'}];env.ICE_SERVERS=JSON.stringify(iceServers);
const executablePath = process.env.CONVERSA_TEST_EXECUTABLE;
const args = [...(executablePath ? [] : [resolve('.')]), `--user-data-dir=${profile}`, '--use-fake-device-for-media-stream', '--mute-audio'];
const launch = () => electron.launch({ ...(executablePath ? { executablePath } : {}), args, env, timeout: 15000 });
const preferencesPath = join(profile, 'preferences.json');
let desktop, blocker, comparison;
const nativeErrors = [];
function observeNative(application) {
  application.process().stderr.on('data', bytes => { const text = bytes.toString(); if (/UnhandledPromiseRejection|uncaughtException/.test(text)) nativeErrors.push(text); });
}
try {
  writeFileSync(preferencesPath, '{invalid preferences');
  comparison=await startServer({production:true,env:{DB_PATH:':memory:',HOST:'127.0.0.1',PORT:'0',ICE_SERVERS:env.ICE_SERVERS}});
  desktop = await launch();
  observeNative(desktop);
  let page = await desktop.firstWindow();
  await expect(page.getByRole('heading', { name: 'Vamos nos encontrar?' })).toBeVisible();
  const standalone=await(await fetch(`http://127.0.0.1:${comparison.server.address().port}/api/config`)).json();
  const embedded=await page.evaluate(async()=>await(await fetch('/api/config')).json());
  expect(standalone.iceServers).toEqual(iceServers);expect(embedded.iceServers).toEqual(iceServers);expect(embedded.iceServers).toEqual(standalone.iceServers);
  expect(await page.evaluate(() => window.desktop.preferences)).toEqual({ name: '', server: '', quality: '1080' });
  expect(readFileSync(preferencesPath, 'utf8')).toBe('{invalid preferences');
  expect(await page.evaluate(async () => {
    try { const stream = await navigator.mediaDevices.getUserMedia({ video: true }); stream.getTracks().forEach(track => track.stop()); return 'granted'; }
    catch (error) { return error.name; }
  })).toBe('NotAllowedError');
  await page.evaluate(() => { const frame = document.createElement('iframe'); frame.src = '/'; document.body.append(frame); });
  await expect.poll(() => page.frames().filter(frame => frame.parentFrame()).length).toBe(1);
  const frame = page.frames().find(frame => frame.parentFrame());
  await frame.waitForLoadState();
  expect(await frame.evaluate(async () => {
    try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); stream.getTracks().forEach(track => track.stop()); return 'granted'; }
    catch (error) { return error.name; }
  })).toBe('NotAllowedError');
  const saved = { name: 'Perfil persistente', server: 'http://localhost:4310/?room=cafe', quality: '720' };
  await page.evaluate(value => window.desktop.savePreferences(value), saved);
  expect(JSON.parse(readFileSync(preferencesPath, 'utf8'))).toEqual(saved);
  const before = await desktop.windows();
  const executable = await desktop.evaluate(({ app }) => app.getPath('exe'));
  const second = spawn(executable, args, { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = ''; second.stderr.on('data', bytes => { stderr += bytes; });
  const code = await new Promise((resolveExit, reject) => {
    const timer = setTimeout(() => { second.kill(); reject(new Error('Second host did not exit within 5s')); }, 5000);
    second.once('error', error => { clearTimeout(timer); reject(error); });
    second.once('exit', value => { clearTimeout(timer); resolveExit(value); });
  });
  expect(code).toBe(1); expect(stderr).toContain('ALREADY_RUNNING');
  expect((await desktop.windows()).length).toBe(before.length);
  const oldPort = Number(new URL(page.url()).port);
  const previous = desktop; desktop = null; await closeDesktop(previous);
  blocker = createServer();
  await new Promise((resolveListen, reject) => { blocker.once('error', reject); blocker.listen(oldPort, '127.0.0.1', resolveListen); });
  desktop = await launch(); observeNative(desktop); page = await desktop.firstWindow();
  await expect(page.getByLabel('Seu nome', { exact: true })).toHaveValue(saved.name);
  await expect(page.getByLabel('Servidor do grupo')).toHaveValue(saved.server);
  expect(Number(new URL(page.url()).port)).not.toBe(oldPort);
  expect(await page.evaluate(() => window.desktop.preferences)).toEqual(saved);
  await page.getByLabel('Servidor do grupo').fill('');
  await page.getByRole('button', { name: 'Entrar no Conversa', exact: true }).click();
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await expect(page.getByLabel('Qualidade do compartilhamento')).toHaveValue('720');
  await expect(page.getByRole('checkbox', { name: /Incluir áudio do sistema/ })).not.toBeChecked();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Entrar na chamada', exact: true }).click();
  await desktop.evaluate(({ desktopCapturer }) => {
    globalThis.__originalSources = desktopCapturer.getSources;
    desktopCapturer.getSources = async () => { throw new Error('inventory test failure'); };
  });
  await page.getByRole('button', { name: 'Compartilhar tela', exact: true }).click();
  await expect(page.getByText('Não foi possível listar as fontes de tela.', { exact: true })).toBeVisible();
  await desktop.evaluate(({ desktopCapturer }) => {
    desktopCapturer.getSources = () => new Promise(resolveSources => { globalThis.__releaseInventory = resolveSources; });
  });
  await page.getByRole('button', { name: 'Compartilhar tela', exact: true }).click();
  await expect.poll(() => desktop.evaluate(() => typeof globalThis.__releaseInventory)).toBe('function');
  await page.reload();
  await desktop.evaluate(({ desktopCapturer }) => { globalThis.__releaseInventory([]); desktopCapturer.getSources = globalThis.__originalSources; });
  await page.getByRole('button', { name: 'Entrar no Conversa', exact: true }).click();
  await page.getByRole('button', { name: 'Entrar na chamada', exact: true }).click();
  await page.getByRole('button', { name: 'Compartilhar tela', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'O que vamos compartilhar?' });
  await expect(picker).toBeVisible(); await page.keyboard.press('Escape'); await expect(picker).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Compartilhar tela', exact: true })).toBeEnabled();
  expect(nativeErrors).toEqual([]);
  console.log('PASS: profile survives a forced port change; camera/subframe denied; duplicate host exits 1; system audio starts off.');
} finally {
  try { await closeResources([() => closeDesktop(desktop), () => blocker && new Promise((resolveClose, reject) => blocker.close(error => error ? reject(error) : resolveClose())),()=>comparison?.close()]); }
  finally { removeTestProfile(profile); }
}
