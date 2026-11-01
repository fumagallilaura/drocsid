import type { TestContext } from 'node:test';
import { createService } from '../../server/service.js';
import { postgresFixture } from './postgres.js';
import { importSqlite } from '../../scripts/import-sqlite.mjs';
import assert from 'node:assert/strict';
import type {Server} from 'node:net';

export function testPort(server:Pick<Server,'address'>):number {
  const address=server.address();assert.ok(address&&typeof address==='object');return address.port;
}

type Fixture = Awaited<ReturnType<typeof postgresFixture>>;
type Options = Parameters<typeof createService>[0] & { fixture?:Fixture; sqliteSource?:string };
export async function startService(t:Pick<TestContext,'after'>, options:Options={}) {
  let service:Awaited<ReturnType<typeof createService>>|undefined;
  t.after(()=>service?.close());
  const fixture=options.fixture??await postgresFixture(t), database=options.database??await fixture.open();
  if(options.sqliteSource)await importSqlite(options.sqliteSource,database);
  service=await createService({trustedLocal:true,iceServers:[],...options,database});
  await new Promise<void>((resolve,reject)=>{service?.server.once('error',reject);service?.server.listen(0,'127.0.0.1',resolve);});
  const address=service.server.address();if(!address||typeof address==='string')throw new Error('Test listener unavailable');
  return {...service,fixture,url:`ws://127.0.0.1:${address.port}/ws`,origin:`http://127.0.0.1:${address.port}`};
}
