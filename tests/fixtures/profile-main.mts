import {app} from 'electron';
import {resolve,dirname,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {lstatSync} from 'node:fs';

const supplied=process.env.DROCSID_TEST_APP_DATA;
if(!supplied)throw new Error('Isolated appData fixture required');
const root=resolve(supplied);
if(dirname(root)!==resolve(tmpdir())||!basename(root).startsWith('conversa-test-')||lstatSync(root).isSymbolicLink())throw new Error('Unsafe appData fixture');
app.setPath('appData',root);
// Chromium starts with an isolated --user-data-dir. Hide only that override
// from the real entrypoint so its default legacy-path decision is exercised.
const getSwitchValue=app.commandLine.getSwitchValue.bind(app.commandLine);
app.commandLine.getSwitchValue=name=>name==='user-data-dir'?'':getSwitchValue(name);
await import('../../electron/main.js');
