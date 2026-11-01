import { _electron as electron } from 'playwright';
import { expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { desktopTarget, createTestProfile, removeTestProfile, closeDesktop, closeResources } from './test-runtime.mjs';
import { createPostgresFixture } from '../tests/helpers/postgres.js';

const profile=createTestProfile(),env={...process.env},target=desktopTarget();delete env.ELECTRON_RUN_AS_NODE;
const ended=[],results=[],errors=[];let desktop,postgres,rootFixtures=0;
try{
  postgres=await createPostgresFixture();env.DATABASE_URL=postgres.url;env.DROCSID_TRUSTED_LOCAL='1';env.DROCSID_HOST='1';
  desktop=await electron.launch({...target,args:[...target.args,`--user-data-dir=${profile}`,'--use-fake-device-for-media-stream','--mute-audio'],env,timeout:15000});
  const guard=await desktop.firstWindow();await expect(guard.getByRole('heading',{name:'Vamos nos encontrar?'})).toBeVisible();
  desktop.context().on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
  // Retain React's public Root only in this test response, never in source/ASAR.
  await desktop.context().route('**/assets/*.js',async route=>{
    const response=await route.fetch(),body=await response.text();
    const root=/([\w$]+\.createRoot\(document\.getElementById\("root"\)\))\.render\(/g;
    expect([...body.matchAll(root)].length).toBe(1);rootFixtures++;
    await route.fulfill({response,body:body.replace(root,'(window.__lifecycleRoot=$1).render(')});
  });
  await desktop.context().addInitScript(()=>{
    if(location.protocol!=='http:'||!['127.0.0.1','localhost'].includes(location.hostname))return;
    window.__lifecycleStreams=[];window.__terminalStart=null;
    window.addEventListener('beforeunload',()=>{window.__terminalStart=performance.now();});
    const record=(stream,type)=>{
      window.__lifecycleStreams.push({stream,type});
      for(const track of stream.getTracks()){
        const stop=track.stop.bind(track);
        track.stop=()=>{stop();console.info('LIFECYCLE_STOP '+JSON.stringify({id:track.id,kind:track.kind,state:track.readyState,start:window.__terminalStart,at:performance.now()}));};
      }
      return stream;
    };
    const mic=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia=async options=>record(await mic(options),'microphone');
    const display=navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getDisplayMedia=async options=>{
      const stream=await display(options);
      // Supply a synthetic system-audio track when this machine has no loopback.
      // This asserts cleanup of every returned track, never physical audibility.
      if(options.audio&&!stream.getAudioTracks().length){
        const context=new AudioContext(),destination=context.createMediaStreamDestination(),oscillator=context.createOscillator();
        oscillator.connect(destination);oscillator.start();const audio=destination.stream.getAudioTracks()[0],stop=audio.stop.bind(audio);
        let stopped=false;audio.stop=()=>{stop();if(!stopped){stopped=true;oscillator.stop();void context.close();}};stream.addTrack(audio);
      }
      return record(stream,'display');
    };
  });
  for(const phase of ['reload','disconnect','unmount','close']){
    const opening=desktop.waitForEvent('window');
    await desktop.evaluate(({Menu})=>Menu.getApplicationMenu().items[0].submenu.items[0].click());
    const page=await opening;
    page.on('console',message=>{if(message.text().startsWith('LIFECYCLE_STOP '))ended.push(JSON.parse(message.text().slice(15)));});
    await expect(page.getByRole('heading',{name:'Vamos nos encontrar?'})).toBeVisible();
    const native=await desktop.browserWindow(page),title=`Conversa lifecycle ${phase} ${Date.now()}`;
    await native.evaluate((window,value)=>window.setTitle(value),title);
    await page.getByLabel('Seu nome',{exact:true}).fill('Ciclo de mídia');
    await page.getByRole('button',{name:'Entrar no Conversa',exact:true}).click();
    await page.getByRole('button',{name:'Entrar na chamada',exact:true}).click();
    await page.getByRole('button',{name:'Configurações',exact:true}).click();
    await page.getByRole('checkbox',{name:/Incluir áudio do sistema/}).check();await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'Compartilhar tela',exact:true}).click();
    await page.getByRole('dialog',{name:'O que vamos compartilhar?'}).getByRole('button',{name:title,exact:true}).click();
    await expect(page.getByRole('button',{name:'Parar compartilhamento',exact:true})).toBeEnabled();
    const inventory=await page.evaluate(()=>window.__lifecycleStreams.map(({stream,type})=>({type,tracks:stream.getTracks().map(track=>({id:track.id,kind:track.kind,state:track.readyState}))})));
    expect(inventory.map(value=>value.type)).toEqual(['microphone','display']);
    expect(inventory[0].tracks.map(track=>track.kind)).toEqual(['audio']);
    expect(inventory[1].tracks.some(track=>track.kind==='video')).toBe(true);expect(inventory[1].tracks.some(track=>track.kind==='audio')).toBe(true);
    expect(inventory.flatMap(value=>value.tracks).every(track=>track.state==='live')).toBe(true);
    if(phase==='reload')await page.reload();
    else if(phase==='close'){
      const closed=page.waitForEvent('close');await native.evaluate(window=>window.close());await closed;
    }
    else if(phase==='unmount')await page.evaluate(()=>{window.__terminalStart=performance.now();window.__lifecycleRoot.unmount();});
    else{
      await page.getByRole('button',{name:'Configurações',exact:true}).click();
      await page.getByRole('button',{name:'Sair e trocar de servidor',exact:true}).evaluate(button=>button.addEventListener('click',()=>{window.__terminalStart=performance.now();},{once:true,capture:true}));
      await page.getByRole('button',{name:'Sair e trocar de servidor',exact:true}).click();
    }
    const tracks=inventory.flatMap(value=>value.tracks);
    for(const track of tracks){
      await expect.poll(()=>ended.some(value=>value.id===track.id),{timeout:1500}).toBe(true);
      const result=ended.find(value=>value.id===track.id);expect(result.state).toBe('ended');expect(result.start).toEqual(expect.any(Number));expect(result.at-result.start).toBeGreaterThanOrEqual(0);expect(result.at-result.start).toBeLessThanOrEqual(1000);
    }
    if(phase!=='close'){
      expect(await native.evaluate(window=>window.webContents.isAudioMuted())).toBe(true);
      expect(await page.locator('audio,video').count()).toBe(0);
      if(phase==='unmount')expect(await page.locator('#root').evaluate(root=>root.childElementCount)).toBe(0);
      await page.close();
    }
    results.push({phase,inventory,ended:tracks.map(track=>ended.find(value=>value.id===track.id))});
  }
  expect(rootFixtures).toBeGreaterThanOrEqual(4);
  expect(errors).toEqual([]);
  mkdirSync('test-results',{recursive:true});writeFileSync('test-results/media-lifecycle.json',JSON.stringify({synthetic:true,rootFixtures,results},null,2));
  console.log('PASS: all acquired mic, display and system-audio tracks ended within 1s on reload, disconnect, React Root.unmount and window close; playback blocked.');
}finally{
  try{await closeResources([()=>closeDesktop(desktop)]);}finally{try{await postgres?.close();}finally{removeTestProfile(profile);}}
}
