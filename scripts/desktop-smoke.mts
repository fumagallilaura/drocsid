import {required} from '../tests/helpers/assertions.js';
import { _electron as electron } from 'playwright';
import type {ElectronApplication,Page} from 'playwright';
import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createService } from '../server/service.js';
import { createPostgresFixture } from '../tests/helpers/postgres.js';
import { PROTOCOL_VERSION } from '../shared/protocol.js';
import { readFlag, createTestProfile, removeTestProfile, closeDesktop, closeResources,testEnvironment } from './test-runtime.mjs';
import {testPort} from '../tests/helpers/service.js';

const output = resolve('test-results/desktop');
mkdirSync(output, { recursive: true });
async function instrument(page:Page) {
  await page.evaluate(protocolVersion => {
    window.__testConnections = [];
    window.__testCaptures = [];
    window.__testDisplays = [];
    window.__testCallEvents = [];
    const play=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(...args){
      if(window.__rejectNextPlayback){
        window.__rejectNextPlayback=false;
        const error=Object.assign(Error('STAB_PRIVATE_MESSAGE'),{name:'STAB_PRIVATE_NAME',sdp:'STAB_PRIVATE_SDP',credential:'STAB_PRIVATE_SECRET'});
        return Promise.reject(error);
      }
      return play.apply(this,args);
    };
    const Original = window.RTCPeerConnection;
    window.RTCPeerConnection = class extends Original { constructor(...args:ConstructorParameters<typeof Original>) { super(...args); window.__testConnections.push(this); } };
    const send = WebSocket.prototype.send;
    WebSocket.prototype.send = function (raw) {
      if(typeof raw!=='string')throw new Error('Expected a JSON socket frame');const value:unknown=JSON.parse(raw);
      if(value===null||typeof value!=='object'||!('type' in value)||typeof value.type!=='string')throw new Error('Invalid test socket frame');
      const event=value;
      if(!('requestId' in event)||typeof event.requestId!=='string')throw new Error('Missing request ID');
      if(event.type==='message'&&(!('operationId' in event)||typeof event.operationId!=='string'))throw new Error('Missing operation ID');
      if (event.type==='call-join'||event.type==='call-leave') {
        if(!('callId' in event)||typeof event.callId!=='string'||!('generation' in event)||typeof event.generation!=='number')throw new Error('Missing call context');
        window.__testCallEvents.push({type:event.type,requestId:event.requestId,callId:event.callId,generation:event.generation});
      }
      if (event.type === 'join') {window.__testSocket = this;window.__testRoomContext=event.requestId;}
      if (event.type === 'call-join' && window.__rejectNextCall) {
        window.__rejectNextCall = false;
        queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ v: protocolVersion, type: 'error', code: 'RATE_LIMITED', phase: 'call-join', requestId: event.requestId, message: 'Admissão recusada no teste.' }) })));
        return;
      }
      if (event.type === 'message' && window.__rejectNextMessage) {
        window.__rejectNextMessage = false;if(!('operationId' in event)||typeof event.operationId!=='string')throw new Error('Missing operation ID');window.__rejectedOperation = event.operationId;
        queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ v: protocolVersion, type: 'error', code: 'RATE_LIMITED', phase: 'message', requestId: event.requestId, message: 'Falha de envio simulada.' }) })));
        return;
      }
      if (event.type === 'message'){if(!('operationId' in event)||typeof event.operationId!=='string')throw new Error('Missing operation ID');window.__lastMessageOperation = event.operationId;}
      return send.call(this, raw);
    };
    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async options => {
      const stream = await getUserMedia(options);
      for (const track of stream.getTracks()) {
        const stop = track.stop.bind(track);
        track.stop = () => { stop(); window.__lastStopAt=performance.now();console.info('CONVERSA_TEST_STOP ' + JSON.stringify({id:track.id,state:track.readyState})); };
      }
      window.__testCaptures.push(stream);
      if (window.__holdMicrophone) { window.__lateStream = stream; await new Promise<void>(resolve => { window.__releaseMicrophone = ()=>{window.__micReleasedAt=performance.now();resolve();}; }); }
      return stream;
    };
    const getDisplayMedia = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getDisplayMedia = async options => { const stream = await getDisplayMedia(options); window.__testDisplays.push(stream); return stream; };
  }, PROTOCOL_VERSION);
}
async function cancelEntryByKeyboard(page:Page){
  await page.evaluate(()=>{
    const button=[...document.querySelectorAll('button')].find(value=>value.textContent==='Cancelar entrada');
    if(!button)throw new Error('Missing cancel entry control');window.__cancelTiming={started:null,terminalAt:null};
    button.addEventListener('click',()=>{window.__cancelTiming.started=performance.now();},{once:true,capture:true});
    const observer=new MutationObserver(()=>{
      if(!button.isConnected){window.__cancelTiming.terminalAt=performance.now();observer.disconnect();}
    });observer.observe(document.body,{childList:true,subtree:true});
  });
  await page.getByRole('button',{name:'Cancelar entrada',exact:true}).focus();await page.keyboard.press('Enter');
  await expect(page.getByRole('button',{name:'Cancelar entrada',exact:true})).toHaveCount(0,{timeout:1000});
  const timing=await page.evaluate(()=>window.__cancelTiming);
  assert.ok(timing.started!==null&&timing.terminalAt!==null);expect(timing.started).toEqual(expect.any(Number));expect(timing.terminalAt).toEqual(expect.any(Number));expect(timing.terminalAt-timing.started).toBeLessThanOrEqual(1000);
}
const errors:string[] = [];
const diagnostics:Record<string,unknown>[] = [], stops:{id:string;state:string}[] = []; let nativeDiagnostics = '';
const desktopEnv = testEnvironment();
delete desktopEnv.ELECTRON_RUN_AS_NODE;
const externalMode = readFlag('CONVERSA_TEST_EXTERNAL');
const profile = createTestProfile();
let external:Awaited<ReturnType<typeof createService>>|null|undefined, desktop:ElectronApplication|undefined, postgres:Awaited<ReturnType<typeof createPostgresFixture>>|undefined;
try {
postgres=await createPostgresFixture();desktopEnv.DATABASE_URL=postgres.url;desktopEnv.DROCSID_TRUSTED_LOCAL='1';desktopEnv.DROCSID_HOST='1';
external = externalMode ? await createService({ database:await postgres.open(),trustedLocal:true, iceServers: [] }) : null;
if (external){const service=external;await new Promise<void>(resolveListen => service.server.listen(0, '127.0.0.1', resolveListen));}
const externalUrl = external ? `http://127.0.0.1:${testPort(external.server)}` : '';
desktop = await electron.launch({
  ...(process.env.CONVERSA_TEST_EXECUTABLE ? { executablePath: resolve(process.env.CONVERSA_TEST_EXECUTABLE) } : {}),
  args: [...(process.env.CONVERSA_TEST_EXECUTABLE ? [] : [resolve('.')]), `--user-data-dir=${profile}`, '--use-fake-device-for-media-stream', '--mute-audio'],
  env: desktopEnv,
  timeout: 30000,
});
  required(required(desktop).process().stderr).on('data', bytes => { nativeDiagnostics += bytes.toString(); });
  const first = await required(desktop).firstWindow();
  first.on('console', message => {
    const value = message.text();
    if (value.startsWith('CONVERSA_TEST_STOP ')) stops.push(JSON.parse(value.slice(19)));
    else if (message.type() === 'warning') { try { diagnostics.push(JSON.parse(value)); } catch {} }
  });
  const firstNativeWindow = await required(desktop).browserWindow(first);
  const captureTitle = `Conversa smoke ${Date.now()}`;
  const firstMuted = () => firstNativeWindow.evaluate(window => window.webContents.isAudioMuted());
  first.on('pageerror', error => errors.push(error.message));
  await expect(first.getByRole('heading', { name: 'Vamos nos encontrar?' })).toBeVisible();
  expect(await firstMuted()).toBe(true);

  await first.screenshot({ path: resolve(output, '01-entrada.png') });
  await instrument(first);
  await first.getByLabel('Seu nome', { exact: true }).fill('Ana');
  await first.getByLabel('Servidor do grupo').fill('file:///invalid');
  await first.getByRole('button', { name: 'Entrar no Drocsid', exact: true }).click();
  await expect(first.getByText('Endereço ou sala inválidos.', { exact: true })).toBeVisible();
  await first.getByLabel('Servidor do grupo').fill('');
  if (external) await first.getByLabel('Servidor do grupo').fill(externalUrl);
  await first.getByRole('button', { name: 'Entrar no Drocsid', exact: true }).click();
  await expect(first.getByRole('heading', { name: 'geral', exact: true })).toBeVisible();

  // STAB-57/58: real keyboard focus, not only ARIA attributes.
  const settings = first.getByRole('button', { name: 'Configurações', exact: true });
  await settings.click();
  const settingsDialog = first.getByRole('dialog', { name: 'Do seu jeito' });
  await expect(settingsDialog).toBeVisible();
  expect(await settingsDialog.evaluate(dialog => dialog.contains(document.activeElement))).toBe(true);
  expect(await first.locator('.app-shell').evaluate(element => {if(!(element instanceof HTMLElement))throw new Error('Missing app shell');return element.inert;})).toBe(true);
  await first.keyboard.press('Shift+Tab');
  expect(await settingsDialog.evaluate(dialog => dialog.contains(document.activeElement))).toBe(true);
  await first.keyboard.press('Shift+Tab');
  expect(await settingsDialog.evaluate(dialog => dialog.contains(document.activeElement))).toBe(true);
  await first.keyboard.press('Tab');
  expect(await settingsDialog.evaluate(dialog => dialog.contains(document.activeElement))).toBe(true);
  await first.keyboard.press('Escape'); await expect(settingsDialog).toHaveCount(0); await expect(settings).toBeFocused();
  expect(await first.locator('.app-shell').evaluate(element => {if(!(element instanceof HTMLElement))throw new Error('Missing app shell');return element.inert;})).toBe(false);

  const contrasts = await first.evaluate(() => {
    const rgb = (value:string) => {const components=value.match(/[\d.]+/g);if(!components||components.length<3)throw new Error('Missing RGB color');return components.slice(0, 3).map(Number);};
    const light = (color:string) => rgb(color).map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index], 0);
    return ['.composer-footer', '.app-footer', '.space-header .eyebrow'].map(selector => {
      const element = document.querySelector(selector);if(!element)throw new Error('Missing contrast element');let background:Element = element;
      while (background.parentElement && ['rgba(0, 0, 0, 0)', 'transparent'].includes(getComputedStyle(background).backgroundColor)) background = background.parentElement;
      const a = light(getComputedStyle(element).color), b = light(getComputedStyle(background).backgroundColor);
      return { selector, ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
    });
  });
  for (const contrast of contrasts) expect(contrast.ratio, contrast.selector).toBeGreaterThanOrEqual(4.5);

  // STAB-17/20: drafts belong to the room throughout navigation.
  await first.getByLabel('Mensagem', { exact: true }).fill('Rascunho geral');
  await first.evaluate(() => {
    const socket = window.__testSocket, receive = socket.onmessage, delayed:MessageEvent[] = [];if(!receive)throw new Error('Missing socket listener');
    let holding = false;
    socket.onmessage = event => {
      const data = JSON.parse(event.data);
      if (holding || (data.type === 'joined' && data.room.id === 'cafe')) { holding = true; delayed.push(event); }
      else receive.call(socket,event);
    };
    window.__releaseRoom = () => { socket.onmessage = receive; delayed.forEach(event => receive.call(socket,event)); };
  });
  await first.locator('.channels button').filter({ hasText: 'café' }).click();
  await expect(first.getByRole('heading', { name: 'geral', exact: true })).toBeVisible();
  await expect(first.getByLabel('Mensagem', { exact: true })).toBeDisabled();
  await expect(first.getByRole('button', { name: 'Enviar mensagem', exact: true })).toBeDisabled();
  await first.getByLabel('Mensagem', { exact: true }).evaluate(element => {if(!(element instanceof HTMLTextAreaElement)||!element.form)throw new Error('Missing composer form');element.form.requestSubmit();});
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
  await first.evaluate(() => { window.__holdMicrophone = false; const release=window.__releaseMicrophone;if(!release)throw new Error('Missing microphone release');release(); });
  await expect.poll(() => first.evaluate(() => window.__lateStream.getTracks().every(track => track.readyState === 'ended'))).toBe(true);
  expect(await firstMuted()).toBe(true);

  // MEDIA-07/31/32: keyboard cancellation and a technical inventory failure.
  await first.evaluate(() => { window.__holdMicrophone = true; window.__releaseMicrophone = null; });
  await first.getByRole('button', { name: 'Entrar na chamada', exact: true }).click();
  await expect.poll(() => first.evaluate(() => !!window.__releaseMicrophone)).toBe(true);
  await cancelEntryByKeyboard(first);
  await first.evaluate(() => { window.__holdMicrophone = false; const release=window.__releaseMicrophone;if(!release)throw new Error('Missing microphone release');release(); });
  await expect.poll(() => first.evaluate(() => window.__lateStream.getTracks().every(track => track.readyState === 'ended'))).toBe(true);
  expect(await first.evaluate(()=>window.__lastStopAt-window.__micReleasedAt)).toBeLessThanOrEqual(1000);
  // The permission has resolved, but the actual admission acknowledgement is withheld.
  await first.evaluate(()=>{
    const socket=window.__testSocket,receive=socket.onmessage;if(!receive)throw new Error('Missing socket listener');window.__heldJoin=[];
    socket.onmessage=event=>{const value=JSON.parse(event.data);if(value.type==='ack'&&value.action==='call-join')window.__heldJoin.push(event);else receive.call(socket,event);};
    window.__releaseJoin=()=>{socket.onmessage=receive;window.__heldJoin.splice(0).forEach(event=>receive.call(socket,event));};
  });
  await first.getByRole('button',{name:'Entrar na chamada',exact:true}).click();
  await expect.poll(()=>first.evaluate(()=>window.__heldJoin.length)).toBe(1);
  await cancelEntryByKeyboard(first);
  expect(await first.evaluate(()=>window.__testCaptures.at(-1)?.getTracks().every(track=>track.readyState==='ended'))).toBe(true);
  await first.evaluate(()=>window.__releaseJoin());
  expect(await firstMuted()).toBe(true);await expect(first.getByText('VOCÊ ESTÁ NA CHAMADA',{exact:true})).toHaveCount(0);
  await first.getByRole('button', { name: 'Entrar na chamada', exact: true }).click();
  await expect(first.getByText('VOCÊ ESTÁ NA CHAMADA', { exact: true })).toBeVisible();
  await required(desktop).evaluate(({ desktopCapturer }) => {
    globalThis.__mediaOriginalInventory = desktopCapturer.getSources;
    desktopCapturer.getSources = async () => { const error = Object.assign(new Error('MEDIA_PRIVATE_MESSAGE'),{name:'MEDIA_PRIVATE_TITLE',sdp:'MEDIA_PRIVATE_SDP',credential:'MEDIA_PRIVATE_SECRET'});throw error; };
  });
  await first.getByRole('button', { name: 'Compartilhar tela', exact: true }).click();
  await expect(first.getByText('Não foi possível listar as fontes de tela.', { exact: true })).toBeVisible();
  await expect.poll(() => diagnostics.filter(value => value.phase === 'capture-inventory').length).toBe(1);
  const captureDiagnostic = required(diagnostics.find(value => value.phase === 'capture-inventory'));
  expect(captureDiagnostic).toMatchObject({code:'MEDIA_FAILED',phase:'capture-inventory',version:'0.1.1'});
  for (const field of ['requestId','callId','operationId']) expect(captureDiagnostic[field]).toMatch(/^[a-f0-9-]{36}$/);
  expect(captureDiagnostic.generation).toBeGreaterThan(0);
  expect(Object.keys(captureDiagnostic).sort()).toEqual(['callId','cause','code','generation','operationId','phase','requestId','runtime','version']);
  expect(JSON.stringify(diagnostics) + nativeDiagnostics).not.toContain('MEDIA_PRIVATE_');
  await required(desktop).evaluate(({ desktopCapturer }) => { desktopCapturer.getSources = globalThis.__mediaOriginalInventory; });
  await first.getByRole('button', { name: 'Encerrar chamada', exact: true }).click();

  const secondWindow = required(desktop).waitForEvent('window');
  await required(desktop).evaluate(({ Menu }) => Menu.getApplicationMenu()?.items[0].submenu?.items[0].click());
  const second = await secondWindow;
  await instrument(second);
  second.on('pageerror', error => errors.push(error.message));
  await second.getByLabel('Seu nome', { exact: true }).fill('Bruno');
  if (external) await second.getByLabel('Servidor do grupo').fill(externalUrl);
  await second.getByRole('button', { name: 'Entrar no Drocsid', exact: true }).click();
  await expect(second.getByText('2 online')).toBeVisible();
  await first.getByLabel('Mensagem', { exact: true }).fill('Olá, grupo! Vamos compartilhar as ideias?');
  await first.getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
  await expect(second.getByText('Olá, grupo! Vamos compartilhar as ideias?', { exact: true })).toBeVisible();

  await first.evaluate(protocolVersion => {
    for (let i = 0; i < 45; i++) window.__testSocket.send(JSON.stringify({ v: protocolVersion, type: 'message', requestId: crypto.randomUUID(), operationId: crypto.randomUUID(), room: 'geral', text: `Histórico ${i}: ` + 'conteúdo de leitura '.repeat(12) }));
  }, PROTOCOL_VERSION);
  await expect(second.locator('.message p').last()).toContainText('Histórico 44:');
  expect(await second.locator('.messages').evaluate(element => element.scrollHeight - element.clientHeight)).toBeGreaterThan(100);
  await second.locator('.messages').evaluate(element => { element.scrollTop = 0; });
  await second.evaluate(() => new Promise(resolveFrame => requestAnimationFrame(resolveFrame)));
  await first.getByLabel('Mensagem', { exact: true }).fill('Mensagem nova durante leitura');
  await first.getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
  await expect(second.getByText('Mensagem nova durante leitura', { exact: true })).toHaveCount(1);
  expect(await second.locator('.messages').evaluate(element => element.scrollTop)).toBe(0);

  const observerPromise = required(desktop).waitForEvent('window');
  await required(desktop).evaluate(({ Menu }) => Menu.getApplicationMenu()?.items[0].submenu?.items[0].click());
  const observer = await observerPromise;
  observer.on('pageerror', error => errors.push(error.message));
  await observer.getByLabel('Seu nome', { exact: true }).fill('Ana');
  if (external) await observer.getByLabel('Servidor do grupo').fill(externalUrl);
  await observer.getByRole('button', { name: 'Entrar no Drocsid', exact: true }).click();
  await expect(observer.getByRole('heading', { name: 'geral', exact: true })).toBeVisible();
  await observer.getByLabel('Mensagem', { exact: true }).fill('Outra pessoa chamada Ana');
  await observer.getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
  const homonym = first.locator('.message').filter({ hasText: 'Outra pessoa chamada Ana' });
  await expect(homonym).not.toHaveClass(/grouped/);
  await first.evaluate(v=>{
    for(const [index,text]of ['Legado sem identidade 1','Legado sem identidade 2'].entries())window.__testSocket.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({v,type:'message',context:window.__testRoomContext,message:{id:`legacy-${index}`,room:'geral',author:'Mesmo nome',authorId:null,operationId:null,text,created:1,sequence:100000+index}})}));
  },PROTOCOL_VERSION);
  for(const text of ['Legado sem identidade 1','Legado sem identidade 2']){
    const legacy=first.locator('.message').filter({hasText:text});
    await expect(legacy).not.toHaveClass(/grouped/);
    await expect(legacy.locator('.message-meta strong')).toHaveText('Mesmo nome');
  }

  await first.getByRole('button', { name: 'Entrar na chamada', exact: true }).click();
  await expect(first.getByText('VOCÊ ESTÁ NA CHAMADA', { exact: true })).toBeVisible();
  await expect.poll(firstMuted).toBe(false);
  await first.getByRole('button', { name: 'Silenciar áudio', exact: true }).click();
  await expect.poll(firstMuted).toBe(true);
  expect(await first.evaluate(() => window.__testCaptures.at(-1)?.getAudioTracks().every(track => track.enabled && track.readyState === 'live'))).toBe(true);
  await first.evaluate(protocolVersion=>{
    const previous=window.__testCallEvents.find(event=>event.type==='call-join');if(!previous)throw new Error('Missing call attempt');
    const common={v:protocolVersion,context:window.__testRoomContext,callId:previous.callId};
    for(const event of [
      {...common,type:'ack',requestId:previous.requestId,action:'call-join',generation:previous.generation,inCall:true,muted:false,sharing:false},
      {...common,type:'signal',from:'obsolete-peer',fromCallId:'obsolete-remote',signal:{description:{type:'offer',sdp:'obsolete-offer'}}},
    ])window.__testSocket.dispatchEvent(new MessageEvent('message',{data:JSON.stringify(event)}));
  },PROTOCOL_VERSION);
  expect(await firstMuted()).toBe(true);expect(await first.getByRole('button',{name:'Ativar áudio',exact:true}).count()).toBe(1);
  await first.getByRole('button', { name: 'Ativar áudio', exact: true }).click();
  await expect.poll(firstMuted).toBe(false);
  const playbackAttempt=required(await first.evaluate(()=>window.__testCallEvents.filter(event=>event.type==='call-join').at(-1)));
  const playbackBefore=diagnostics.filter(value=>value.phase==='playback').length;
  await first.evaluate(()=>{window.__rejectNextPlayback=true;});
  await second.getByRole('button', { name: 'Participar', exact: true }).click();
  await expect.poll(()=>diagnostics.filter(value=>value.phase==='playback').length).toBeGreaterThan(playbackBefore);
  expect(await first.evaluate(()=>window.__rejectNextPlayback)).toBe(false);
  expect(diagnostics.filter(value=>value.phase==='playback')[playbackBefore]).toMatchObject({code:'MEDIA_FAILED',phase:'playback',callId:playbackAttempt.callId,generation:playbackAttempt.generation,version:'0.1.1',cause:'Error'});
  expect(JSON.stringify(diagnostics)+nativeDiagnostics).not.toContain('STAB_PRIVATE_');
  await expect.poll(() => first.evaluate(() => window.__testConnections.some(pc => pc.connectionState === 'connected')), { timeout: 20000 }).toBe(true);
  // Recovery remains the manual call reentry below. Native play-promise
  // completion/audibility is not the diagnostic outcome required by STAB-67.
  await first.evaluate(() => window.__testConnections.filter(pc => pc.connectionState === 'connected').forEach(pc => { pc.close(); pc.dispatchEvent(new Event('connectionstatechange')); }));
  await expect(first.getByText('Mídia indisponível', { exact: true })).toBeVisible();
  await first.getByRole('button', { name: 'Encerrar chamada', exact: true }).click();
  await first.getByRole('button', { name: 'Participar', exact: true }).click();
  await expect.poll(() => first.evaluate(() => window.__testCallEvents.filter(event => event.type === 'call-join').length)).toBeGreaterThanOrEqual(3);
  const attempts = await first.evaluate(() => window.__testCallEvents.filter(event => event.type === 'call-join'));
  expect(attempts.length).toBeGreaterThanOrEqual(3);
  for (let i = 1; i < attempts.length; i++) {
    expect(attempts[i].generation).toBeGreaterThan(attempts[i - 1].generation);
    expect(attempts[i].callId).not.toBe(attempts[i - 1].callId);
  }
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
  await firstNativeWindow.evaluate(window => {
    const send = window.webContents.send.bind(window.webContents);
    window.webContents.send = (channel:string, payload:unknown) => { if (channel === 'capture-sources'){if(!payload||typeof payload!=='object')throw new Error('Invalid capture payload');window.__capturePayload={...payload};}return send(channel, payload); };
  });
  await first.getByRole('button', { name: 'Compartilhar tela', exact: true }).click();
  const cancelledPicker = first.getByRole('dialog', { name: 'O que vamos compartilhar?' });
  await expect(cancelledPicker).toBeVisible();await first.keyboard.press('Escape');await expect(cancelledPicker).toHaveCount(0);
  await firstNativeWindow.evaluate(window => { window.__oldCapturePayload = window.__capturePayload; });
  await expect(first.getByRole('button', { name: 'Compartilhar tela', exact: true })).toBeEnabled();
  await first.evaluate(() => {
    const socket = window.__testSocket, receive = socket.onmessage;if(!receive)throw new Error('Missing socket listener');
    window.__holdMedia = 'start'; window.__heldMedia = [];
    socket.onmessage = event => {
      const value = JSON.parse(event.data);
      if (value.type === 'ack' && value.action === 'media' && ((window.__holdMedia === 'start' && value.sharing) || (window.__holdMedia === 'stop' && !value.sharing))) window.__heldMedia.push(event);
      else receive.call(socket,event);
    };
    window.__releaseMedia = () => { window.__holdMedia = null; window.__heldMedia.splice(0).forEach(event => receive.call(socket,event)); };
  });
  await first.getByRole('button', { name: 'Compartilhar tela', exact: true }).click();
  const picker = first.getByRole('dialog', { name: 'O que vamos compartilhar?' });
  await expect(picker).toBeVisible({ timeout: 15000 });
  await expect(first.getByText('Escolhendo…', { exact: true })).toBeVisible();
  await firstNativeWindow.evaluate(window => { window.webContents.send('capture-error', {...window.__oldCapturePayload,code:'MEDIA_FAILED',phase:'capture-inventory'}); });
  await expect(picker).toBeVisible();expect(diagnostics.filter(value => value.phase === 'capture-inventory').length).toBe(1);
  await picker.getByRole('button', { name: captureTitle, exact: true }).click();
  await expect(first.getByText('Publicando…', { exact: true })).toBeVisible();await expect(first.getByText('AO VIVO', { exact: true })).toHaveCount(0);
  await first.evaluate(() => window.__releaseMedia());
  await expect(second.getByText('Tela de Ana', { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(observer.locator('video')).toHaveCount(0);
  await expect(observer.getByText('AO VIVO', { exact: true })).toHaveCount(0);
  await expect(observer.getByRole('button', { name: 'Participar', exact: true })).toBeVisible();
  await expect(first.getByRole('button', { name: 'Parar compartilhamento', exact: true })).toBeInViewport();
  await expect(second.getByRole('button', { name: 'Encerrar chamada', exact: true })).toBeInViewport();
  await expect.poll(() => second.locator('video').evaluateAll(videos => videos.some(v => v instanceof HTMLVideoElement&&v.videoWidth > 0)), { timeout: 20000 }).toBe(true);
  await settings.click();
  await first.getByLabel('Qualidade do compartilhamento').selectOption('720');
  await expect(first.getByText('A qualidade selecionada vale para a próxima captura.', { exact: true })).toBeVisible();
  await first.keyboard.press('Escape');
  await second.screenshot({ path: resolve(output, '03-tela-compartilhada.png') });
  if (external) {
    const thirdWindow = required(desktop).waitForEvent('window');
    await required(desktop).evaluate(({ Menu }) => Menu.getApplicationMenu()?.items[0].submenu?.items[0].click());
    const third = await thirdWindow;
    third.on('pageerror', error => errors.push(error.message));
    await third.getByLabel('Seu nome', { exact: true }).fill('Carla');
    await third.getByLabel('Servidor do grupo').fill(externalUrl);
    await third.getByRole('button', { name: 'Entrar no Drocsid', exact: true }).click();
    await third.getByRole('button', { name: 'Participar', exact: true }).click();
    await expect(third.getByText('3 pessoas na chamada', { exact: true })).toBeVisible();
    await expect.poll(() => third.locator('video').evaluateAll(videos => videos.some(v => v instanceof HTMLVideoElement&&v.videoWidth > 0)), { timeout: 20000 }).toBe(true);
    await third.getByRole('button', { name: 'Encerrar chamada', exact: true }).click();
    console.log('PASS: separate group server, cross-origin desktop connection and third participant joining an active screen share.');
  }
  await first.evaluate(() => {
    window.__holdMedia = 'stop';
    const button=document.querySelector('[aria-label="Parar compartilhamento"]');if(!(button instanceof HTMLButtonElement))throw new Error('Missing stop screen button');
    window.__stopUI={started:null,readyAt:null};
    button.addEventListener('click',()=>{window.__stopUI.started=performance.now();},{once:true,capture:true});
    const observer=new MutationObserver(()=>{
      if(window.__stopUI.started!==null&&!button.disabled&&button.textContent==='Compartilhar'){
        window.__stopUI.readyAt=performance.now();observer.disconnect();
      }
    });observer.observe(button,{attributes:true,childList:true,subtree:true});
    for(const pc of window.__testConnections)for(const {sender} of pc.getTransceivers())if(sender.track?.kind==='video'){
      const replace=sender.replaceTrack.bind(sender);
      sender.replaceTrack=async track=>{sender.replaceTrack=replace;await new Promise(resolve=>setTimeout(resolve,350));return replace(track);};
    }
  });
  await first.getByRole('button', { name: 'Parar compartilhamento', exact: true }).click();
  await expect(first.getByText('Parando…', { exact: true })).toBeVisible();
  expect(await first.evaluate(() => window.__testDisplays.at(-1)?.getTracks().every(track => track.readyState === 'ended'))).toBe(true);
  expect(await first.evaluate(() => window.__testCaptures.at(-1)?.getTracks().every(track => track.readyState === 'live'))).toBe(true);
  await expect(first.getByRole('button',{name:'Compartilhar tela',exact:true})).toBeEnabled({timeout:1500});
  const stopTiming=await first.evaluate(()=>window.__stopUI);
  expect(stopTiming.started).toEqual(expect.any(Number));expect(stopTiming.readyAt).toEqual(expect.any(Number));
  assert.ok(stopTiming.readyAt!==null&&stopTiming.started!==null);expect(stopTiming.readyAt-stopTiming.started).toBeLessThanOrEqual(1000);
  await first.getByRole('button',{name:'Compartilhar tela',exact:true}).click();
  await expect(picker).toBeVisible();await picker.getByRole('button',{name:captureTitle,exact:true}).click();
  await expect(first.getByRole('button',{name:'Parar compartilhamento',exact:true})).toBeEnabled();
  const replacementDisplay=await first.evaluate(()=>window.__testDisplays.at(-1)?.getVideoTracks()[0].id);
  await first.evaluate(() => window.__releaseMedia());
  expect(await first.evaluate(id=>window.__testDisplays.at(-1)?.getVideoTracks().some(track=>track.id===id&&track.readyState==='live'),replacementDisplay)).toBe(true);
  await expect(first.getByRole('button',{name:'Parar compartilhamento',exact:true})).toBeEnabled();
  await first.getByRole('button',{name:'Parar compartilhamento',exact:true}).click();
  await expect(second.getByText('Tela de Ana', { exact: true })).toHaveCount(0);
  await first.evaluate(() => {
    const socket = window.__testSocket, receive = socket.onmessage;if(!receive)throw new Error('Missing socket listener');window.__delayedRoom = [];
    socket.onmessage = event => { const value=JSON.parse(event.data);if(value.type==='joined')window.__delayedRoom.push(event);else receive.call(socket,event); };
    window.__releaseNewRoom = () => { socket.onmessage=receive;window.__delayedRoom.splice(0).forEach(event=>receive.call(socket,event)); };
  });
  await first.getByRole('button', { name: 'Adicionar sala', exact: true }).click();
  await first.getByLabel('Nome da sala', { exact: true }).fill('Estúdio');
  await first.getByRole('button', { name: 'Criar sala', exact: true }).last().click();
  await expect.poll(() => first.evaluate(() => window.__delayedRoom.length)).toBe(1);
  await expect(first.getByRole('heading', { name: 'geral', exact: true })).toBeVisible();
  expect(await firstMuted()).toBe(true);
  expect(await first.evaluate(() => window.__testCaptures.every(stream=>stream.getTracks().every(track=>track.readyState==='ended')) && window.__testConnections.every(pc=>pc.connectionState==='closed'))).toBe(true);
  await first.evaluate(() => window.__releaseNewRoom());
  await expect(first.getByRole('heading', { name: 'Estúdio', exact: true })).toBeVisible();
  await expect.poll(firstMuted).toBe(true);
  await expect(second.getByText('1 pessoa na chamada', { exact: true })).toBeVisible();
  await first.getByRole('button', { name: 'Entrar na chamada', exact: true }).click();
  await expect(first.getByText('VOCÊ ESTÁ NA CHAMADA', { exact: true })).toBeVisible();
  const reloadedIds = required(await first.evaluate(() => window.__testCaptures.at(-1)?.getTracks().map(track=>track.id)));
  await first.reload();
  for (const id of reloadedIds) await expect.poll(() => stops.some(track=>track.id===id&&track.state==='ended')).toBe(true);
  await expect.poll(firstMuted).toBe(true);expect(await first.locator('audio,video').count()).toBe(0);
  await instrument(first);await first.getByRole('button', { name: 'Entrar no Drocsid', exact: true }).click();
  await first.getByRole('button', { name: 'Participar', exact: true }).click();
  await expect(first.getByText('VOCÊ ESTÁ NA CHAMADA', { exact: true })).toBeVisible();
  const disconnectedIds = required(await first.evaluate(() => window.__testCaptures.at(-1)?.getTracks().map(track=>track.id)));
  await settings.click();await first.getByRole('button', { name: 'Sair e trocar de servidor', exact: true }).click();
  for (const id of disconnectedIds) await expect.poll(() => stops.some(track=>track.id===id&&track.state==='ended')).toBe(true);
  await expect.poll(firstMuted).toBe(true);expect(await first.locator('audio,video').count()).toBe(0);
  if (errors.length) throw new Error(`Renderer errors: ${errors.join('; ')}`);
  console.log('PASS: Windows desktop, two users, group chat, voice RTP, mute, screen video, stop capture, room creation and call cleanup.');
} finally {
  try { await closeResources([() => closeDesktop(desktop), () => external?.close()]); }
  finally { try{await postgres?.close();}finally{removeTestProfile(profile);} }
}
