import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, renameSync, createReadStream, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

// Windows scanners may retain handles to ASARs after packaging. Build in a new
// staging directory so another build never needs to remove a previous ASAR.
const staging = resolve('.packaging/builds', `${Date.now()}-${randomUUID()}`);
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const artifactName = `Conversa-${version}-Windows.exe`;
const result = spawnSync(process.execPath, [resolve('node_modules/electron-builder/out/cli/cli.js'), '--win', 'portable', '--x64', `--config.directories.output=${staging}`], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status || 1);
mkdirSync('release-windows', { recursive: true });
const portable = resolve('release-windows', artifactName);
const partial = `${portable}.${randomUUID()}.partial`;
try { copyFileSync(resolve(staging, artifactName), partial); renameSync(partial, portable); }
finally { try { unlinkSync(partial); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
const digest = createHash('sha256');
for await (const bytes of createReadStream(portable)) digest.update(bytes);
mkdirSync('test-results', { recursive: true });
const manifest = resolve('test-results/build.json'), temporaryManifest = `${manifest}.${randomUUID()}.tmp`;
writeFileSync(temporaryManifest, JSON.stringify({ version, sha256: digest.digest('hex'), portable,
  executable: resolve(staging, 'win-unpacked/Conversa.exe'), node: process.versions.node,
  electron: JSON.parse(readFileSync('node_modules/electron/package.json', 'utf8')).version }, null, 2));
renameSync(temporaryManifest, manifest);
console.log(`Executável portátil: ${portable}`);
