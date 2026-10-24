import { _electron as electron } from 'playwright';
import { expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createService } from '../server/service.js';

mkdirSync('artifacts', { recursive: true });
const errors = [];
const desktopEnv = { ...process.env };
delete desktopEnv.ELECTRON_RUN_AS_NODE;
const external = process.env.CONVERSA_TEST_EXTERNAL ? createService({ dbPath: ':memory:', iceServers: [] }) : null;
if (external) await new Promise(resolveListen => external.server.listen(0, '127.0.0.1', resolveListen));
const externalUrl = external ? `http://127.0.0.1:${external.server.address().port}` : '';
const desktop = await electron.launch({
  ...(process.env.CONVERSA_TEST_EXECUTABLE ? { executablePath: resolve(process.env.CONVERSA_TEST_EXECUTABLE) } : {}),
  args: [...(process.env.CONVERSA_TEST_EXECUTABLE ? [] : [resolve('.')]), `--user-data-dir=${resolve(tmpdir(), `conversa-smoke-${Date.now()}`)}`, '--use-fake-device-for-media-stream', '--mute-audio'],
  env: desktopEnv,
  timeout: 30000,
});
try {
  const first = await desktop.firstWindow();
  const firstNativeWindow = await desktop.browserWindow(first);
  const firstMuted = () => firstNativeWindow.evaluate(window => window.webContents.isAudioMuted());
  first.on('pageerror', error => errors.push(error.message));
  await expect(first.getByRole('heading', { name: 'Vamos nos encontrar?' })).toBeVisible();
  expect(await firstMuted()).toBe(true);
  await first.screenshot({ path: 'artifacts/01-entrada.png' });
  await first.getByLabel('Seu nome', { exact: true }).fill('Ana');
  if (external) await first.getByLabel('Servidor do grupo').fill(externalUrl);
  await first.getByRole('button', { name: 'Entrar no Conversa', exact: true }).click();
  await expect(first.getByRole('heading', { name: 'geral', exact: true })).toBeVisible();

  const secondWindow = desktop.waitForEvent('window');
  await desktop.evaluate(({ Menu }) => Menu.getApplicationMenu().items[0].submenu.items[0].click());
  const second = await secondWindow;
  second.on('pageerror', error => errors.push(error.message));
  await second.getByLabel('Seu nome', { exact: true }).fill('Bruno');
  if (external) await second.getByLabel('Servidor do grupo').fill(externalUrl);
  await second.getByRole('button', { name: 'Entrar no Conversa', exact: true }).click();
  await expect(second.getByText('2 online')).toBeVisible();
  await first.getByLabel('Mensagem', { exact: true }).fill('Olá, grupo! Vamos compartilhar as ideias?');
  await first.getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
  await expect(second.getByText('Olá, grupo! Vamos compartilhar as ideias?', { exact: true })).toBeVisible();

  for (const page of [first, second]) await page.evaluate(() => {
    window.__testConnections = [];
    const Original = window.RTCPeerConnection;
    window.RTCPeerConnection = class extends Original { constructor(...args) { super(...args); window.__testConnections.push(this); } };
  });
  await first.getByRole('button', { name: 'Entrar na chamada', exact: true }).click();
  await expect(first.getByText('VOCÊ ESTÁ NA CHAMADA', { exact: true })).toBeVisible();
  await expect.poll(firstMuted).toBe(false);
  await first.getByRole('button', { name: 'Silenciar áudio', exact: true }).click();
  await expect.poll(firstMuted).toBe(true);
  await first.getByRole('button', { name: 'Ativar áudio', exact: true }).click();
  await expect.poll(firstMuted).toBe(false);
  await second.getByRole('button', { name: 'Participar', exact: true }).click();
  await expect.poll(() => first.evaluate(() => window.__testConnections.some(pc => pc.connectionState === 'connected')), { timeout: 20000 }).toBe(true);
  for (const page of [first, second]) await expect.poll(() => page.evaluate(async () => {
    const stats = await Promise.all(window.__testConnections.map(pc => pc.getStats()));
    return stats.some(report => [...report.values()].some(s => s.type === 'inbound-rtp' && s.kind === 'audio' && s.bytesReceived > 0));
  }), { timeout: 15000 }).toBe(true);
  await first.getByRole('button', { name: 'Silenciar microfone', exact: true }).click();
  await expect(first.getByRole('button', { name: 'Ativar microfone', exact: true })).toBeVisible();
  await first.getByRole('button', { name: 'Ativar microfone', exact: true }).click();
  await first.screenshot({ path: 'artifacts/02-chamada-grupo.png' });

  await first.getByRole('button', { name: 'Compartilhar tela', exact: true }).click();
  const picker = first.getByRole('dialog', { name: 'O que vamos compartilhar?' });
  await expect(picker).toBeVisible({ timeout: 15000 });
  await picker.getByRole('button', { name: /Conversa/ }).first().click();
  await expect(second.getByText('Tela de Ana', { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(first.getByRole('button', { name: 'Parar compartilhamento', exact: true })).toBeInViewport();
  await expect(second.getByRole('button', { name: 'Encerrar chamada', exact: true })).toBeInViewport();
  await expect.poll(() => second.locator('video').evaluateAll(videos => videos.some(v => v.videoWidth > 0)), { timeout: 20000 }).toBe(true);
  await second.screenshot({ path: 'artifacts/03-tela-compartilhada.png' });
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
} finally { await desktop.close(); await external?.close(); }
