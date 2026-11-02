import {mkdtempSync,rmSync,readFileSync,existsSync,lstatSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,dirname,basename} from 'node:path';

type Environment=Record<string,string|undefined>;
type Desktop={close():Promise<void>;process():{kill():unknown}|null};
export function testEnvironment(env:Environment=process.env):Record<string,string> {
  return Object.fromEntries(Object.entries(env).filter((entry):entry is [string,string]=>entry[1]!==undefined));
}
export type BuildManifest={version:string;sha256:string;portable:string;executable:string};
export function readBuildManifest(path='test-results/build.json'):BuildManifest {
  const value:unknown=JSON.parse(readFileSync(path,'utf8'));
  if(value===null||typeof value!=='object'||!('version' in value)||typeof value.version!=='string'||!value.version||!('sha256' in value)||typeof value.sha256!=='string'||!/^[a-f0-9]{64}$/.test(value.sha256)||!('portable' in value)||typeof value.portable!=='string'||!value.portable||!('executable' in value)||typeof value.executable!=='string'||!value.executable)throw new Error('Invalid build manifest');
  return {version:value.version,sha256:value.sha256,portable:value.portable,executable:value.executable};
}
export function readFlag(name:string,fallback=false,env:Environment=process.env):boolean {
  if(env[name]===undefined)return fallback;if(env[name]==='1')return true;if(env[name]==='0')return false;throw new Error(`${name} must be 0 or 1`);
}
export function desktopTarget(env:Environment=process.env):{args:string[];executablePath?:string} {
  if(readFlag('CONVERSA_CHECK_SOURCE',!env.CONVERSA_TEST_EXECUTABLE,env))return {args:[resolve('.')]};
  let executable=env.CONVERSA_TEST_EXECUTABLE;
  if(!executable){const value:unknown=JSON.parse(readFileSync(env.CONVERSA_BUILD_MANIFEST??'test-results/build.json','utf8'));if(value===null||typeof value!=='object'||!('executable' in value)||typeof value.executable!=='string')throw new Error('Build manifest requires an executable');executable=value.executable;}
  return {executablePath:resolve(executable),args:[]};
}
async function deadline<T>(operation:()=>T,milliseconds:number):Promise<Awaited<T>> {
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{return await Promise.race([Promise.resolve().then(operation),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Test cleanup timed out')),milliseconds);})]);}
  finally{clearTimeout(timer);}
}
export async function closeDesktop(desktop:Desktop|undefined):Promise<void> {
  if(!desktop)return;try{await deadline(()=>desktop.close(),4000);}catch(error){desktop.process()?.kill();throw error;}
}
export async function closeResources(cleanups:(()=>unknown)[]):Promise<void> {
  const results=await Promise.allSettled(cleanups.map(cleanup=>deadline(cleanup,4500))),errors=results.filter(result=>result.status==='rejected').map(result=>result.reason);
  if(errors.length)throw new AggregateError(errors,'Test cleanup failed');
}
export const createTestProfile=()=>mkdtempSync(join(tmpdir(),'conversa-test-'));
export function removeTestProfile(profile:string):void {
  profile=resolve(profile);
  if(dirname(profile)!==resolve(tmpdir())||!basename(profile).startsWith('conversa-test-')||(existsSync(profile)&&lstatSync(profile).isSymbolicLink()))throw new Error('Unsafe test profile cleanup target');
  rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});
}
