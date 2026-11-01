import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

type Counts={info:number;low:number;moderate:number;high:number;critical:number;total:number};
function record(value:unknown):value is Record<string,unknown>{return value!==null&&typeof value==='object'&&!Array.isArray(value);}
export function validateAudit(value:unknown,mode:'all'|'production'):Counts {
  assert.ok(record(value)&&!value.error&&record(value.metadata)&&record(value.metadata.vulnerabilities)&&record(value.vulnerabilities),'Invalid audit result');
  const counts=value.metadata.vulnerabilities;
  for(const key of ['info','low','moderate','high','critical','total'])assert.ok(typeof counts[key]==='number'&&Number.isSafeInteger(counts[key])&&counts[key]>=0,'Invalid audit result');
  const {info,low,moderate,high,critical,total}=counts;
  assert.ok(typeof info==='number'&&typeof low==='number'&&typeof moderate==='number'&&typeof high==='number'&&typeof critical==='number'&&typeof total==='number','Invalid audit result');
  assert.equal(total,info+low+moderate+high+critical,'Invalid audit result');
  assert.equal(high+critical,0,'Unresolved high or critical dependency findings');
  if(mode==='production')assert.equal(total,0,'Production dependency findings');
  return {info,low,moderate,high,critical,total};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  const cli=process.env.npm_execpath??resolve(process.execPath,'../node_modules/npm/bin/npm-cli.js');
  const audits=[];
  for(const mode of ['all','production'] as const){
    const run=spawnSync(process.execPath,[cli,'audit',...(mode==='production'?['--omit=dev']:[]),'--json'],{encoding:'utf8',maxBuffer:8*1024*1024,timeout:120000});
    assert.ok(!run.error&&(run.status===0||run.status===1),'Dependency audit failed to complete');
    const result:unknown=JSON.parse(run.stdout);
    const counts=validateAudit(result,mode);audits.push({mode,counts,result});
    console.log(`Audit ${mode}: ${JSON.stringify(counts)}`);
  }
  mkdirSync('test-results',{recursive:true});
  writeFileSync('test-results/security-audit.json',JSON.stringify({at:new Date().toISOString(),lockSha256:createHash('sha256').update(readFileSync('package-lock.json')).digest('hex'),audits},null,2));
  console.log('PASS: dependency audits completed; production has no findings and all dependencies have no high or critical findings.');
}
