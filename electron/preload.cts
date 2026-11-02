import electron = require('electron');
import type {Preferences,CaptureKey,CaptureOutcome,CaptureSources,CaptureFailure,CaptureReply,DesktopBridge} from '../shared/desktop.js' with {'resolution-mode':'import'};

const {contextBridge,ipcRenderer}=electron;
const object=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const rawToken:unknown=ipcRenderer.sendSync('capture-document'),documentToken=typeof rawToken==='string'?rawToken:null;
const captureMessage=(key:CaptureKey)=>({documentToken,key});
function preferences(value:unknown):Preferences|null {
  if(!object(value)||typeof value.name!=='string'||typeof value.server!=='string'||(value.quality!=='720'&&value.quality!=='1080'))return null;
  return {name:value.name,server:value.server,quality:value.quality};
}
function key(value:unknown):value is CaptureKey {
  return object(value)&&typeof value.callId==='string'&&value.callId.length>0&&value.callId.length<=128&&typeof value.operationId==='string'&&value.operationId.length>0&&value.operationId.length<=128&&typeof value.generation==='number'&&Number.isSafeInteger(value.generation)&&value.generation>0;
}
function outcome(value:unknown):CaptureOutcome {
  if(object(value)&&(value.outcome==='selected'||value.outcome==='cancelled'||value.outcome==='failed')&&(value.code===null||typeof value.code==='string')&&typeof value.phase==='string'&&(value.requestId===null||typeof value.requestId==='string'))return {outcome:value.outcome,code:value.code,phase:value.phase,requestId:value.requestId};
  return {outcome:'failed',code:'INVALID_EVENT',phase:'capture-finish',requestId:null};
}
function reply(value:unknown):CaptureReply {
  if(object(value)&&value.ok===true)return {ok:true};
  if(object(value)&&value.ok===false&&typeof value.code==='string')return {ok:false,code:value.code,...(typeof value.phase==='string'?{phase:value.phase}:{})};
  return {ok:false,code:'INVALID_EVENT',phase:'capture-prepare'};
}
function sources(value:unknown):CaptureSources|null {
  if(!object(value)||value.documentToken!==documentToken||!key(value.key)||typeof value.requestId!=='string'||!Array.isArray(value.sources))return null;
  const sources:CaptureSources['sources']=[];
  for(const source of value.sources){if(!object(source)||typeof source.id!=='string'||typeof source.name!=='string'||typeof source.thumbnail!=='string')return null;sources.push({id:source.id,name:source.name,thumbnail:source.thumbnail});}
  return {key:value.key,requestId:value.requestId,sources};
}
const bridge:DesktopBridge={
  platform:'windows',preferences:preferences(ipcRenderer.sendSync('preferences-read')),
  async savePreferences(value){
    const result:unknown=await ipcRenderer.invoke('preferences-save',value);
    if(!object(result)||result.ok!==true)throw Object.assign(new Error('Não foi possível salvar as preferências.'),{code:object(result)&&typeof result.code==='string'?result.code:'PERSISTENCE_FAILED'});
  },
  setPlaybackEnabled:enabled=>ipcRenderer.send('playback-state',enabled===true),
  prepareCapture:key=>reply(ipcRenderer.sendSync('capture-prepare',captureMessage(key))),
  cancelCapture:key=>{const result:unknown=ipcRenderer.sendSync('capture-cancel',captureMessage(key));return {ok:object(result)&&result.ok===true};},
  finishCapture:key=>outcome(ipcRenderer.sendSync('capture-finish',captureMessage(key))),
  onCaptureSources(callback){
    const listener=(_event:Electron.IpcRendererEvent,payload:unknown)=>{const value=sources(payload);if(value)callback(value);};
    ipcRenderer.on('capture-sources',listener);return ()=>{ipcRenderer.removeListener('capture-sources',listener);};
  },
  onCaptureError(callback){
    const listener=(_event:Electron.IpcRendererEvent,payload:unknown)=>{if(object(payload)&&payload.documentToken===documentToken&&key(payload.key)){const value:CaptureFailure={...outcome(payload),key:payload.key};callback(value);}};
    ipcRenderer.on('capture-error',listener);return ()=>{ipcRenderer.removeListener('capture-error',listener);};
  },
  selectCapture:(key,requestId,sourceId)=>ipcRenderer.send('capture-select',{...captureMessage(key),requestId,sourceId}),
};
contextBridge.exposeInMainWorld('desktop',bridge);
