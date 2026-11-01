import { chromium } from 'playwright';
import type {Browser,Page} from 'playwright';
import { expect } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import type {ChildProcess} from 'node:child_process';
import { createServer } from 'node:net';
import { createTestProfile, removeTestProfile, closeResources,testEnvironment,readBuildManifest } from './test-runtime.mjs';
import {testPort} from '../tests/helpers/service.js';
import assert from 'node:assert/strict';
import {createPostgresFixture} from '../tests/helpers/postgres.js';
import {createService} from '../server/service.js';

const manifest = readBuildManifest();
const profile = createTestProfile(), reservation = createServer();
const env = testEnvironment(); delete env.ELECTRON_RUN_AS_NODE;
for(const name of Object.keys(env))if(name.includes('DATABASE_URL')||name.startsWith('PG')||name.startsWith('DROCSID_'))delete env[name];
let processHandle:ChildProcess|undefined, browser:Browser|undefined, page:Page|undefined, launchError:Error|undefined;
let postgres:Awaited<ReturnType<typeof createPostgresFixture>>|undefined,service:Awaited<ReturnType<typeof createService>>|undefined;
try {
  postgres=await createPostgresFixture();service=await createService({database:await postgres.open(),trustedLocal:false,iceServers:[]});
  await new Promise<void>(resolveListen=>service?.server.listen(0,'127.0.0.1',resolveListen));
  const origin=`http://127.0.0.1:${testPort(service.server)}`;
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
  assert.ok(page,'Portable has no renderer');
  await expect(page.getByRole('heading', { name: 'Vamos nos encontrar?' })).toBeVisible();
  await expect(page).toHaveTitle('Drocsid');
  expect(await page.evaluate(() => {if(!window.desktop)throw new Error('Missing desktop bridge');return window.desktop.preferences;})).toEqual({ name: '', server: '', quality: '1080' });
  await page.getByLabel('Servidor do grupo').fill(origin);await page.getByRole('button',{name:'Criar uma conta',exact:true}).click();
  await page.getByLabel('Usuário',{exact:true}).fill('portatil');await page.getByLabel('Senha',{exact:true}).fill('senha temporaria do portatil');await page.getByRole('button',{name:'Criar conta',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Crie ou entre em um grupo'})).toBeVisible();
  await page.getByRole('button',{name:'Criar grupo',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Um grupo para conversar'});
  await dialog.getByLabel('Nome do grupo').fill('Grupo do portátil');await dialog.getByRole('button',{name:'Criar grupo',exact:true}).click();await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Grupo do portátil',exact:true})).toBeVisible();
  await expect(page.getByRole('heading', { name: 'geral', exact: true })).toBeVisible();
  await page.getByLabel('Mensagem', { exact: true }).fill('Mensagem no portátil atual');
  await page.getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
  await expect(page.locator('.message p').filter({ hasText: 'Mensagem no portátil atual' })).toHaveCount(1);
  const saved=await service.database.query('SELECT author,text FROM drocsid.messages');assert.deepEqual(saved.map(row=>({author:row.author,text:row.text})),[{author:'portatil',text:'Mensagem no portátil atual'}]);
  await expect(page.locator('audio,video')).toHaveCount(0);
  mkdirSync('test-results/desktop', { recursive: true });
  await page.screenshot({ path: 'test-results/desktop/portable-startup.png' });
  console.log(`PASS: actual Drocsid portable ${manifest.version} authenticates, creates a private group and commits one message through its controls; no startup media.`);
} finally {
  try {
    await closeResources([
      async () => {
        try { await page?.close(); } finally { await browser?.close(); }
        const child=processHandle;if (child && child.exitCode === null && !launchError) await new Promise(resolveExit => child.once('exit', resolveExit));
      },
      () => reservation.listening && new Promise<void>((resolveClose,reject) => reservation.close(error=>error?reject(error):resolveClose())),
      () => service?.close(),
    ]);
  } finally {
    if (processHandle && processHandle.exitCode === null) processHandle.kill();
    try{await postgres?.close();}finally{removeTestProfile(profile);}
  }
}
