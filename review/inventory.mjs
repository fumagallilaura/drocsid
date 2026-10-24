import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const files = ['package.json', 'package-lock.json', 'vite.config.js', 'index.html', '.gitignore'];
for (const directory of ['src', 'server', 'electron', 'scripts', 'tests', 'public']) {
  for (const entry of readdirSync(resolve(root, directory), { withFileTypes: true })) if (entry.isFile()) files.push(`${directory}/${entry.name}`);
}
const inventory = files.sort().map(path => {
  const data = readFileSync(resolve(root, path));
  return { path, bytes: data.length, lines: data.toString('utf8').split('\n').length, sha256: createHash('sha256').update(data).digest('hex') };
});
mkdirSync(resolve(root, 'review'), { recursive: true });
const target = process.argv[2] || 'baseline.json';
writeFileSync(resolve(root, 'review', target), JSON.stringify(inventory, null, 2));
console.log(JSON.stringify({ files: inventory.length, sourceBytes: inventory.reduce((sum, file) => sum + file.bytes, 0), target }));
