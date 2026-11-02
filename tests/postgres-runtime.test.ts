import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { connect } from 'node:net';

function isolatedEnv() {
  const env = { ...process.env };
  delete env.DROCSID_TEST_DATABASE_URL;
  return env;
}

test('MERGE-19: missing PostgreSQL fails instead of skipping or using SQLite', () => {
  const child = spawnSync(process.execPath, ['scripts/with-test-postgres.mjs', '--', 'node', '-e', 'process.exitCode=0'], {
    env: { ...isolatedEnv(), DROCSID_PG_BIN: resolve('test-results/nonexistent-postgres-bin') }, encoding: 'utf8', windowsHide: true, timeout: 8000,
  });
  assert.equal(child.status, 1);
  assert.match(child.stderr, /PostgreSQL real obrigatório/);
  assert.doesNotMatch(child.stdout, /SQLite|skip/i);
});

test('MERGE-19: a failing child retains its exit code and leaves no PostgreSQL listener', async () => {
  const child = spawnSync(process.execPath, ['scripts/with-test-postgres.mjs', '--', 'node', '-e', 'process.exitCode=7'], {
    env: isolatedEnv(), encoding: 'utf8', windowsHide: true, timeout: 15000,
  });
  assert.equal(child.status, 7);
  const match = child.stdout.match(/127\.0\.0\.1:(\d+), SCRAM/);
  assert.ok(match, 'The wrapper must have started real PostgreSQL before the failing child');
  await assert.rejects(new Promise<void>((yes, no) => {
    const socket = connect(Number(match[1]), '127.0.0.1');
    socket.once('error', no); socket.once('connect', () => { socket.destroy(); yes(); });
  }), error => error instanceof Error && 'code' in error && error.code === 'ECONNREFUSED');
});
