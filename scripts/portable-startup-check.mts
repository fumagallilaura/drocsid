import { chromium } from 'playwright';
import type {Browser,Page} from 'playwright';
import { expect } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import type {ChildProcess} from 'node:child_process';
import { createServer } from 'node:net';
import { createTestProfile, removeTestProfile, closeResources,testEnvironment,readBuildManifest } from './test-runtime.mjs';
import {testPort} from '../tests/helpers/service.js';

const manifest = readBuildManifest();
const profile = createTestProfile(), reservation = createServer();
const env = testEnvironment(); delete env.ELECTRON_RUN_AS_NODE;
let processHandle:ChildProcess|undefined, browser:Browser|undefined, page:Page|undefined, launchError:Error|undefined;
try {
  await new Promise<void>((resolveListen, reject) => { reservation.once('error', reject); reservation.listen(0, '127.0.0.1', resolveListen); });
  const port = testPort(reservation);
  await new Promise<void>((resolveClose,reject) => reservation.close(error=>error?reject(error):resolveClose()));
  processHandle = spawn(manifest.portable, [`--user-data-dir=${profile}`, `--remote-debugging-port=${port}`], { env, windowsHide: true, stdio: 'ignore' });
  processHandle.once('error', error => { launchError = error; });
  let endpoint:string|undefined;
  const deadline = Date.now() + 20000;
  while (!endpoint && Date.now() < deadline) {
    if (launchError) throw launchError;
    try { const response = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(500) });const value:unknown=await response.json();if(value!==null&&typeof value==='object'&&'webSocketDebuggerUrl' in value&&typeof value.webSocketDebuggerUrl==='string')endpoint=value.webSocketDebuggerUrl; }
    catch { await new Promise(resolveWait => setTimeout(resolveWait, 100)); }
  }
  if (!endpoint) throw new Error('Portable did not expose its UI within 20s');
  browser = await chromium.connectOverCDP(endpoint, { timeout: 5000 });
  page = browser.contexts()[0].pages()[0];
  await expect(page.getByRole('heading', { name: 'Vamos nos encontrar?' })).toBeVisible();
  expect(await page.evaluate(() => {if(!window.desktop)throw new Error('Missing desktop bridge');return window.desktop.preferences;})).toEqual({ name: '', server: '', quality: '1080' });
  await page.getByLabel('Seu nome', { exact: true }).fill('Validação do portátil');
  await page.getByRole('button', { name: 'Entrar no Conversa', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'geral', exact: true })).toBeVisible();
  await page.getByLabel('Mensagem', { exact: true }).fill('Mensagem no portátil atual');
  await page.getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
  await expect(page.locator('.message p').filter({ hasText: 'Mensagem no portátil atual' })).toHaveCount(1);
  await expect(page.locator('audio,video')).toHaveCount(0);
  mkdirSync('test-results/desktop', { recursive: true });
  await page.screenshot({ path: 'test-results/desktop/portable-startup.png' });
  console.log(`PASS: actual portable ${manifest.version} opens its renderer, preload and local service; one committed message; no startup media.`);
} finally {
  try {
    await closeResources([
      async () => {
        try { await page?.close(); } finally { await browser?.close(); }
        const child=processHandle;if (child && child.exitCode === null && !launchError) await new Promise(resolveExit => child.once('exit', resolveExit));
      },
      () => reservation.listening && new Promise<void>((resolveClose,reject) => reservation.close(error=>error?reject(error):resolveClose())),
    ]);
  } finally {
    if (processHandle && processHandle.exitCode === null) processHandle.kill();
    removeTestProfile(profile);
  }
}
