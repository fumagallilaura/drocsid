import { cpSync, mkdirSync, rmSync, existsSync, lstatSync } from 'node:fs';
import { resolve, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
// The runtime's example app is unused. Omit it from the staging copy so the
// packager can publish our application without deleting a locked example ASAR.
export function prepareElectron(root = process.cwd()) {
  const destination = resolve(root, '.packaging/electron');
  if (dirname(destination) !== resolve(root, '.packaging') || (existsSync(destination) && lstatSync(destination).isSymbolicLink())) throw new Error('Unsafe runtime staging directory');
  rmSync(destination, { recursive: true, force: true });
  mkdirSync(destination, { recursive: true });
  cpSync(resolve(root, 'node_modules/electron/dist'), destination, {
    recursive: true,
    filter: source => basename(source) !== 'default_app.asar',
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) prepareElectron();
