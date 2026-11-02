import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

// A criterion with several failure modes requires every named case, not only
// one convenient passing line from its suite. The cases retain their assertions.
const groups=[
  {claim:'MERGE-07',files:['tests/authorization.test.js','tests/identity.test.js'],tests:[
    'MERGE-07: logout closes every owned media connection while another session remains usable',
    'MERGE-07: observed session expiry terminates signaling and cannot be revived by a pong',
    'MERGE-07: concurrent logout and ticket consumption never leave a reusable session',
    'MERGE-07: expired or revoked sessions cannot be reused',
    'MERGE-07: session inspection never extends idle expiry and shutdown drains pending hashing',
  ]},
  {claim:'MERGE-08',files:['tests/authorization.test.js'],tests:[
    'MERGE-08: network access and websocket tickets require authentication',
    'MERGE-08: explicit trusted guests require a real loopback listener and host',
  ]},
  {claim:'MERGE-11',files:['tests/identity.test.js'],tests:[
    'MERGE-11: invites expire and are consumed once atomically',
    'MERGE-11: failed membership rolls back invitation consumption',
  ]},
  {claim:'MERGE-19',files:['tests/database.test.js','tests/identity.test.js','tests/authorization.test.js'],tests:[
    'MERGE-19: PostgreSQL commits, survives reconnect and rolls back incomplete work',
    'MERGE-19/12: concurrent writers return one immutable receipt only to its owner',
    'MERGE-19: history returns the last 200 messages in their insertion sequence',
    'MERGE-19: concurrent migrations apply once and reject unknown or altered versions',
    'MERGE-19: closing interrupts active queries and refuses later work without pool leaks',
    'MERGE-19: failed DDL rolls back every table and its migration record',
    'MERGE-19: shutting down one pool preserves another owner on the same database',
    'MERGE-19: identity migration upgrades a version-one database without changing legacy data',
    'MERGE-19: service shutdown interrupts PostgreSQL work and closes its pool',
  ]},
  {claim:'MERGE-20',files:['tests/import-sqlite.test.js'],tests:[
    'MERGE-20: legacy SQLite imports preserve data and source bytes atomically',
    'MERGE-20/12: concurrent imports consume one snapshot without crediting guests to accounts',
    'MERGE-20: conflicting room, message, operation or sequence never overwrites the target',
    'MERGE-20: a previous import fingerprint never hides a later target conflict',
    'MERGE-20: a database failure after room insertion rolls back the whole import',
    'MERGE-20: future schema, unsafe integers and corrupt input are rejected without partial data',
    'MERGE-20/21: the explicit import CLI reports counts without printing credentials',
  ]},
];
const escape=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
for(const group of groups){
  const pattern=`^(?:${group.tests.map(escape).join('|')})$`;
  const run=spawnSync(process.execPath,['--test','--test-reporter=spec',`--test-name-pattern=${pattern}`,...group.files],{encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024});
  process.stdout.write(run.stdout??'');process.stderr.write(run.stderr??'');
  assert.equal(run.error,undefined,`${group.claim} could not run`);assert.equal(run.status,0,`${group.claim} has a failed case`);
  for(const name of group.tests)assert.match(run.stdout,new RegExp(`^✔ ${escape(name)} \\(`,'m'),`Missing passing case: ${name}`);
  assert.match(run.stdout,new RegExp(`^ℹ tests ${group.tests.length}$`,'m'));
  for(const field of ['fail','cancelled','skipped','todo'])assert.match(run.stdout,new RegExp(`^ℹ ${field} 0$`,'m'));
  console.log(`PASS: ${group.claim} every required lifecycle and failure case ran and passed.`);
}
