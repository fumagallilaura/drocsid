import type { CallContext } from './protocol.js';

export type Preferences = { name:string; server:string; quality:'720'|'1080' };
export type CaptureKey = CallContext & {operationId:string};
export type CaptureOutcome = {outcome:'selected'|'cancelled'|'failed';code:string|null;phase:string;requestId:string|null};
export type CaptureSources = {key:CaptureKey;requestId:string;sources:{id:string;name:string;thumbnail:string}[]};
export type CaptureFailure = CaptureOutcome & {key:CaptureKey};
export type CaptureReply = {ok:true}|{ok:false;code:string;phase?:string};
export interface DesktopBridge {
  platform:'windows';preferences:Preferences|null;
  savePreferences(value:Preferences):Promise<void>;setPlaybackEnabled(enabled:boolean):void;
  prepareCapture(key:CaptureKey):CaptureReply;cancelCapture(key:CaptureKey):{ok:boolean};finishCapture(key:CaptureKey):CaptureOutcome;
  onCaptureSources(callback:(value:CaptureSources)=>void):()=>void;
  onCaptureError(callback:(value:CaptureFailure)=>void):()=>void;
  selectCapture(key:CaptureKey,requestId:string,sourceId:string|null):void;
}
