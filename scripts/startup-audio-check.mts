import {required} from '../tests/helpers/assertions.js';
import { _electron as electron } from 'playwright';
import type {ElectronApplication} from 'playwright';
import { expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { readFlag, desktopTarget, createTestProfile, removeTestProfile, closeDesktop, closeResources,testEnvironment } from './test-runtime.mjs';

const env = testEnvironment(); delete env.ELECTRON_RUN_AS_NODE;
const target = desktopTarget(), checkMuted = readFlag('CONVERSA_CHECK_MUTED');
const fromSource = target.args.length > 0, profile = createTestProfile();
let desktop:ElectronApplication|undefined;
try {
  desktop = await electron.launch({ ...target, args: [...target.args, `--user-data-dir=${profile}`], env, timeout: 15000 });
  const initial = await required(desktop).firstWindow();
  await expect(initial.getByRole('heading', { name: 'Vamos nos encontrar?' })).toBeVisible();
  await required(desktop).context().addInitScript(()=>{
    window.__captureAudit={readyState:document.readyState,calls:{microphone:0,display:0,legacy:0}};
    const microphone=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices),display=navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia=(...args:Parameters<typeof microphone>)=>{window.__captureAudit.calls.microphone++;return microphone(...args);};
    navigator.mediaDevices.getDisplayMedia=(...args:Parameters<typeof display>)=>{window.__captureAudit.calls.display++;return display(...args);};
    for(const name of ['getUserMedia','webkitGetUserMedia'] as const){
      const original=navigator[name]?.bind(navigator);if(!original)continue;
      navigator[name]=(...args:Parameters<typeof original>)=>{window.__captureAudit.calls.legacy++;return original(...args);};
    }
  });
  const opening=required(desktop).waitForEvent('window');
  await required(desktop).evaluate(({Menu})=>Menu.getApplicationMenu()?.items[0].submenu?.items[0].click());
  const page=await opening;await initial.close();
  const samples = [];
  const phases=[];
  for(const phase of ['opening','reload']){
    if(phase==='reload')await page.reload();
    await expect(page.getByRole('heading',{name:'Vamos nos encontrar?'})).toBeVisible();
    for (let i = 0; i < 8; i++) {
      samples.push(await required(desktop).evaluate(({ webContents }) => webContents.getAllWebContents().map(c => ({ id: c.id, audible: c.isCurrentlyAudible(), muted: c.isAudioMuted(), url: c.getURL() }))));
      await page.waitForTimeout(750);
    }
    const capture=await page.evaluate(()=>window.__captureAudit);
    expect(capture.readyState).toBe('loading');expect(capture.calls).toEqual({microphone:0,display:0,legacy:0});
    phases.push({phase,capture});
  }
  const dom = await page.evaluate(() => ({ audioElements: document.querySelectorAll('audio').length, videoElements: document.querySelectorAll('video').length, mediaElements: [...document.querySelectorAll('audio,video')].map(m => {if(!(m instanceof HTMLMediaElement))throw new Error('Invalid media element');return {paused:m.paused,tracks:m.srcObject instanceof MediaStream?m.srcObject.getTracks().map(t=>({kind:t.kind,readyState:t.readyState})):undefined};}) }));
  const report = { target: fromSource ? 'source' : 'packaged', samples, dom, phases };
  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/startup-audio.json', JSON.stringify(report, null, 2));
  expect(samples.flat().some(s => s.audible)).toBe(false);
  expect(dom.audioElements).toBe(0);
  expect(dom.videoElements).toBe(0);
  if (checkMuted) expect(samples.flat().every(s => s.muted)).toBe(true);
  console.log(JSON.stringify({ startupAudible: false, samples: samples.length, ...dom }));
} finally {
  try { await closeResources([() => closeDesktop(desktop)]); }
  finally { removeTestProfile(profile); }
}
