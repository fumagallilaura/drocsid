import type {IpcMainEvent,Session,DesktopCapturerSource,DesktopCapturer} from 'electron';
import type {CaptureKey,CaptureOutcome,CaptureSources} from '../../shared/desktop.js';
import type {CallContext} from '../../shared/protocol.js';

type NativeCapture=NonNullable<Parameters<Session['setDisplayMediaRequestHandler']>[0]>;
type CaptureMessage={channel:string;value:Record<string,unknown>&{key:CaptureKey};sender:IpcMainEvent['sender'];senderFrame:IpcMainEvent['senderFrame'];event:IpcMainEvent};
declare global {
  var __captureProbe:{requests:{calls:number;results:string[];finished:boolean}[];deliveries:number};
  var __captureDetails:{gestures:boolean[];outcomes:CaptureOutcome[];grants:{audioRequested:boolean;audio:unknown;video:boolean}[]};
  var __captureIpc:Record<string,(event:IpcMainEvent,value:unknown)=>void>;
  var __captureMessages:CaptureMessage[];
  var __advanceCapture:(ms:number)=>void;
  var __holdNative:boolean;
  var __nativeCapture:NativeCapture;
  var __lastCaptureRequest:Parameters<NativeCapture>[0];
  var __releaseNative:()=>void;
  var __oldDocumentMessage:CaptureMessage;
  var __nativeInventory:DesktopCapturer['getSources'];
  var __originalSources:DesktopCapturer['getSources'];
  var __mediaOriginalInventory:DesktopCapturer['getSources'];
  var __releaseInventory:(sources:DesktopCapturerSource[])=>void;
  interface Window {
    __testConnections:RTCPeerConnection[];__testCaptures:MediaStream[];__testDisplays:MediaStream[];__testCallEvents:(CallContext&{type:'call-join'|'call-leave';requestId:string})[];
    __rejectNextPlayback:boolean;__rejectNextCall:boolean;__rejectNextMessage:boolean;
    __testSocket:WebSocket;__testRoomContext:string;
    __rejectedOperation:string;__lastMessageOperation:string;
    __lastStopAt:number;__micReleasedAt:number;__holdMicrophone:boolean;__lateStream:MediaStream;__releaseMicrophone:(()=>void)|null;
    __cancelTiming:{started:number|null;terminalAt:number|null};__stopUI:{started:number|null;readyAt:number|null};
    __releaseRoom:()=>void;__heldJoin:MessageEvent[];__releaseJoin:()=>void;
    __holdMedia:'start'|'stop'|null;__heldMedia:MessageEvent[];__releaseMedia:()=>void;
    __delayedRoom:MessageEvent[];__releaseNewRoom:()=>void;
    __sources:CaptureSources;__cancelSources:CaptureSources;
    __lifecycleStreams:{stream:MediaStream;type:string}[];__terminalStart:number|null;__lifecycleRoot:{unmount():void};
    __captureAudit:{readyState:DocumentReadyState;calls:{microphone:number;display:number;legacy:number}};
    __reviewMicrophoneTracks:MediaStreamTrack[];
  }
  interface Navigator {
    getUserMedia?: (constraints:MediaStreamConstraints,success:(stream:MediaStream)=>void,failure:(error:DOMException)=>void)=>void;
    webkitGetUserMedia?: Navigator['getUserMedia'];
  }
}
declare module 'electron' {
  interface BrowserWindow { __capturePayload:Record<string,unknown>;__oldCapturePayload:Record<string,unknown> }
}
