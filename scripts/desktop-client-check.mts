import {_electron as electron} from 'playwright';
import type {ElectronApplication} from 'playwright';
import {expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createTestProfile,removeTestProfile,closeDesktop} from './test-runtime.mjs';

for(const modern of [false,true]){
const profile=createTestProfile(),legacy=join(profile,'conversa'),databasePath=join(legacy,'conversa.sqlite');
const preferences={name:'Ana',server:'https://group.example',quality:'720'},preferencesPath=join(legacy,'preferences.json');
const hash=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex');
let desktop:ElectronApplication|undefined;
try{
  mkdirSync(legacy,{recursive:true});writeFileSync(preferencesPath,JSON.stringify(preferences));
  const database=new DatabaseSync(databasePath);database.exec("CREATE TABLE rooms(id TEXT PRIMARY KEY,name TEXT,description TEXT); INSERT INTO rooms VALUES ('old','Antiga','Preservar'); CREATE TABLE messages(id TEXT PRIMARY KEY,room TEXT,author TEXT,text TEXT,created INTEGER); INSERT INTO messages VALUES ('old-message','old','Ana','Legado intacto',1700000000000);");
  if(modern)database.exec("ALTER TABLE messages ADD COLUMN authorId TEXT; ALTER TABLE messages ADD COLUMN operationId TEXT; ALTER TABLE messages ADD COLUMN sequence INTEGER; UPDATE messages SET authorId='legacy-ana',operationId='legacy-receipt',sequence=37; PRAGMA user_version=1;");
  database.close();
  const before={database:hash(databasePath),preferences:hash(preferencesPath)};
  const env:Record<string,string>={DROCSID_TEST_APP_DATA:profile,DATABASE_URL:'postgres://must-not-be-used:fictional@127.0.0.1:1/unavailable'};
  for(const [name,value]of Object.entries(process.env))if(value!==undefined&&!(name in env))env[name]=value;
  delete env.ELECTRON_RUN_AS_NODE;delete env.DROCSID_HOST;delete env.DROCSID_TRUSTED_LOCAL;
  await assert.doesNotReject(async()=>{desktop=await electron.launch({args:[resolve('tests/fixtures/profile-main.mjs'),`--user-data-dir=${join(profile,'bootstrap')}`,'--use-fake-device-for-media-stream','--mute-audio'],env,timeout:15000});await desktop.firstWindow();},'The client must open without PostgreSQL');
  assert.ok(desktop);
  const page=await desktop.firstWindow();await expect(page.getByRole('heading',{name:'Vamos nos encontrar?'})).toBeVisible();
  assert.deepEqual(await desktop.evaluate(({app})=>({name:app.getName(),profile:app.getPath('userData')})),{name:'Drocsid',profile:legacy});
  assert.match(await page.title(),/Drocsid/);
  assert.deepEqual(await page.evaluate(()=>window.desktop?.preferences),preferences);
  const config=await page.evaluate(async()=>{const response=await fetch('/api/config'),body:unknown=await response.json();if(body===null||typeof body!=='object'||!('code' in body))throw new Error('Invalid client response');return {status:response.status,code:body.code,exposesIce:'iceServers' in body};});
  assert.equal(config.status,404);assert.equal(config.code,'SERVER_REQUIRED');assert.equal(config.exposesIce,false);
  assert.equal(await page.evaluate(()=>typeof Reflect.get(window,'process')),'undefined');
  assert.equal((await page.evaluate(()=>JSON.stringify(window.desktop)))?.includes('must-not-be-used'),false);
  const nativeWindow=await desktop.browserWindow(page),isolation=await nativeWindow.evaluate(window=>window.webContents.getLastWebPreferences());
  assert.equal(isolation.contextIsolation,true);assert.equal(isolation.nodeIntegration,false);assert.equal(isolation.sandbox,true);
  await page.reload();await expect(page.getByRole('heading',{name:'Vamos nos encontrar?'})).toBeVisible();
  assert.deepEqual({database:hash(databasePath),preferences:hash(preferencesPath)},before);
  await closeDesktop(desktop);desktop=undefined;
  assert.deepEqual({database:hash(databasePath),preferences:hash(preferencesPath)},before);
}finally{try{await closeDesktop(desktop);}finally{removeTestProfile(profile);}}
}
console.log('PASS: Drocsid client opens without PostgreSQL, keeps credentials outside renderer and preserves the legacy default profile and database bytes.');
