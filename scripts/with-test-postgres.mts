import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, unlinkSync, existsSync, realpathSync, lstatSync, rmSync, openSync, closeSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import { randomBytes } from 'node:crypto';

const args = process.argv.slice(2);
if (args.shift() !== '--' || args.shift() !== 'node' || !args.length) throw new Error('Uso: node scripts/with-test-postgres.mjs -- node <argumentos>');
const env = { ...process.env };
const bin = env.DROCSID_PG_BIN || join(tmpdir(), 'conversa-postgresql-17.11-5', 'pgsql', 'bin');
const exe = (name: string) => join(bin, name + (process.platform === 'win32' ? '.exe' : ''));
let directory: string | undefined;
let child: ReturnType<typeof spawn> | undefined;

function run(name: string, options: string[]) {
  const log = directory ? openSync(join(directory, 'commands.log'), 'a') : undefined;
  try {
    // A detached PostgreSQL on Windows may inherit pipe handles from pg_ctl.
    // File descriptors avoid waiting for those pipes after pg_ctl has exited.
    const result = spawnSync(exe(name), options, { windowsHide: true, timeout: 30000, env, stdio: ['ignore', log ?? 'ignore', log ?? 'ignore'] });
    if (result.error || result.status !== 0) throw new Error(`${name} falhou. Confira DROCSID_PG_BIN e os logs do cluster de teste em test-results/postgres.`);
  } finally { if (log !== undefined) closeSync(log); }
}

try {
  if (env.DROCSID_TEST_DATABASE_URL) {
    const configured = new URL(env.DROCSID_TEST_DATABASE_URL);
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(configured.hostname)) throw new Error('O PostgreSQL de teste deve estar em loopback.');
  } else {
    if (!existsSync(exe('initdb')) || !existsSync(exe('pg_ctl'))) throw new Error('PostgreSQL real obrigatório: configure DROCSID_PG_BIN com bin/initdb e bin/pg_ctl, ou DROCSID_TEST_DATABASE_URL para um cluster local isolado com permissão de criar bancos de teste.');
    const parent = resolve('test-results/postgres'); mkdirSync(parent, { recursive: true });
    directory = mkdtempSync(join(parent, 'run-'));
    const password = randomBytes(32).toString('hex'), passwordFile = join(directory, 'initdb-password');
    writeFileSync(passwordFile, password, { mode: 0o600 });
    try { run('initdb', ['-D', join(directory, 'data'), '-U', 'drocsid_test_admin', '--auth=scram-sha-256', '--encoding=UTF8', '--locale=C', `--pwfile=${passwordFile}`]); }
    finally { unlinkSync(passwordFile); }
    const reservation = createServer();
    await new Promise<void>((yes, no) => { reservation.once('error', no); reservation.listen(0, '127.0.0.1', yes); });
    const address = reservation.address();
    if (!address || typeof address === 'string') throw new Error('Porta PostgreSQL de teste indisponível.');
    const port = address.port;
    await new Promise<void>((yes, no) => reservation.close(error => error ? no(error) : yes()));
    run('pg_ctl', ['-D', join(directory, 'data'), '-l', join(directory, 'postgres.log'), '-w', '-t', '10', '-o', `-h 127.0.0.1 -p ${port}`, 'start']);
    console.log(`PostgreSQL real de teste: 127.0.0.1:${port}, SCRAM, cluster isolado.`);
    env.DROCSID_TEST_DATABASE_URL = `postgres://drocsid_test_admin:${password}@127.0.0.1:${port}/postgres`;
  }
  child = spawn(process.execPath, args, { stdio: 'inherit', env, windowsHide: true });
  process.exitCode = await new Promise<number>((yes, no) => { child?.once('error', no); child?.once('exit', code => yes(code ?? 1)); });
} catch (error) { console.error(error instanceof Error ? error.message : 'Falha no PostgreSQL de teste.'); process.exitCode = 1; }
finally {
  if (directory) {
    let stopped = false;
    try { run('pg_ctl', ['-D', join(directory, 'data'), '-m', 'fast', '-w', '-t', '10', 'stop']); stopped = true; }
    catch { console.error('Falha ao encerrar o cluster PostgreSQL isolado. Confira test-results/postgres.'); process.exitCode = 1; }
    // Remove only this invocation's data after pg_ctl confirms it stopped; retain its log.
    const data = resolve(directory, 'data'), parent = realpathSync(resolve('test-results/postgres'));
    if (stopped && dirname(realpathSync(directory)) === parent && dirname(data) === realpathSync(directory) && !lstatSync(data).isSymbolicLink()) rmSync(data, { recursive: true });
  }
}
