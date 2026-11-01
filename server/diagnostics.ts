import metadata from '../package.json' with {type:'json'};

const object=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object';
export function logFailure(phase:string,code:string,requestId?:string|null,error?:unknown):void {
  const source=object(error)&&error.cause?error.cause:error,cause=object(source)?source:{};
  const causeCode=typeof cause.code==='string'&&['EADDRINUSE','EADDRNOTAVAIL','EACCES','ENOENT','ERR_SQLITE_ERROR','SHUTDOWN_FAILED'].includes(cause.code)?cause.code:null;
  console.warn(JSON.stringify({phase,code,requestId:requestId||null,version:metadata.version,runtime:process.versions.electron||process.versions.node,
    cause:typeof cause.name==='string'&&['Error','TypeError','RangeError','SyntaxError','DOMException','AbortError','NotAllowedError','ProtocolError'].includes(cause.name)?cause.name:'Error',
    causeCode,sqliteCode:typeof cause.errcode==='number'&&Number.isInteger(cause.errcode)?cause.errcode:null}));
}
