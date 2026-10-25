import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { prepareElectron } from '../scripts/prepare-electron.mjs';

test('BUILD-06: runtime staging removes obsolete files and omits the Electron example app', () => {
  const root = mkdtempSync(join(tmpdir(), 'conversa-packaging-'));
  try {
    const source = join(root, 'node_modules/electron/dist'), destination = join(root, '.packaging/electron');
    mkdirSync(join(source, 'resources'), { recursive: true }); mkdirSync(destination, { recursive: true });
    writeFileSync(join(source, 'electron.exe'), 'current runtime');
    writeFileSync(join(source, 'resources/default_app.asar'), 'unused example');
    writeFileSync(join(source, 'resources/runtime.dat'), 'current data');
    writeFileSync(join(destination, 'obsolete.dll'), 'obsolete');
    prepareElectron(root);
    assert.equal(readFileSync(join(destination, 'electron.exe'), 'utf8'), 'current runtime');
    assert.equal(readFileSync(join(destination, 'resources/runtime.dat'), 'utf8'), 'current data');
    assert.equal(existsSync(join(destination, 'obsolete.dll')), false);
    assert.equal(existsSync(join(destination, 'resources/default_app.asar')), false);
    writeFileSync(join(source, 'electron.exe'), 'next runtime'); prepareElectron(root);
    assert.equal(readFileSync(join(destination, 'electron.exe'), 'utf8'), 'next runtime');
  } finally {
    assert.equal(dirname(root), resolve(tmpdir()));
    rmSync(root, { recursive: true, force: true });
  }
});
