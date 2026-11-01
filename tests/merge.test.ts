import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {parse} from '@babel/parser';
import {parse as parseYaml} from 'yaml';
import metadata from '../package.json' with {type:'json'};
import {isRecord} from './helpers/assertions.js';

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

test('MERGE-03: every maintained source is covered by strict TypeScript',()=>{
  const files=spawnSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'});assert.equal(files.status,0);
  const sources=[...new Set(files.stdout.split('\0'))].filter(file=>/\.(?:[cm]?ts|tsx|[cm]?js|jsx)$/.test(file)&&file!=='review/main.formatted.jsx'&&file!=='review/build/assets/index-BiVaq4qq.js');
  assert.ok(sources.length>50);
  const covered=new Set<string>();
  for(const config of ['tsconfig.json','tsconfig.browser.json','tsconfig.electron.json','tsconfig.tools.json']){
    const settings=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','-p',config,'--showConfig'],{encoding:'utf8'});assert.equal(settings.status,0,settings.stderr);
    const parsed:unknown=JSON.parse(settings.stdout);assert.ok(parsed!==null&&typeof parsed==='object'&&'compilerOptions' in parsed&&parsed.compilerOptions!==null&&typeof parsed.compilerOptions==='object'&&'strict' in parsed.compilerOptions&&'noEmitOnError' in parsed.compilerOptions);
    assert.equal(parsed.compilerOptions.strict,true,config);assert.equal(parsed.compilerOptions.noEmitOnError,true,config);
    assert.equal('noCheck' in parsed.compilerOptions?parsed.compilerOptions.noCheck:false,false,config);
    assert.equal('skipLibCheck' in parsed.compilerOptions?parsed.compilerOptions.skipLibCheck:false,false,config);
    const listing=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','-p',config,'--listFilesOnly'],{encoding:'utf8'});assert.equal(listing.status,0,listing.stdout+listing.stderr);
    for(const file of listing.stdout.trim().split(/\r?\n/))covered.add(resolve(file).toLowerCase());
  }
  for(const file of sources){
    assert.match(file,/\.(?:[cm]?ts|tsx)$/,`Maintained JavaScript source: ${file}`);assert.equal(covered.has(resolve(file).toLowerCase()),true,`Not typechecked: ${file}`);
    const tree=parse(readFileSync(file,'utf8'),{sourceType:'module',plugins:['typescript','jsx','importAttributes']});
    for(const comment of tree.comments??[])assert.doesNotMatch(comment.value,/@ts-(?:ignore|nocheck|expect-error)\b/,file);
    function inspect(value:unknown):void {
      if(!value||typeof value!=='object')return;
      if('type' in value)assert.notEqual(value.type,'TSAnyKeyword',`Explicit any: ${file}`);
      for(const[key,child]of Object.entries(value))if(!['loc','start','end','extra'].includes(key)){if(Array.isArray(child))child.forEach(inspect);else inspect(child);}
    }
    inspect(tree);
  }
});

test('MERGE-02: Drocsid is the single application metadata',()=>{
  assert.equal(metadata.name,'drocsid');assert.equal(metadata.main,'electron/main.js');assert.equal(metadata.build.productName,'Drocsid');assert.equal(metadata.build.appId,'app.drocsid.desktop');
  assert.deepEqual(metadata.build.win.target,'portable');assert.match(readFileSync('index.html','utf8'),/<title>Drocsid<\/title>/);
});

test('MERGE-18: the unified product has no parallel unused backend',()=>{
  const tracked=spawnSync('git',['ls-files','--cached','--others','--exclude-standard','-z','--','apps'],{encoding:'utf8'});assert.equal(tracked.status,0);assert.equal(tracked.stdout,'');assert.equal('workspaces' in metadata,false);
  const lock:unknown=JSON.parse(readFileSync('package-lock.json','utf8'));assert.ok(isRecord(lock)&&isRecord(lock.packages));assert.equal(Object.keys(lock.packages).some(name=>name.startsWith('apps/')),false);
  const service=readFileSync('server/database.ts','utf8');assert.match(service,/from 'pg'/);assert.doesNotMatch(service,/node:sqlite|DB_PATH/);
  const compose:unknown=parseYaml(readFileSync('docker-compose.yml','utf8'));assert.ok(isRecord(compose)&&isRecord(compose.services)&&isRecord(compose.services.db));const db=compose.services.db;
  assert.match(String(db.image),/^postgres:17\.11@sha256:[a-f0-9]{64}$/);assert.deepEqual(db.ports,['127.0.0.1:5432:5432']);
  assert.ok(isRecord(db.environment));assert.equal('POSTGRES_PASSWORD' in db.environment,false);assert.equal(db.environment.POSTGRES_PASSWORD_FILE,'/run/secrets/postgres_password');assert.deepEqual(db.secrets,['postgres_password']);
  assert.ok(isRecord(compose.secrets)&&isRecord(compose.secrets.postgres_password));assert.match(String(compose.secrets.postgres_password.file),/^\$\{DROCSID_POSTGRES_PASSWORD_FILE:\?[^}]+\}$/);
});
