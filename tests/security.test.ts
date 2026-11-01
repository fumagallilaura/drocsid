import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAudit} from '../scripts/security-check.mjs';

test('MERGE-16: audit gates reject high or critical findings and incomplete registry results',()=>{
  const clean={metadata:{vulnerabilities:{info:0,low:0,moderate:0,high:0,critical:0,total:0}},vulnerabilities:{}};
  assert.deepEqual(validateAudit(clean,'production'),clean.metadata.vulnerabilities);
  for(const severity of ['high','critical'] as const){const report={...clean,metadata:{vulnerabilities:{...clean.metadata.vulnerabilities,[severity]:1,total:1}}};assert.throws(()=>validateAudit(report,'all'),/Unresolved high or critical/);assert.throws(()=>validateAudit(report,'production'),/Unresolved high or critical/);}
  const moderate={...clean,metadata:{vulnerabilities:{...clean.metadata.vulnerabilities,moderate:2,total:2}}};assert.deepEqual(validateAudit(moderate,'all'),moderate.metadata.vulnerabilities);assert.throws(()=>validateAudit(moderate,'production'),/Production dependency findings/);
  for(const report of [null,{}, {error:{code:'NETWORK_FAILED'}}, {...clean,metadata:{}},{...clean,metadata:{vulnerabilities:{...clean.metadata.vulnerabilities,total:-1}}}])assert.throws(()=>validateAudit(report,'all'),/Invalid audit result/);
});
