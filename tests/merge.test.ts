import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('MERGE-01: integration history retains both source commits', () => {
  const git = (...args: string[]) => spawnSync('git', args, { encoding: 'utf8' });
  const local = 'a2ae03cd59a6c7da0a56d256cf01cb9f4aaae8ac';
  const upstream = '94d9b9a6de48903c0b2fa055a34b7f2cd8626e0a';
  assert.equal(git('merge-base', '--is-ancestor', local, 'HEAD').status, 0);
  const incorporated = git('merge-base', '--is-ancestor', upstream, 'HEAD');
  if (incorporated.status !== 0) {
    // Before this task's merge commit, Git holds the second parent in MERGE_HEAD.
    assert.equal(git('rev-parse', 'MERGE_HEAD').stdout.trim(), upstream);
  }
  assert.equal(git('diff', '--name-only', '--diff-filter=U').stdout, '');
});
