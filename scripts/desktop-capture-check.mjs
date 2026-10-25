import { _electron as electron } from 'playwright';
import { expect } from '@playwright/test';
import { resolve } from 'node:path';
import { createTestProfile, removeTestProfile, closeDesktop, closeResources } from './test-runtime.mjs';

const profile = createTestProfile(), env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
let desktop;
try {
  desktop = await electron.launch({ args: [resolve('tests/fixtures/desktop-main.mjs'), `--user-data-dir=${profile}`, '--use-fake-device-for-media-stream', '--mute-audio'], env, timeout: 15000 });
  const first = await desktop.firstWindow();
  const openGuard = async () => {
    const next = desktop.waitForEvent('window');
    await desktop.evaluate(({ Menu }) => Menu.getApplicationMenu().items[0].submenu.items[0].click());
    const page = await next;
    await expect(page.getByRole('heading', { name: 'Vamos nos encontrar?' })).toBeVisible(); return page;
  };
  const enterCall = async page => {
    await page.getByLabel('Seu nome', { exact: true }).fill('Captura isolada');
    await page.getByRole('button', { name: 'Entrar no Conversa', exact: true }).click();
    await page.getByRole('button', { name: 'Entrar na chamada', exact: true }).click();
  };
  const holdInventory = () => desktop.evaluate(({ desktopCapturer }) => {
    globalThis.__nativeInventory ||= desktopCapturer.getSources;
    desktopCapturer.getSources = () => new Promise(resolveSources => { globalThis.__releaseInventory = resolveSources; });
  });
  const snapshot = () => desktop.evaluate(() => globalThis.__captureProbe);
  const release = () => desktop.evaluate(async () => { globalThis.__releaseInventory([]); await new Promise(setImmediate); });
  const guard = await openGuard();

  await enterCall(first); await holdInventory();
  await first.getByRole('button', { name: 'Compartilhar tela', exact: true }).click();
  await expect.poll(async () => (await snapshot()).requests.length).toBe(1);
  expect((await snapshot()).requests[0]).toEqual({ calls: 0, results: [], finished: false });
  await first.reload();
  await expect.poll(async () => (await snapshot()).requests[0].calls).toBe(1);
  await release();
  await expect.poll(async () => (await snapshot()).requests[0].finished).toBe(true);
  await first.close();
  expect(await snapshot()).toEqual({ requests: [{ calls: 1, results: ['cancelled'], finished: true }], deliveries: 0 });

  await enterCall(guard); await holdInventory();
  const survivor = await openGuard();
  await guard.getByRole('button', { name: 'Compartilhar tela', exact: true }).click();
  await expect.poll(async () => (await snapshot()).requests.length).toBe(2);
  await guard.close();
  await expect.poll(async () => (await snapshot()).requests[1].calls).toBe(1);
  await release();
  await expect.poll(async () => (await snapshot()).requests[1].finished).toBe(true);
  expect(await snapshot()).toEqual({ requests: [
    { calls: 1, results: ['cancelled'], finished: true }, { calls: 1, results: ['cancelled'], finished: true },
  ], deliveries: 0 });
  await expect(survivor.getByRole('heading', { name: 'Vamos nos encontrar?' })).toBeVisible();
  await enterCall(survivor);
  await desktop.evaluate(({ desktopCapturer }) => { desktopCapturer.getSources = globalThis.__nativeInventory; });
  await survivor.getByRole('button', { name: 'Compartilhar tela', exact: true }).click();
  const picker = survivor.getByRole('dialog', { name: 'O que vamos compartilhar?' });
  await expect(picker).toBeVisible(); await survivor.keyboard.press('Escape'); await expect(picker).toHaveCount(0);
  await expect.poll(async () => (await snapshot()).requests[2].calls).toBe(1);
  await survivor.reload();
  expect(await snapshot()).toEqual({ requests: [
    { calls: 1, results: ['cancelled'], finished: true }, { calls: 1, results: ['cancelled'], finished: true },
    { calls: 1, results: ['cancelled'], finished: true },
  ], deliveries: 1 });
  console.log('PASS: reload/close during pending inventory and Escape each cancel exactly once; no late delivery or second callback after cleanup.');
} finally {
  try { await closeResources([() => closeDesktop(desktop)]); }
  finally { removeTestProfile(profile); }
}
