import { cpSync, mkdirSync } from 'node:fs';
import { resolve, basename } from 'node:path';
// The runtime's example app is unused. Omit it from the staging copy so the
// packager can publish our application without deleting a locked example ASAR.
const destination = resolve('.packaging/electron');
mkdirSync(destination, { recursive: true });
cpSync(resolve('node_modules/electron/dist'), destination, {
  recursive: true,
  filter: source => basename(source) !== 'default_app.asar',
});
