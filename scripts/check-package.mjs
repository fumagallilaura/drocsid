import assert from 'node:assert/strict';
import { readFileSync, existsSync, createReadStream } from 'node:fs';
import { resolve, dirname, posix } from 'node:path';
import { createHash } from 'node:crypto';
import { listPackage, extractFile } from '@electron/asar';

const manifest = JSON.parse(readFileSync(process.argv[2] || 'test-results/build.json', 'utf8'));
const metadata = JSON.parse(readFileSync('package.json', 'utf8'));
assert.equal(manifest.version, metadata.version);
assert.equal(existsSync(manifest.portable), true);
assert.equal(existsSync(manifest.executable), true);
const digest = createHash('sha256');
for await (const bytes of createReadStream(manifest.portable)) digest.update(bytes);
assert.equal(digest.digest('hex'), manifest.sha256);
const archive = resolve(dirname(manifest.executable), 'resources/app.asar');
const entries = new Set(listPackage(archive).map(path => path.replaceAll('\\', '/').replace(/^\//, '')));
const pending = ['electron/main.js', 'electron/preload.cjs'], checked = new Set();
while (pending.length) {
  const path = pending.pop(); if (checked.has(path)) continue;
  assert.equal(entries.has(path), true, `Missing packaged module: ${path}`);
  const source = extractFile(archive, path).toString('utf8'); checked.add(path);
  if (!path.endsWith('.js') && !path.endsWith('.cjs')) continue;
  for (const match of source.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)) {
    const target = posix.normalize(posix.join(posix.dirname(path), match[1]));
    assert.equal(target.startsWith('../'), false, `Import escapes archive: ${target}`); pending.push(target);
  }
}
assert.equal(checked.has('shared/protocol.js'), true);
assert.equal(JSON.parse(extractFile(archive, 'package.json').toString('utf8')).version, manifest.version);
assert.equal(entries.has('dist/index.html'), true);
console.log(JSON.stringify({ package: 'PASS', version: manifest.version, modules: [...checked].sort(), sha256: manifest.sha256 }));
