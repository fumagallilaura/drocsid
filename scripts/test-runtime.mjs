import { mkdtempSync, rmSync, readFileSync, existsSync, lstatSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, dirname, basename } from 'node:path';

export function readFlag(name, fallback = false, env = process.env) {
  if (env[name] === undefined) return fallback;
  if (env[name] === '1') return true;
  if (env[name] === '0') return false;
  throw new Error(`${name} must be 0 or 1`);
}
export function desktopTarget(env = process.env) {
  if (readFlag('CONVERSA_CHECK_SOURCE', !env.CONVERSA_TEST_EXECUTABLE, env)) return { args: [resolve('.')] };
  const executablePath = env.CONVERSA_TEST_EXECUTABLE || JSON.parse(readFileSync(env.CONVERSA_BUILD_MANIFEST || 'test-results/build.json', 'utf8')).executable;
  return { executablePath: resolve(executablePath), args: [] };
}
async function deadline(operation, milliseconds) {
  let timer;
  try { return await Promise.race([Promise.resolve().then(operation), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Test cleanup timed out')), milliseconds); })]); }
  finally { clearTimeout(timer); }
}
export async function closeDesktop(desktop) {
  if (!desktop) return;
  try { await deadline(() => desktop.close(), 4000); }
  catch (error) { desktop.process()?.kill(); throw error; }
}
export async function closeResources(cleanups) {
  const results = await Promise.allSettled(cleanups.map(cleanup => deadline(cleanup, 4500)));
  const errors = results.filter(result => result.status === 'rejected').map(result => result.reason);
  if (errors.length) throw new AggregateError(errors, 'Test cleanup failed');
}
export const createTestProfile = () => mkdtempSync(join(tmpdir(), 'conversa-test-'));
export function removeTestProfile(profile) {
  profile = resolve(profile);
  if (dirname(profile) !== resolve(tmpdir()) || !basename(profile).startsWith('conversa-test-') ||
      (existsSync(profile) && lstatSync(profile).isSymbolicLink())) throw new Error('Unsafe test profile cleanup target');
  rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}
