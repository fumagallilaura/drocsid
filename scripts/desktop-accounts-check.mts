import {_electron as electron} from 'playwright';
import type {ElectronApplication,Page} from 'playwright';
import {expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createPostgresFixture} from '../tests/helpers/postgres.js';
import {createService} from '../server/service.js';
import {createTestProfile,removeTestProfile,closeDesktop} from './test-runtime.mjs';

const profile=createTestProfile(),password='uma senha longa e exclusiva',errors:string[]=[],tokens:string[]=[];
let desktop:ElectronApplication|undefined,postgres:Awaited<ReturnType<typeof createPostgresFixture>>|undefined,service:Awaited<ReturnType<typeof createService>>|undefined;
async function instrument(page:Page) {
  page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{
    if(!/\/api\/auth\/(login|register)$/.test(response.url())||!response.ok())return;
    void (async()=>{const value:unknown=await response.json();assert.ok(value!==null&&typeof value==='object'&&'token' in value&&typeof value.token==='string');tokens.push(value.token);})().catch(error=>errors.push(String(error)));
  });
  await page.evaluate(()=>{window.__accountTracks=[];const get=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async constraints=>{const stream=await get(constraints);window.__accountTracks.push(...stream.getTracks());return stream;};});
}
async function register(page:Page,origin:string,username:string) {
  await expect(page.getByRole('heading',{name:'Vamos nos encontrar?'})).toBeVisible();
  await page.getByLabel('Servidor do grupo').fill(origin);await page.getByRole('button',{name:'Criar uma conta',exact:true}).click();
  await page.getByLabel('Usuário', {exact:true}).fill(username);await page.getByLabel('Senha',{exact:true}).fill(password);await page.getByRole('button',{name:'Criar conta',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Crie ou entre em um grupo'})).toBeVisible();
}
async function createGroup(page:Page,name:string) {
  await page.getByRole('button',{name:'Criar grupo',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Um grupo para conversar'});
  await dialog.getByLabel('Nome do grupo').fill(name);await dialog.getByRole('button',{name:'Criar grupo',exact:true}).click();
  await expect(dialog).toHaveCount(0);await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'geral',exact:true})).toBeVisible();
}
async function logout(page:Page) {
  await page.getByRole('button',{name:'Configurações',exact:true}).click();await page.getByRole('button',{name:'Sair e trocar de servidor',exact:true}).click();await expect(page.getByRole('heading',{name:'Vamos nos encontrar?'})).toBeVisible();
}
try{
  postgres=await createPostgresFixture();service=await createService({database:await postgres.open(),trustedLocal:false,iceServers:[]});
  await new Promise<void>(resolve=>service?.server.listen(0,'127.0.0.1',resolve));const address=service.server.address();assert.ok(address&&typeof address==='object');const origin=`http://127.0.0.1:${address.port}`;
  const env:Record<string,string>={};for(const[name,value]of Object.entries(process.env))if(value!==undefined&&name!=='ELECTRON_RUN_AS_NODE'&&!name.includes('DATABASE_URL')&&!name.startsWith('PG')&&!name.startsWith('DROCSID_'))env[name]=value;
  desktop=await electron.launch({args:[resolve('.'),`--user-data-dir=${profile}`,'--use-fake-device-for-media-stream','--mute-audio'],env,timeout:15000});
  const first=await desktop.firstWindow();await instrument(first);
  const stale=Promise.withResolvers<void>(),release=Promise.withResolvers<void>(),released=Promise.withResolvers<void>();let intercepted=false;
  await first.route('**/api/groups',async route=>{
    if(intercepted||route.request().method()!=='GET'){await route.continue();return;}
    intercepted=true;const response=await route.fetch();const snapshot:unknown=await response.json();assert.deepEqual(snapshot,{groups:[]});stale.resolve();
    await release.promise;await route.fulfill({response});released.resolve();
  });
  await register(first,origin,'ana');await stale.promise;await createGroup(first,'Equipe A');
  release.resolve();await released.promise;
  await first.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  await expect(first.getByRole('button',{name:'Abrir grupo Equipe A',exact:true})).toBeVisible();
  const opened=desktop.waitForEvent('window');await desktop.evaluate(({Menu})=>Menu.getApplicationMenu()?.items[0].submenu?.items[0].click());const second=await opened;await instrument(second);
  await register(second,origin,'bia');await createGroup(second,'Equipe B');
  await second.getByLabel('Mensagem',{exact:true}).fill('Texto privado B');await second.getByRole('button',{name:'Enviar mensagem',exact:true}).click();await expect(second.getByText('Texto privado B',{exact:true})).toHaveCount(1);await expect(first.getByText('Texto privado B',{exact:true})).toHaveCount(0);
  await expect(first.getByRole('button',{name:'Abrir grupo Equipe B',exact:true})).toHaveCount(0);
  await first.getByRole('button',{name:'Convidar',exact:true}).click();const invite=first.getByRole('dialog',{name:'Convite do grupo'});const code=await invite.getByLabel('Código do convite',{exact:true}).inputValue();assert.match(code,/^[A-Za-z0-9_-]{43}$/);
  await desktop.evaluate(({clipboard})=>clipboard.writeText('DROCSID_TEST_CLIPBOARD'));
  await invite.getByRole('button',{name:'Copiar código',exact:true}).click();await expect(first.getByText('Código copiado.',{exact:true})).toBeVisible();await invite.getByRole('button',{name:'Fechar',exact:true}).click();
  await second.getByRole('button',{name:'Entrar em grupo',exact:true}).click();const accept=second.getByRole('dialog',{name:'Entrar em um grupo'});
  await accept.getByLabel('Código do convite',{exact:true}).fill('x'.repeat(43));await accept.getByRole('button',{name:'Entrar no grupo',exact:true}).click();await expect(second.getByText('Convite inválido, expirado ou já usado.',{exact:true})).toBeVisible();
  await accept.getByLabel('Código do convite',{exact:true}).fill('');await accept.getByLabel('Código do convite',{exact:true}).focus();await second.keyboard.press('Control+V');await expect(accept.getByLabel('Código do convite',{exact:true})).toHaveValue(code);
  await accept.getByRole('button',{name:'Entrar no grupo',exact:true}).click();await expect(accept).toHaveCount(0);await expect(second.getByRole('heading',{name:'Equipe A',exact:true})).toBeVisible();
  await expect(second.getByRole('button',{name:'Adicionar sala',exact:true})).toBeDisabled();await expect(second.getByRole('button',{name:'Convidar',exact:true})).toBeDisabled();
  await second.getByLabel('Mensagem',{exact:true}).fill('Agora no grupo A');await second.getByRole('button',{name:'Enviar mensagem',exact:true}).click();await expect(first.getByText('Agora no grupo A',{exact:true})).toHaveCount(1);await expect(second.getByText('Texto privado B',{exact:true})).toHaveCount(0);
  await expect(first.locator('.message').filter({hasText:'Agora no grupo A'}).locator('.message-meta strong')).toHaveText('bia');
  await second.getByRole('button',{name:'Entrar em grupo',exact:true}).click();await accept.getByLabel('Código do convite',{exact:true}).fill(code);await accept.getByRole('button',{name:'Entrar no grupo',exact:true}).click();await expect(second.getByText('Convite inválido, expirado ou já usado.',{exact:true})).toBeVisible();await accept.getByRole('button',{name:'Fechar',exact:true}).click();
  await second.getByRole('button',{name:'Entrar na chamada',exact:true}).click();await expect(second.getByText('VOCÊ ESTÁ NA CHAMADA',{exact:true})).toBeVisible();assert.ok(await second.evaluate(()=>window.__accountTracks.length)>0);
  await second.getByRole('button',{name:'Abrir grupo Equipe B',exact:true}).click();await expect(second.getByRole('heading',{name:'Equipe B',exact:true})).toBeVisible();await expect.poll(()=>second.evaluate(()=>window.__accountTracks.every(track=>track.readyState==='ended')),{timeout:1000}).toBe(true);await expect(second.getByText('VOCÊ ESTÁ NA CHAMADA',{exact:true})).toHaveCount(0);
  await createGroup(first,'Privado A');await first.getByLabel('Mensagem',{exact:true}).fill('Rascunho privado A');
  await first.getByRole('button',{name:'Entrar na chamada',exact:true}).click();await expect(first.getByText('VOCÊ ESTÁ NA CHAMADA',{exact:true})).toBeVisible();await logout(first);
  await expect.poll(()=>first.evaluate(()=>window.__accountTracks.every(track=>track.readyState==='ended')),{timeout:1000}).toBe(true);
  const native=await desktop.browserWindow(first);assert.equal(await native.evaluate(window=>window.webContents.isAudioMuted()),true);
  await first.getByLabel('Usuário',{exact:true}).fill('bia');await first.getByLabel('Senha',{exact:true}).fill('senha incorreta longa');await first.getByRole('button',{name:'Entrar no Drocsid',exact:true}).click();await expect(first.getByText(/Usuário ou senha incorretos/)).toBeVisible();
  await first.getByLabel('Senha',{exact:true}).fill(password);await first.getByRole('button',{name:'Entrar no Drocsid',exact:true}).click();await expect(first.getByRole('button',{name:'Abrir grupo Equipe B',exact:true})).toBeVisible();await expect(first.getByRole('button',{name:'Abrir grupo Privado A',exact:true})).toHaveCount(0);await expect(first.getByLabel('Mensagem',{exact:true})).toHaveValue('');await expect(first.getByText('Rascunho privado A',{exact:true})).toHaveCount(0);
  await expect(first.getByText(/Usuário ou senha incorretos/)).toHaveCount(0);assert.equal(tokens.length,3);
  const stored=JSON.stringify(await first.evaluate(()=>({local:{...localStorage},session:{...sessionStorage},preferences:window.desktop?.preferences})))+readFileSync(join(profile,'preferences.json'),'utf8');
  for(const secret of [password,code,...tokens])assert.equal(stored.includes(secret),false);
  assert.deepEqual((await service.database.query('SELECT username FROM drocsid.accounts ORDER BY username')).map(row=>row.username),['ana','bia']);assert.equal((await service.database.query('SELECT id FROM drocsid.groups')).length,3);
  await expect(second.locator('.disconnect-banner')).toHaveCount(0);assert.deepEqual(errors,[]);
  mkdirSync('test-results/desktop',{recursive:true});await first.screenshot({path:'test-results/desktop/drocsid-accounts.png'});
  console.log('PASS: registration, login, logout, private groups and one-use invites work through controls without persistent credentials.');
}finally{
  try{await closeDesktop(desktop);}finally{try{await service?.close();}finally{try{await postgres?.close();}finally{removeTestProfile(profile);}}}
}
