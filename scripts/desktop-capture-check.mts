import {required} from '../tests/helpers/assertions.js';
import { _electron as electron } from 'playwright';
import type {ElectronApplication,Page} from 'playwright';
import { expect } from '@playwright/test';
import { resolve } from 'node:path';
import { createTestProfile, removeTestProfile, closeDesktop, closeResources,testEnvironment } from './test-runtime.mjs';
import { createPostgresFixture } from '../tests/helpers/postgres.js';

const profile = createTestProfile(), env = testEnvironment(); delete env.ELECTRON_RUN_AS_NODE;
let desktop:ElectronApplication|undefined,postgres:Awaited<ReturnType<typeof createPostgresFixture>>|undefined;
try {
  postgres=await createPostgresFixture();env.DATABASE_URL=postgres.url;env.DROCSID_TRUSTED_LOCAL='1';env.DROCSID_HOST='1';
  desktop = await electron.launch({ args: [resolve('tests/fixtures/desktop-main.mjs'), `--user-data-dir=${profile}`, '--use-fake-device-for-media-stream', '--mute-audio'], env, timeout: 15000 });
  const first = await required(desktop).firstWindow();
  const openGuard = async () => {
    const next = required(desktop).waitForEvent('window');
    await required(desktop).evaluate(({ Menu }) => Menu.getApplicationMenu()?.items[0].submenu?.items[0].click());
    const page = await next;
    await expect(page.getByRole('heading', { name: 'Vamos nos encontrar?' })).toBeVisible(); return page;
  };
  const enterCall = async (page:Page) => {
    await page.getByLabel('Seu nome', { exact: true }).fill('Captura isolada');
    await page.getByRole('button', { name: 'Entrar no Drocsid', exact: true }).click();
    await page.getByRole('button', { name: 'Entrar na chamada', exact: true }).click();
  };
  const holdInventory = () => required(desktop).evaluate(({ desktopCapturer }) => {
    globalThis.__nativeInventory ||= desktopCapturer.getSources;
    desktopCapturer.getSources = () => new Promise(resolveSources => { globalThis.__releaseInventory = resolveSources; });
  });
  const snapshot = () => required(desktop).evaluate(() => globalThis.__captureProbe);
  const release = () => required(desktop).evaluate(async () => { globalThis.__releaseInventory([]); await new Promise(setImmediate); });
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
  await required(desktop).evaluate(({ desktopCapturer }) => { desktopCapturer.getSources = globalThis.__nativeInventory; });
  await survivor.evaluate(()=>{if(!window.desktop)throw new Error('Missing desktop bridge');window.desktop.onCaptureSources(value=>{window.__cancelSources=value;});});
  await survivor.getByRole('button', { name: 'Compartilhar tela', exact: true }).click();
  const picker = survivor.getByRole('dialog', { name: 'O que vamos compartilhar?' });
  await expect(picker).toBeVisible();const cancelledSources=await survivor.evaluate(()=>window.__cancelSources);
  await expect(picker).toBeVisible(); await survivor.keyboard.press('Escape'); await expect(picker).toHaveCount(0);
  await expect.poll(async () => (await snapshot()).requests[2].calls).toBe(1);
  await expect.poll(()=>required(desktop).evaluate(()=>globalThis.__captureDetails.outcomes.at(-1)?.requestId)).toBe(cancelledSources.requestId);
  expect(await required(desktop).evaluate(()=>globalThis.__captureDetails.outcomes.at(-1))).toEqual({outcome:'cancelled',code:'CANCELLED',phase:'capture-selection',requestId:cancelledSources.requestId});
  expect(await required(desktop).evaluate(()=>{const message=[...globalThis.__captureMessages].reverse().find(value=>value.channel==='capture-finish');if(!message)throw new Error('Missing capture finish');return message.value.key;})).toEqual(cancelledSources.key);
  await survivor.reload();
  expect(await snapshot()).toEqual({ requests: [
    { calls: 1, results: ['cancelled'], finished: true }, { calls: 1, results: ['cancelled'], finished: true },
    { calls: 1, results: ['cancelled'], finished: true },
  ], deliveries: 1 });
  // MEDIA-12/28: cancel before the native handler and retain the window guard
  // until the actual browser promise settles, even across Call owners.
  await enterCall(survivor);
  await required(desktop).evaluate(() => { globalThis.__holdNative = true; });
  await survivor.getByRole('button', { name: 'Compartilhar tela', exact: true }).click();
  await expect.poll(async () => (await snapshot()).requests.length).toBe(4);
  expect(await survivor.evaluate(() => {if(!window.desktop)throw new Error('Missing desktop bridge');return window.desktop.prepareCapture({callId:'other',generation:999,operationId:'other'});})).toMatchObject({ok:false,code:'INVALID_EVENT'});
  await survivor.getByRole('button', { name: 'Encerrar chamada', exact: true }).click();
  await survivor.getByRole('button', { name: 'Entrar na chamada', exact: true }).click();
  await survivor.getByRole('button', { name: 'Compartilhar tela', exact: true }).click();
  expect((await snapshot()).requests.length).toBe(4);
  await required(desktop).evaluate(() => { globalThis.__holdNative = false; globalThis.__releaseNative(); });
  await expect.poll(async () => (await snapshot()).requests[3].calls).toBe(1);
  await expect(survivor.getByRole('button', { name: 'Compartilhar tela', exact: true })).toBeEnabled();

  await holdInventory();
  await survivor.getByRole('button', { name: 'Compartilhar tela', exact: true }).click();
  await expect.poll(async () => (await snapshot()).requests.length).toBe(5);
  expect(await required(desktop).evaluate(async () => {
    let result;
    await globalThis.__nativeCapture(globalThis.__lastCaptureRequest, value => { result = value; });
    return result;
  })).toBe(null);
  expect((await snapshot()).requests[4].calls).toBe(0);
  await required(desktop).evaluate(() => globalThis.__advanceCapture(59999));
  expect((await snapshot()).requests[4].calls).toBe(0);
  await required(desktop).evaluate(() => globalThis.__advanceCapture(1));
  await expect.poll(async () => (await snapshot()).requests[4].calls).toBe(1);
  await expect(survivor.getByRole('button', { name: 'Compartilhar tela', exact: true })).toBeEnabled();
  expect(await required(desktop).evaluate(() => globalThis.__captureDetails.outcomes.at(-1))).toMatchObject({outcome:'failed',code:'TIMEOUT',phase:'capture-selection'});
  await release();

  // A key from another operation and an old document cannot settle this one.
  await required(desktop).evaluate(({ desktopCapturer }) => { desktopCapturer.getSources = globalThis.__nativeInventory; });
  await survivor.evaluate(() => {if(!window.desktop)throw new Error('Missing desktop bridge'); window.desktop.onCaptureSources(value => { window.__sources = value; }); });
  await survivor.getByRole('button', { name: 'Compartilhar tela', exact: true }).click();
  await expect(picker).toBeVisible();
  await survivor.evaluate(() => {if(!window.desktop)throw new Error('Missing desktop bridge');return window.desktop.selectCapture({...window.__sources.key,operationId:'foreign'},window.__sources.requestId,null);});
  expect((await snapshot()).requests[5].calls).toBe(0);
  await survivor.evaluate(() => {if(!window.desktop)throw new Error('Missing desktop bridge');return window.desktop.selectCapture(window.__sources.key,window.__sources.requestId,'not-an-inventoried-source');});
  await expect(survivor.getByRole('button', { name: 'Compartilhar tela', exact: true })).toBeEnabled();
  expect(await required(desktop).evaluate(() => globalThis.__captureDetails.outcomes.at(-1))).toMatchObject({outcome:'failed',code:'INVALID_EVENT',phase:'capture-selection'});
  await required(desktop).evaluate(() => { const message=[...globalThis.__captureMessages].reverse().find(value => value.channel === 'capture-prepare');if(!message)throw new Error('Missing capture prepare');globalThis.__oldDocumentMessage=message; });
  await survivor.reload(); await enterCall(survivor); await holdInventory();
  await survivor.getByRole('button', { name: 'Compartilhar tela', exact: true }).click();
  await expect.poll(async () => (await snapshot()).requests.length).toBe(7);
  const oldResults = await required(desktop).evaluate(() => {
    const old = globalThis.__oldDocumentMessage, results = [];
    for (const channel of ['capture-prepare','capture-cancel','capture-finish']) {
      let returned:unknown;const event=new Proxy(old.event,{set(_target,key,value:unknown){if(key==='returnValue'){returned=value;return true;}return false;}});
      globalThis.__captureIpc[channel](event,old.value);results.push(returned);
    }
    return results;
  });
  expect(oldResults).toEqual([{ok:false,code:'INVALID_EVENT',phase:'capture-prepare'},{ok:false},{outcome:'failed',code:'INVALID_EVENT',phase:'capture-finish',requestId:null}]);
  expect((await snapshot()).requests[6].calls).toBe(0);
  await survivor.getByRole('button', { name: 'Encerrar chamada', exact: true }).click();
  await expect.poll(async () => (await snapshot()).requests[6].calls).toBe(1);await release();
  expect(await required(desktop).evaluate(() => globalThis.__captureDetails.gestures)).toEqual(Array(7).fill(true));
  expect((await snapshot()).requests.every(request => request.calls === 1 && request.results[0] === 'cancelled')).toBe(true);
  expect(await survivor.evaluate(() => {if(!window.desktop)throw new Error('Missing desktop bridge');return Reflect.get(window.desktop,'documentToken');})).toBeUndefined();
  await survivor.getByRole('button', { name: 'Entrar na chamada', exact: true }).click();
  await required(desktop).evaluate(({ desktopCapturer }) => { desktopCapturer.getSources = async () => { throw Error('SECRET_SOURCE_TITLE'); }; });
  await survivor.getByRole('button', { name: 'Compartilhar tela', exact: true }).click();
  await expect(survivor.getByText('Não foi possível listar as fontes de tela.', { exact: true })).toBeVisible();
  expect(await required(desktop).evaluate(() => globalThis.__captureDetails.outcomes.at(-1))).toMatchObject({outcome:'failed',code:'MEDIA_FAILED',phase:'capture-inventory'});
  await required(desktop).evaluate(({ desktopCapturer }) => { desktopCapturer.getSources = globalThis.__nativeInventory; });
  const native = await required(desktop).browserWindow(survivor), sourceTitle = `Conversa capture fixture ${Date.now()}`;
  await native.evaluate((window, title) => window.setTitle(title),sourceTitle);
  for (const audio of [false,true]) {
    await survivor.getByRole('button', { name: 'Configurações', exact: true }).click();
    await expect(survivor.getByRole('dialog',{name:'Do seu jeito'}).getByText('No Windows, pode incluir o som de todos os aplicativos, inclusive da chamada.',{exact:true})).toBeVisible();
    await survivor.getByRole('checkbox', { name: /Incluir áudio do sistema/ }).setChecked(audio);
    await survivor.keyboard.press('Escape');
    await survivor.getByRole('button', { name: 'Compartilhar tela', exact: true }).click();
    await expect(picker).toBeVisible();
    if(audio)await expect(picker.getByText(/O áudio do sistema pode incluir todos os aplicativos, inclusive a própria chamada/)).toBeVisible();
    await picker.getByRole('button', { name: sourceTitle, exact: true }).click();
    await expect.poll(() => required(desktop).evaluate(() => globalThis.__captureDetails.grants.length)).toBe(audio ? 2 : 1);
    expect(await required(desktop).evaluate(() => globalThis.__captureDetails.grants.at(-1))).toEqual({audioRequested:audio,audio:audio?'loopback':null,video:true});
    await survivor.getByRole('button', { name: 'Encerrar chamada', exact: true }).click();
    if (!audio) await survivor.getByRole('button', { name: 'Entrar na chamada', exact: true }).click();
  }
  expect((await snapshot()).requests.every(request => request.calls === 1)).toBe(true);
  expect(await required(desktop).evaluate(() => globalThis.__captureDetails.gestures)).toEqual(Array(10).fill(true));
  console.log('PASS: reload/close during pending inventory and Escape each cancel exactly once; no late delivery or second callback after cleanup.');
  console.log('PASS: native gesture, guard across Call owners, cancellation before handler, duplicate handler, 60s boundary, invalid source/key and old-document IPC.');
} finally {
  try { await closeResources([() => closeDesktop(desktop)]); }
  finally { try{await postgres?.close();}finally{removeTestProfile(profile);} }
}
