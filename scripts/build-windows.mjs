import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Windows scanners may retain handles to ASARs after packaging. Build in a new
// staging directory so another build never needs to remove a previous ASAR.
const staging = resolve('.packaging/builds', String(Date.now()));
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const artifactName = `Conversa-${version}-Windows.exe`;
const result = spawnSync(process.execPath, [resolve('node_modules/electron-builder/out/cli/cli.js'), '--win', 'portable', '--x64', `--config.directories.output=${staging}`], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status || 1);
mkdirSync('release-windows', { recursive: true });
const portable = resolve('release-windows', artifactName);
copyFileSync(resolve(staging, artifactName), portable);
mkdirSync('artifacts', { recursive: true });
writeFileSync('artifacts/build.json', JSON.stringify({ portable, executable: resolve(staging, 'win-unpacked/Conversa.exe') }, null, 2));
console.log(`Executável portátil: ${portable}`);
