import { _electron as electron } from 'playwright';
import { expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createService } from '../server/service.js';
import { readFlag, createTestProfile, removeTestProfile, closeDesktop, closeResources } from './test-runtime.mjs';

const output = resolve('test-results/desktop');
mkdirSync(output, { recursive: true });
async function instrument(page) {
  await page.evaluate(() => {
    window.__testConnections = [];
    window.__testCaptures = [];
    const Original = window.RTCPeerConnection;
    window.RTCPeerConnection = class extends Original { constructor(...args) { super(...args); window.__testConnections.push(this); } };
    const send = WebSocket.prototype.send;
    WebSocket.prototype.send = function (raw) {
      const event = JSON.parse(raw);
      if (event.type === 'join') window.__testSocket = this;
      if (event.type === 'call-join' && window.__rejectNextCall) {
        window.__rejectNextCall = false;
        queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ v: 1, type: 'error', code: 'RATE_LIMITED', phase: 'call-join', requestId: event.requestId, message: 'Admissão recusada no teste.' }) })));
        return;
      }
      if (event.type === 'message' && window.__rejectNextMessage) {
        window.__rejectNextMessage = false; window.__rejectedOperation = event.operationId;
        queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ v: 1, type: 'error', code: 'RATE_LIMITED', phase: 'message', requestId: event.requestId, message: 'Falha de envio simulada.' }) })));
        return;
      }
      if (event.type === 'message') window.__lastMessageOperation = event.operationId;
      return send.call(this, raw);
    };
    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async options => {
      const stream = await getUserMedia(options);
      window.__testCaptures.push(stream);
      if (window.__holdMicrophone) { window.__lateStream = stream; await new Promise(resolve => { window.__releaseMicrophone = resolve; }); }
      return stream;
    };
  });
}
const errors = [];
const desktopEnv = { ...process.env };
delete desktopEnv.ELECTRON_RUN_AS_NODE;
const externalMode = readFlag('CONVERSA_TEST_EXTERNAL');
const profile = createTestProfile();
let external, desktop;
try {
external = externalMode ? createService({ dbPath: ':memory:', iceServers: [] }) : null;
if (external) await new Promise(resolveListen => external.server.listen(0, '127.0.0.1', resolveListen));
const externalUrl = external ? `http://127.0.0.1:${external.server.address().port}` : '';
desktop = await electron.launch({
  ...(process.env.CONVERSA_TEST_EXECUTABLE ? { executablePath: resolve(process.env.CONVERSA_TEST_EXECUTABLE) } : {}),
  args: [...(process.env.CONVERSA_TEST_EXECUTABLE ? [] : [resolve('.')]), `--user-data-dir=${profile}`, '--use-fake-device-for-media-stream', '--mute-audio'],
  env: desktopEnv,
  timeout: 30000,
});
  const first = await desktop.firstWindow();
  const firstNativeWindow = await desktop.browserWindow(first);
  const captureTitle = `Conversa smoke ${Date.now()}`;
  const firstMuted = () => firstNativeWindow.evaluate(window => window.webContents.isAudioMuted());
  first.on('pageerror', error => errors.push(error.message));
  await expect(first.getByRole('heading', { name: 'Vamos nos encontrar?' })).toBeVisible();
  expect(await firstMuted()).toBe(true);
  await first.screenshot({ path: resolve(output, '01-entrada.png') });
  await instrument(first);
  await first.getByLabel('Seu nome', { exact: true }).fill('Ana');
  await first.getByLabel('Servidor do grupo').fill('file:///invalid');
  await first.getByRole('button', { name: 'Entrar no Conversa', exact: true }).click();
  await expect(first.getByText('Endereço ou sala inválidos.', { exact: true })).toBeVisible();
  await first.getByLabel('Servidor do grupo').fill('');
  if (external) await first.getByLabel('Servidor do grupo').fill(externalUrl);
  await first.getByRole('button', { name: 'Entrar no Conversa', exact: true }).click();
  await expect(first.getByRole('heading', { name: 'geral', exact: true })).toBeVisible();

  // STAB-57/58: real keyboard focus, not only ARIA attributes.
  const settings = first.getByRole('button', { name: 'Configurações', exact: true });
  await settings.click();
  const settingsDialog = first.getByRole('dialog', { name: 'Do seu jeito' });
  await expect(settingsDialog).toBeVisible();
  expect(await settingsDialog.evaluate(dialog => dialog.contains(document.activeElement))).toBe(true);
  expect(await first.locator('.app-shell').evaluate(element => element.inert)).toBe(true);
  await first.keyboard.press('Shift+Tab');
  expect(await settingsDialog.evaluate(dialog => dialog.contains(document.activeElement))).toBe(true);
  await first.keyboard.press('Shift+Tab');
  expect(await settingsDialog.evaluate(dialog => dialog.contains(document.activeElement))).toBe(true);
  await first.keyboard.press('Tab');
  expect(await settingsDialog.evaluate(dialog => dialog.contains(document.activeElement))).toBe(true);
  await first.keyboard.press('Escape'); await expect(settingsDialog).toHaveCount(0); await expect(settings).toBeFocused();
  expect(await first.locator('.app-shell').evaluate(element => element.inert)).toBe(false);

  const contrasts = await first.evaluate(() => {
    const rgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number);
    const light = color => rgb(color).map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index], 0);
    return ['.composer-footer', '.app-footer', '.space-header .eyebrow'].map(selector => {
      const element = document.querySelector(selector); let background = element;
      while (background.parentElement && ['rgba(0, 0, 0, 0)', 'transparent'].includes(getComputedStyle(background).backgroundColor)) background = background.parentElement;
      const a = light(getComputedStyle(element).color), b = light(getComputedStyle(background).backgroundColor);
      return { selector, ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
    });
  });
  for (const contrast of contrasts) expect(contrast.ratio, contrast.selector).toBeGreaterThanOrEqual(4.5);

  // STAB-17/20: drafts belong to the room throughout navigation.
  await first.getByLabel('Mensagem', { exact: true }).fill('Rascunho geral');
  await first.evaluate(() => {
    const socket = window.__testSocket, receive = socket.onmessage, delayed = [];
    let holding = false;
    socket.onmessage = event => {
      const data = JSON.parse(event.data);
      if (holding || (data.type === 'joined' && data.room.id === 'cafe')) { holding = true; delayed.push(event); }
      else receive(event);
    };
    window.__releaseRoom = () => { socket.onmessage = receive; delayed.forEach(event => receive(event)); };
  });
  await first.locator('.channels button').filter({ hasText: 'café' }).click();
  await expect(first.getByRole('heading', { name: 'geral', exact: true })).toBeVisible();
  await expect(first.getByLabel('Mensagem', { exact: true })).toBeDisabled();
  await expect(first.getByRole('button', { name: 'Enviar mensagem', exact: true })).toBeDisabled();
  await first.getByLabel('Mensagem', { exact: true }).evaluate(element => element.form.requestSubmit());
  await expect(first.getByLabel('Mensagem', { exact: true })).toHaveValue('Rascunho geral');
  await first.evaluate(() => window.__releaseRoom());
  await expect(first.getByRole('heading', { name: 'café', exact: true })).toBeVisible();
  await first.getByLabel('Mensagem', { exact: true }).fill('Rascunho café');
  await first.locator('.channels button').filter({ hasText: 'geral' }).click();
  await expect(first.getByLabel('Mensagem', { exact: true })).toHaveValue('Rascunho geral');

  // STAB-22/23: failed text remains visible and retry keeps its operation.
  await first.evaluate(() => { window.__rejectNextMessage = true; });
  await first.getByLabel('Mensagem', { exact: true }).fill('Não perder este texto');
  await first.getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
  await expect(first.getByText('Não perder este texto', { exact: true })).toBeVisible();
  await first.getByRole('button', { name: 'Reenviar mensagem', exact: true }).click();
  await expect(first.getByRole('button', { name: 'Reenviar mensagem', exact: true })).toHaveCount(0);
  expect(await first.evaluate(() => window.__lastMessageOperation === window.__rejectedOperation)).toBe(true);
  await expect(first.getByText('Não perder este texto', { exact: true })).toHaveCount(1);

  await first.evaluate(() => { window.__rejectNextCall = true; });
  await first.getByRole('button', { name: 'Entrar na chamada', exact: true }).click();
  await expect(first.getByText('Admissão recusada no teste.', { exact: true })).toBeVisible();
  await expect.poll(() => first.evaluate(() => window.__testCaptures.at(-1)?.getTracks().every(track => track.readyState === 'ended'))).toBe(true);
  expect(await firstMuted()).toBe(true);

  // STAB-03/08: cancel while an actual synthetic permission result is withheld.
  await first.evaluate(() => { window.__holdMicrophone = true; });
  await first.getByRole('button', { name: 'Entrar na chamada', exact: true }).click();
  await expect.poll(() => first.evaluate(() => !!window.__releaseMicrophone)).toBe(true);
  await first.getByRole('button', { name: 'Cancelar entrada', exact: true }).click();
  await first.evaluate(() => { window.__holdMicrophone = false; window.__releaseMicrophone(); });
  await expect.poll(() => first.evaluate(() => window.__lateStream.getTracks().every(track => track.readyState === 'ended'))).toBe(true);
  expect(await firstMuted()).toBe(true);

  const secondWindow = desktop.waitForEvent('window');
  await desktop.evaluate(({ Menu }) => Menu.getApplicationMenu().items[0].submenu.items[0].click());
  const second = await secondWindow;
  await instrument(second);
  second.on('pageerror', error => errors.push(error.message));
  await second.getByLabel('Seu nome', { exact: true }).fill('Bruno');
  if (external) await second.getByLabel('Servidor do grupo').fill(externalUrl);
  await second.getByRole('button', { name: 'Entrar no Conversa', exact: true }).click();
  await expect(second.getByText('2 online')).toBeVisible();
  await first.getByLabel('Mensagem', { exact: true }).fill('Olá, grupo! Vamos compartilhar as ideias?');
  await first.getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
  await expect(second.getByText('Olá, grupo! Vamos compartilhar as ideias?', { exact: true })).toBeVisible();

  await first.evaluate(() => {
    for (let i = 0; i < 45; i++) window.__testSocket.send(JSON.stringify({ v: 1, type: 'message', requestId: crypto.randomUUID(), operationId: crypto.randomUUID(), room: 'geral', text: `Histórico ${i}: ` + 'conteúdo de leitura '.repeat(12) }));
  });
  await expect(second.locator('.message p').last()).toContainText('Histórico 44:');
  expect(await second.locator('.messages').evaluate(element => element.scrollHeight - element.clientHeight)).toBeGreaterThan(100);
  await second.locator('.messages').evaluate(element => { element.scrollTop = 0; });
  await second.evaluate(() => new Promise(resolveFrame => requestAnimationFrame(resolveFrame)));
  await first.getByLabel('Mensagem', { exact: true }).fill('Mensagem nova durante leitura');
  await first.getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
  await expect(second.getByText('Mensagem nova durante leitura', { exact: true })).toHaveCount(1);
  expect(await second.locator('.messages').evaluate(element => element.scrollTop)).toBe(0);

  const observerPromise = desktop.waitForEvent('window');
  await desktop.evaluate(({ Menu }) => Menu.getApplicationMenu().items[0].submenu.items[0].click());
  const observer = await observerPromise;
  observer.on('pageerror', error => errors.push(error.message));
  await observer.getByLabel('Seu nome', { exact: true }).fill('Ana');
  if (external) await observer.getByLabel('Servidor do grupo').fill(externalUrl);
  await observer.getByRole('button', { name: 'Entrar no Conversa', exact: true }).click();
  await expect(observer.getByRole('heading', { name: 'geral', exact: true })).toBeVisible();
  await observer.getByLabel('Mensagem', { exact: true }).fill('Outra pessoa chamada Ana');
  await observer.getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
  const homonym = first.locator('.message').filter({ hasText: 'Outra pessoa chamada Ana' });
  await expect(homonym).not.toHaveClass(/grouped/);

  await first.getByRole('button', { name: 'Entrar na chamada', exact: true }).click();
  await expect(first.getByText('VOCÊ ESTÁ NA CHAMADA', { exact: true })).toBeVisible();
  await expect.poll(firstMuted).toBe(false);
  await first.getByRole('button', { name: 'Silenciar áudio', exact: true }).click();
  await expect.poll(firstMuted).toBe(true);
  await first.getByRole('button', { name: 'Ativar áudio', exact: true }).click();
  await expect.poll(firstMuted).toBe(false);
  await second.getByRole('button', { name: 'Participar', exact: true }).click();
  await expect.poll(() => first.evaluate(() => window.__testConnections.some(pc => pc.connectionState === 'connected')), { timeout: 20000 }).toBe(true);
  await first.evaluate(() => window.__testConnections.filter(pc => pc.connectionState === 'connected').forEach(pc => { pc.close(); pc.dispatchEvent(new Event('connectionstatechange')); }));
  await expect(first.getByText('Mídia indisponível', { exact: true })).toBeVisible();
  await first.getByRole('button', { name: 'Encerrar chamada', exact: true }).click();
  await first.getByRole('button', { name: 'Participar', exact: true }).click();
  await expect.poll(() => first.evaluate(() => window.__testConnections.some(pc => pc.connectionState === 'connected')), { timeout: 20000 }).toBe(true);
  for (const page of [first, second]) await expect.poll(() => page.evaluate(async () => {
    const stats = await Promise.all(window.__testConnections.filter(pc => pc.connectionState === 'connected').map(pc => pc.getStats()));
    return stats.some(report => [...report.values()].some(s => s.type === 'inbound-rtp' && s.kind === 'audio' && s.bytesReceived > 0));
  }), { timeout: 15000 }).toBe(true);
  await first.getByRole('button', { name: 'Silenciar microfone', exact: true }).click();
  await expect(first.getByRole('button', { name: 'Ativar microfone', exact: true })).toBeVisible();
  await first.getByRole('button', { name: 'Ativar microfone', exact: true }).click();
  await first.screenshot({ path: resolve(output, '02-chamada-grupo.png') });

  await firstNativeWindow.evaluate((window, title) => window.setTitle(title), captureTitle);
  await first.getByRole('button', { name: 'Compartilhar tela', exact: true }).click();
  const picker = first.getByRole('dialog', { name: 'O que vamos compartilhar?' });
  await expect(picker).toBeVisible({ timeout: 15000 });
  await picker.getByRole('button', { name: captureTitle, exact: true }).click();
  await expect(second.getByText('Tela de Ana', { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(observer.locator('video')).toHaveCount(0);
  await expect(observer.getByText('AO VIVO', { exact: true })).toHaveCount(0);
  await expect(observer.getByRole('button', { name: 'Participar', exact: true })).toBeVisible();
  await expect(first.getByRole('button', { name: 'Parar compartilhamento', exact: true })).toBeInViewport();
  await expect(second.getByRole('button', { name: 'Encerrar chamada', exact: true })).toBeInViewport();
  await expect.poll(() => second.locator('video').evaluateAll(videos => videos.some(v => v.videoWidth > 0)), { timeout: 20000 }).toBe(true);
  await settings.click();
  await first.getByLabel('Qualidade do compartilhamento').selectOption('720');
  await expect(first.getByText('A qualidade selecionada vale para a próxima captura.', { exact: true })).toBeVisible();
  await first.keyboard.press('Escape');
  await second.screenshot({ path: resolve(output, '03-tela-compartilhada.png') });
  if (external) {
    const thirdWindow = desktop.waitForEvent('window');
    await desktop.evaluate(({ Menu }) => Menu.getApplicationMenu().items[0].submenu.items[0].click());
    const third = await thirdWindow;
    third.on('pageerror', error => errors.push(error.message));
    await third.getByLabel('Seu nome', { exact: true }).fill('Carla');
    await third.getByLabel('Servidor do grupo').fill(externalUrl);
    await third.getByRole('button', { name: 'Entrar no Conversa', exact: true }).click();
    await third.getByRole('button', { name: 'Participar', exact: true }).click();
    await expect(third.getByText('3 pessoas na chamada', { exact: true })).toBeVisible();
    await expect.poll(() => third.locator('video').evaluateAll(videos => videos.some(v => v.videoWidth > 0)), { timeout: 20000 }).toBe(true);
    await third.getByRole('button', { name: 'Encerrar chamada', exact: true }).click();
    console.log('PASS: separate group server, cross-origin desktop connection and third participant joining an active screen share.');
  }
  await first.getByRole('button', { name: 'Parar compartilhamento', exact: true }).click();
  await expect(second.getByText('Tela de Ana', { exact: true })).toHaveCount(0);
  await first.getByRole('button', { name: 'Adicionar sala', exact: true }).click();
  await first.getByLabel('Nome da sala', { exact: true }).fill('Estúdio');
  await first.getByRole('button', { name: 'Criar sala', exact: true }).last().click();
  await expect(first.getByRole('heading', { name: 'Estúdio', exact: true })).toBeVisible();
  await expect.poll(firstMuted).toBe(true);
  await expect(second.getByText('1 pessoa na chamada', { exact: true })).toBeVisible();
  if (errors.length) throw new Error(`Renderer errors: ${errors.join('; ')}`);
  console.log('PASS: Windows desktop, two users, group chat, voice RTP, mute, screen video, stop capture, room creation and call cleanup.');
} finally {
  try { await closeResources([() => closeDesktop(desktop), () => external?.close()]); }
  finally { removeTestProfile(profile); }
}
