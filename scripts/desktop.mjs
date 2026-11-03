import { spawn } from 'node:child_process';
import { connect } from 'node:net';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// ponytail: this PC is the home while Docker Postgres listens on 127.0.0.1:5432. Replace with a shared account service when login must follow the person across computers.
const env = { ...process.env };
const passFile = join(process.env.APPDATA || '', 'drocsid', 'postgres-password');
const listening = () => new Promise(resolve => {
  const socket = connect(5432, '127.0.0.1');
  const done = ok => { socket.destroy(); resolve(ok); };
  socket.setTimeout(400);
  socket.once('connect', () => done(true));
  socket.once('error', () => done(false));
  socket.once('timeout', () => done(false));
});
if (!env.DATABASE_URL && existsSync(passFile) && await listening()) {
  const pass = readFileSync(passFile, 'utf8').trim();
  if (/^[a-f0-9]{48}$/.test(pass)) {
    env.DATABASE_URL = `postgres://drocsid:${pass}@127.0.0.1:5432/drocsid`;
    env.DROCSID_HOST = '1';
  }
}
const child = spawn(process.execPath, [join('node_modules', 'electron', 'cli.js'), '.'], { stdio: 'inherit', env });
child.on('exit', code => process.exit(code ?? 0));
