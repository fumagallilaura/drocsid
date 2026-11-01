import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,openSync,closeSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {readBuildManifest,testEnvironment} from './test-runtime.mjs';

// Reuse the built candidate. Rebuilding here would give each proof a different EXE.
const manifest=readBuildManifest(),npm=process.env.npm_execpath??resolve(process.execPath,'../node_modules/npm/bin/npm-cli.js');
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty=execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim()!=='';
const env=testEnvironment();
for(const key of Object.keys(env))if(key.startsWith('CONVERSA_')||key.startsWith('DROCSID_HOST')||key==='ELECTRON_RUN_AS_NODE')delete env[key];
const source={CONVERSA_CHECK_SOURCE:'1'},packaged={CONVERSA_CHECK_SOURCE:'0',CONVERSA_TEST_EXECUTABLE:manifest.executable};
const gates:{name:string;args:string[];env?:Record<string,string>}[]=[
  {name:'node',args:[npm,'test']},
  {name:'build',args:[npm,'run','build']},
  {name:'package',args:['scripts/check-package.mjs']},
  {name:'smoke-source',args:['scripts/desktop-smoke.mjs'],env:source},
  {name:'smoke-external-source',args:['scripts/desktop-smoke.mjs'],env:{...source,CONVERSA_TEST_EXTERNAL:'1'}},
  {name:'smoke-packaged',args:['scripts/desktop-smoke.mjs'],env:packaged},
  {name:'smoke-external-packaged',args:['scripts/desktop-smoke.mjs'],env:{...packaged,CONVERSA_TEST_EXTERNAL:'1'}},
  {name:'profile-source',args:['scripts/desktop-profile-check.mjs'],env:source},
  {name:'profile-packaged',args:['scripts/desktop-profile-check.mjs'],env:packaged},
  {name:'startup-source',args:['scripts/startup-audio-check.mjs'],env:{...source,CONVERSA_CHECK_MUTED:'1'}},
  {name:'startup-packaged',args:['scripts/startup-audio-check.mjs'],env:{...packaged,CONVERSA_CHECK_MUTED:'1'}},
  {name:'capture',args:['scripts/desktop-capture-check.mjs'],env:source},
  {name:'lifecycle-source',args:['scripts/desktop-lifecycle-check.mjs'],env:source},
  {name:'lifecycle-packaged',args:['scripts/desktop-lifecycle-check.mjs'],env:packaged},
  {name:'portable',args:['scripts/portable-startup-check.mjs']},
  {name:'accounts',args:['scripts/desktop-accounts-check.mjs'],env:source},
  {name:'client',args:['scripts/desktop-client-check.mjs'],env:source},
  {name:'security',args:['scripts/security-check.mjs']},
];
mkdirSync('test-results/release',{recursive:true});
const results=[];
for(const gate of gates){
  console.log(`Running release gate: ${gate.name}`);
  const log=`test-results/release/${gate.name}.log`,fd=openSync(log,'w'),started=Date.now();
  let code:number|null;
  try{
    const child=spawn(process.execPath,gate.args,{env:{...env,...gate.env},stdio:['ignore',fd,fd],windowsHide:true});
    code=await new Promise<number|null>((yes,no)=>{child.once('error',no);child.once('exit',yes);});
  }finally{closeSync(fd);}
  results.push({name:gate.name,args:gate.args,env:gate.env,code,log,milliseconds:Date.now()-started});
  writeFileSync('test-results/release-matrix.json',JSON.stringify({at:new Date().toISOString(),head,dirty,sha256:manifest.sha256,results,physical:'PENDING'},null,2));
  assert.equal(code,0,`Release gate failed: ${gate.name}; see ${log}`);
  console.log(`PASS release gate: ${gate.name}`);
}
assert.equal(createHash('sha256').update(readFileSync(manifest.portable)).digest('hex'),manifest.sha256,'Candidate changed during validation');
const physical=readFileSync('.specs/features/captura-midia-saida/uat.md','utf8');
assert.match(physical,/T9 incompleta; MEDIA-33\/34 sem Verified/);assert.match(physical,/dois PCs Windows/);assert.match(physical,/dois operadores/);
console.log(`PENDING: physical T9 requires two Windows PCs on a trusted LAN, real headsets/microphones and two operators; candidate SHA256 ${manifest.sha256}. Noise, echo and loopback remain unapproved.`);
console.log('PASS: MERGE-02 source, packaged and portable run the single Drocsid application.');
console.log('PASS: MERGE-14 source and packaged media ownership, deadlines, playback and camera denial regressions passed.');
console.log('PASS: MERGE-15 current emitted modules and bundles match the ASAR and portable SHA256.');
console.log('PASS: MERGE-16 negative authorization and session tests and dependency audits passed; independent review is a separate required gate.');
console.log('PASS: MERGE-17 physical acceptance remains pending and the current candidate is identified by SHA256.');
console.log('PASS: MERGE-18 one PostgreSQL backend serves the unified source, packaged and portable product.');
console.log('PASS: MERGE-21 verified database TLS and credential isolation tests passed, including the default client without PostgreSQL.');
