import pg from 'pg';
import { randomUUID } from 'node:crypto';
import type { TestContext } from 'node:test';
import { createDatabase } from '../../server/database.js';
import type { Database } from '../../server/database.js';

export async function postgresFixture(t: Pick<TestContext, 'after'>) {
  const configured = process.env.DROCSID_TEST_DATABASE_URL;
  if (!configured) throw new Error('Execute via npm test ou scripts/with-test-postgres.mjs; PostgreSQL real é obrigatório.');
  const url = new URL(configured);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('Testes PostgreSQL exigem um servidor local isolado.');
  const admin = new pg.Pool({ connectionString: url.href, max: 1 });
  const name = `drocsid_test_${randomUUID().replaceAll('-', '')}`;
  if (!/^drocsid_test_[a-f0-9]{32}$/.test(name)) throw new Error('Unsafe test database');
  await admin.query(`CREATE DATABASE "${name}"`);
  url.pathname = `/${name}`;
  const inspection = new pg.Pool({ connectionString: url.href, max: 1 });
  const databases = new Set<Database>();
  t.after(async () => {
    try {
      await Promise.all([...databases].map(database => database.close()));
      await inspection.end();
      await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    }
    finally { await admin.end(); }
  });
  return { url: url.href, name, admin, async inspect(sql: string, values: readonly unknown[] = []) {
    return (await inspection.query<Record<string, unknown>>(sql, [...values])).rows;
  }, async open() {
    const database = await createDatabase({ DATABASE_URL: url.href });
    databases.add(database);
    return database;
  } };
}
