import { ProtocolError } from '../shared/protocol.js';
import type { CaptureKey, Preferences } from '../shared/desktop.js';

type Frame = {url:string};
type Contents = {mainFrame:Frame;getURL():string;isDestroyed():boolean};
type Ipc = {sender:Contents;senderFrame:Frame|null};
const object=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const sameOrigin=(url:unknown,origin:string)=>{try{return typeof url==='string'&&new URL(url).origin===origin;}catch{return false;}};
const trustedContents=(contents:Contents|null,origin:string):contents is Contents=>!!contents&&!contents.isDestroyed()&&sameOrigin(contents.getURL(),origin);
function trustedRequest(contents:Contents|null,details:unknown,origin:string):details is Record<string,unknown> {
  return trustedContents(contents,origin)&&object(details)&&details.isMainFrame===true&&sameOrigin(details.requestingUrl,origin)&&(!details.securityOrigin||sameOrigin(details.securityOrigin,origin));
}
export function allowPermissionCheck(contents:Contents|null,permission:string,requestingOrigin:string,details:unknown,origin:string):boolean {
  return sameOrigin(requestingOrigin,origin)&&trustedRequest(contents,details,origin)&&(permission==='clipboard-sanitized-write'||permission==='display-capture'||(permission==='media'&&details.mediaType==='audio'));
}
export function allowPermissionRequest(contents:Contents|null,permission:string,details:unknown,origin:string):boolean {
  return trustedRequest(contents,details,origin)&&(permission==='clipboard-sanitized-write'||permission==='display-capture'||(permission==='media'&&Array.isArray(details.mediaTypes)&&details.mediaTypes.length>0&&details.mediaTypes.every(type=>type==='audio')));
}
export function trustedIpc(event:Ipc,origin:string):boolean {
  return trustedContents(event.sender,origin)&&event.senderFrame===event.sender.mainFrame&&sameOrigin(event.senderFrame?.url,origin);
}
export function allowDisplayCapture(contents:Contents|null,request:{frame:Frame|null;securityOrigin:string},origin:string):boolean {
  return trustedContents(contents,origin)&&request.frame===contents.mainFrame&&sameOrigin(request.securityOrigin,origin)&&sameOrigin(request.frame?.url,origin);
}
export function validCaptureKey(key:unknown):key is CaptureKey {
  return object(key)&&typeof key.callId==='string'&&key.callId.length>0&&key.callId.length<=128&&typeof key.operationId==='string'&&key.operationId.length>0&&key.operationId.length<=128&&typeof key.generation==='number'&&Number.isSafeInteger(key.generation)&&key.generation>0;
}
export function sameCaptureKey(a:unknown,b:unknown):boolean {return validCaptureKey(a)&&validCaptureKey(b)&&a.callId===b.callId&&a.generation===b.generation&&a.operationId===b.operationId;}
export function validatePreferences(value:unknown):Preferences {
  if(!object(value)||typeof value.name!=='string'||value.name.length>32||typeof value.server!=='string'||value.server.length>2048||(value.quality!=='720'&&value.quality!=='1080'))throw new ProtocolError('INVALID_INPUT');
  if(value.server){let url:URL;try{url=new URL(value.server);}catch{throw new ProtocolError('INVALID_INPUT');}if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new ProtocolError('INVALID_INPUT');}
  return {name:value.name,server:value.server,quality:value.quality};
}
