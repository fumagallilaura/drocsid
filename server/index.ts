import express from 'express';
import { posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ViteDevServer } from 'vite';
import { createService, logFailure } from './service.js';
import { LIMITS, ProtocolError, parsePort, readIceServers } from '../shared/protocol.js';

const root=fileURLToPath(new URL('../',import.meta.url));
export async function startServer({env=process.env,production=process.argv.includes('--production')}:{env?:NodeJS.ProcessEnv;production?:boolean}={}) {
  let port:number,iceServers;
  try {
    port=parsePort(env.PORT??'4310');
    const input:unknown=env.ICE_SERVERS===undefined?undefined:JSON.parse(env.ICE_SERVERS);
    iceServers=readIceServers(input);
    if(env.DROCSID_TRUSTED_LOCAL!==undefined&&!['0','1'].includes(env.DROCSID_TRUSTED_LOCAL))throw new Error();
    if(env.DROCSID_TRUSTED_LOCAL==='1'&&!['127.0.0.1','::1','localhost'].includes(env.HOST??'127.0.0.1'))throw new Error();
  }catch{throw new ProtocolError('INVALID_INPUT','Configuração PORT, ICE_SERVERS ou modo local inválida.');}
  let service:Awaited<ReturnType<typeof createService>>|undefined,vite:ViteDevServer|undefined,closing:Promise<void>|undefined;
  const close=():Promise<void>=>{
    if(closing)return closing;
    process.removeListener('SIGINT',onSignal);process.removeListener('SIGTERM',onSignal);
    closing=(async()=>{
      let timer:ReturnType<typeof setTimeout>|undefined;
      try{
        const results=await Promise.race([
          Promise.allSettled([service?.close(),vite?.close()]),
          new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new ProtocolError('SHUTDOWN_FAILED')),LIMITS.shutdownMs);}),
        ]);
        if(results.some(result=>result.status==='rejected'))throw new ProtocolError('SHUTDOWN_FAILED');
      }finally{clearTimeout(timer);}
    })();return closing;
  };
  const onSignal=()=>{void close().then(()=>process.exit(0),cause=>{logFailure('shutdown','SHUTDOWN_FAILED',null,cause);process.exit(1);});};
  try{
    const active=service=await createService({env,iceServers,trustedLocal:env.DROCSID_TRUSTED_LOCAL==='1'});
    if(production){
      active.app.use(express.static(resolve(root,'dist')));
      active.app.get('/{*path}',(_req,res)=>res.sendFile(resolve(root,'dist/index.html')));
    }else{
      const {createServer}=await import('vite');
      const existing=new Set(active.server.listeners('upgrade'));
      vite=await createServer({root,server:{middlewareMode:true,hmr:{server:active.server}},appType:'spa'});
      const consumers=active.server.listeners('upgrade').filter(handler=>!existing.has(handler)).filter((handler):handler is (...args:unknown[])=>unknown=>typeof handler==='function');
      for(const handler of consumers)active.server.removeListener('upgrade',handler);
      const hmr=vite.config.server.hmr;
      const path=typeof hmr==='object'&&hmr.path?posix.join(vite.config.base,hmr.path):vite.config.base;
      active.setDevelopmentUpgrade((req,socket,head)=>{
        const protocol=req.headers['sec-websocket-protocol'];
        if(!consumers.length||typeof protocol!=='string'||!['vite-hmr','vite-ping'].includes(protocol)||new URL(req.url??'','http://localhost').pathname!==path)return false;
        for(const handler of consumers)handler.call(active.server,req,socket,head);return true;
      });
      active.app.use(vite.middlewares);
    }
    await new Promise<void>((resolveListen,reject)=>{
      active.server.once('error',reject);
      active.server.listen(port,env.HOST??'127.0.0.1',()=>{active.server.removeListener('error',reject);resolveListen();});
    });
    process.once('SIGINT',onSignal);process.once('SIGTERM',onSignal);
    const address=active.server.address();if(!address||typeof address==='string')throw new ProtocolError('BOOTSTRAP_FAILED');
    console.log(`Drocsid disponível em http://${env.HOST??'127.0.0.1'}:${address.port}`);
    return {...active,close};
  }catch(cause){
    try{await close();}catch(cleanupError){logFailure('shutdown','SHUTDOWN_FAILED',null,cleanupError);}
    throw new ProtocolError('BOOTSTRAP_FAILED','Não foi possível iniciar o servidor.',{cause});
  }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{await startServer();}
  catch(cause){logFailure('bootstrap',cause instanceof ProtocolError?cause.code:'BOOTSTRAP_FAILED',null,cause);process.exitCode=1;}
}
