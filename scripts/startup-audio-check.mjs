import { _electron as electron } from 'playwright';
import { expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

const build = JSON.parse(readFileSync('artifacts/build.json', 'utf8'));
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
const fromSource = process.env.CONVERSA_CHECK_SOURCE === '1';
const desktop = await electron.launch({
  ...(fromSource ? {} : { executablePath: process.env.CONVERSA_TEST_EXECUTABLE || build.executable }),
  args: [...(fromSource ? [resolve('.')] : []), `--user-data-dir=${resolve(tmpdir(), `conversa-startup-${Date.now()}`)}`],
  env,
});
try {
  const page = await desktop.firstWindow();
  await expect(page.getByRole('heading', { name: 'Vamos nos encontrar?' })).toBeVisible();
  const samples = [];
  for (let i = 0; i < 8; i++) {
    samples.push(await desktop.evaluate(({ webContents }) => webContents.getAllWebContents().map(c => ({ id: c.id, audible: c.isCurrentlyAudible(), muted: c.isAudioMuted(), url: c.getURL() }))));
    await page.waitForTimeout(750);
  }
  const dom = await page.evaluate(() => ({ audioElements: document.querySelectorAll('audio').length, videoElements: document.querySelectorAll('video').length, mediaElements: [...document.querySelectorAll('audio,video')].map(m => ({ paused: m.paused, tracks: m.srcObject?.getTracks().map(t => ({ kind: t.kind, readyState: t.readyState })) })) }));
  const report = { target: fromSource ? 'source' : 'packaged', samples, dom };
  writeFileSync('artifacts/startup-audio.json', JSON.stringify(report, null, 2));
  expect(samples.flat().some(s => s.audible)).toBe(false);
  expect(dom.audioElements).toBe(0);
  expect(dom.videoElements).toBe(0);
  if (process.env.CONVERSA_CHECK_MUTED) expect(samples.flat().every(s => s.muted)).toBe(true);
  console.log(JSON.stringify({ startupAudible: false, samples: samples.length, ...dom }));
} finally { await desktop.close(); }
