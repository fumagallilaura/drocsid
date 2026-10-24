import { _electron as electron } from 'playwright';
import { expect } from '@playwright/test';
import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createService } from '../server/service.js';

const results = [], errors = [];
const root = resolve(import.meta.dirname, '..');
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
const dataDirectory = resolve(tmpdir(), `conversa-review-ui-${Date.now()}`);
const backend = createService({ dbPath: ':memory:', iceServers: [] });
await new Promise(resolveListen => backend.server.listen(0, '127.0.0.1', resolveListen));
const backendPort = backend.server.address().port;
const seenMessages = [];
let mode = 'normal', delayedRoom = false;
const proxy = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ iceServers: [], maxCallMembers: 6 }));
});
const wss = new WebSocketServer({ server: proxy });
wss.on('connection', downstream => {
  if (mode === 'no-hello') return;
  const upstream = new WebSocket(`ws://127.0.0.1:${backendPort}/ws`);
  const pending = [];
  downstream.on('message', raw => {
    const event = JSON.parse(raw);
    if (event.type === 'call-join' && mode === 'reject-call') {
      downstream.send(JSON.stringify({ type: 'error', message: 'Muitas ações. Aguarde alguns segundos.' })); return;
    }
    if (event.type === 'message') {
      seenMessages.push({ ...event, sentDuringDelayedJoin: delayedRoom });
      if (mode === 'reject-message') { downstream.send(JSON.stringify({ type: 'error', message: 'Muitas ações. Aguarde alguns segundos.' })); return; }
    }
    if (upstream.readyState === WebSocket.OPEN) upstream.send(raw.toString()); else pending.push(raw.toString());
  });
  upstream.on('open', () => { for (const event of pending) upstream.send(event); });
  upstream.on('message', raw => {
    const event = JSON.parse(raw);
    if (mode === 'delay-join' && event.type === 'joined' && event.room.id === 'projetos') {
      delayedRoom = true;
      setTimeout(() => { delayedRoom = false; if (downstream.readyState === WebSocket.OPEN) downstream.send(raw.toString()); }, 800);
    } else if (downstream.readyState === WebSocket.OPEN) downstream.send(raw.toString());
  });
  upstream.on('error', () => {});
  downstream.on('error', () => {});
  downstream.on('close', () => upstream.close());
});
await new Promise(resolveListen => proxy.listen(0, '127.0.0.1', resolveListen));
const proxyUrl = `http://127.0.0.1:${proxy.address().port}`;
let desktop;
async function launch() {
  return electron.launch({ args: [root, `--user-data-dir=${dataDirectory}`, '--mute-audio', '--use-fake-device-for-media-stream'], env, timeout: 20000 });
}
async function freshWindow(app) {
  const waiting = app.waitForEvent('window');
  await app.evaluate(({ Menu }) => Menu.getApplicationMenu().items[0].submenu.items[0].click());
  const page = await waiting;
  page.on('pageerror', error => errors.push(error.message));
  return page;
}
async function login(page, address = proxyUrl) {
  await page.getByLabel('Seu nome', { exact: true }).fill('Review Guest');
  await page.getByLabel('Servidor do grupo').fill(address);
  await page.getByRole('button', { name: 'Entrar no Conversa', exact: true }).click();
}
try {
  desktop = await launch();
  const page = await desktop.firstWindow();
  page.on('pageerror', error => errors.push(error.message));
  await login(page);
  await expect(page.getByRole('heading', { name: 'geral', exact: true })).toBeVisible();
  mode = 'delay-join';
  await page.getByRole('button', { name: 'projetos', exact: true }).click();
  await expect.poll(() => delayedRoom).toBe(true);
  const headingBeforeSend = await page.locator('h1').innerText();
  expect(headingBeforeSend).toBe('geral');
  await page.getByLabel('Mensagem', { exact: true }).fill('message-with-old-room-visible');
  await page.getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'projetos', exact: true })).toBeVisible();
  // Re-enter to fetch authoritative persisted history.
  mode = 'normal';
  await page.getByRole('button', { name: 'geral', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'geral', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'projetos', exact: true }).click();
  await expect(page.getByText('message-with-old-room-visible', { exact: true })).toBeVisible();
  results.push({ id: 'UI-01', confirmed: true, observation: 'Sending before join confirmation persists the message in the new room although the old room was still displayed.', displayedRoomAtSend: headingBeforeSend, persistedRoom: 'projetos', sentDuringDelayedJoin: seenMessages[0].sentDuringDelayedJoin });

  mode = 'reject-message';
  await page.getByLabel('Mensagem', { exact: true }).fill('draft-that-will-be-rejected');
  await page.getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Muitas ações');
  const draftAfterRejection = await page.getByLabel('Mensagem', { exact: true }).inputValue();
  expect(draftAfterRejection).toBe('');
  results.push({ id: 'UI-02', confirmed: true, observation: 'A server rejection discards the draft with no pending message or retry.', draftAfterRejection });

  mode = 'normal';
  const invitePage = await freshWindow(desktop);
  await login(invitePage, `${proxyUrl}/?room=cafe`);
  await expect(invitePage.getByRole('heading', { name: 'geral', exact: true })).toBeVisible();
  results.push({ id: 'UI-03', confirmed: true, observation: 'Pasting an invite URL into the server field discards its room parameter.', requestedRoom: 'cafe', actualRoom: await invitePage.locator('h1').innerText() });

  await page.getByRole('button', { name: 'Adicionar sala', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Um novo lugar para conversar' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  const escapeKeptDialogOpen = await dialog.isVisible();
  await page.getByLabel('Nome da sala', { exact: true }).focus();
  await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Shift+Tab');
  const focusEscaped = await page.evaluate(() => !document.activeElement.closest('[role="dialog"]'));
  expect(escapeKeptDialogOpen).toBe(true); expect(focusEscaped).toBe(true);
  await dialog.getByRole('button', { name: 'Fechar', exact: true }).click();
  results.push({ id: 'UI-06', confirmed: true, observation: 'The modal does not close on Escape and keyboard focus escapes into the background.', escapeKeptDialogOpen, focusEscaped });

  mode = 'reject-call';
  await page.evaluate(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    window.__reviewMicrophoneTracks = [];
    navigator.mediaDevices.getUserMedia = async (...args) => {
      const stream = await original(...args); window.__reviewMicrophoneTracks.push(...stream.getTracks()); return stream;
    };
  });
  await page.getByRole('button', { name: 'Entrar na chamada', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Muitas ações');
  await expect(page.getByRole('button', { name: 'Entrar na chamada', exact: true })).toBeEnabled();
  const microphoneStates = await page.evaluate(() => window.__reviewMicrophoneTracks.map(t => t.readyState));
  expect(microphoneStates).toEqual(['live']);
  expect(await page.getByRole('button', { name: 'Encerrar chamada', exact: true }).count()).toBe(0);
  results.push({ id: 'UI-07', confirmed: true, observation: 'A rejected call-join leaves a live synthetic microphone but the UI shows no active call or leave control.', microphoneStates, hangupControls: 0 });

  const originBefore = new URL(page.url()).origin;
  await page.evaluate(() => localStorage.setItem('conversa.name', 'Review Saved Name'));
  await desktop.close(); desktop = await launch();
  const restarted = await desktop.firstWindow();
  const originAfter = new URL(restarted.url()).origin;
  await expect(restarted.getByLabel('Seu nome', { exact: true })).toBeVisible();
  const savedNameAfterRestart = await restarted.getByLabel('Seu nome', { exact: true }).inputValue();
  expect(originBefore).not.toBe(originAfter); expect(savedNameAfterRestart).toBe('');
  results.push({ id: 'UI-04', confirmed: true, observation: 'Preferences saved in localStorage disappear on restart because the local origin uses a new random port.', originBefore, originAfter, savedNameAfterRestart });

  mode = 'no-hello';
  await login(restarted);
  await restarted.waitForTimeout(8500);
  await expect(restarted.getByRole('button', { name: 'Conectando…', exact: true })).toBeDisabled();
  results.push({ id: 'UI-05', confirmed: true, observation: 'A server that accepts WebSocket but sends no hello leaves the entry form connecting forever beyond the configured timeout.', observedAfterMs: 8500 });
} finally {
  await desktop?.close();
  for (const ws of wss.clients) ws.terminate();
  await new Promise(resolveClose => wss.close(resolveClose));
  await new Promise(resolveClose => proxy.close(resolveClose));
  await backend.close();
  mkdirSync(resolve(root, 'review'), { recursive: true });
  writeFileSync(resolve(root, 'review/ui-probes.json'), JSON.stringify({ results, rendererErrors: errors }, null, 2));
}
console.log(JSON.stringify({ results, rendererErrors: errors }, null, 2));
