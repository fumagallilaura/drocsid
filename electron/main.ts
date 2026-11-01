import { app, BrowserWindow, session, desktopCapturer, ipcMain, Menu } from 'electron';
import type { DesktopCapturerSource, WebFrameMain, Streams, IpcMainEvent } from 'electron';
import express from 'express';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { Socket } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { logFailure } from '../server/diagnostics.js';
import { readIceServers, LIMITS, ProtocolError, PROTOCOL_VERSION } from '../shared/protocol.js';
import metadata from '../package.json' with {type:'json'};
import type { Preferences, CaptureKey, CaptureOutcome } from '../shared/desktop.js';
import { allowPermissionCheck, allowPermissionRequest, allowDisplayCapture, trustedIpc, validatePreferences, validCaptureKey, sameCaptureKey } from './policy.js';

const root = fileURLToPath(new URL('../', import.meta.url));
type UiService={app:express.Express;server:Server;close():Promise<void>};
type Document={token:string;entry?:CaptureEntry|null};
type CaptureEntry={key:CaptureKey;contentsId:number;document:Document;frame:WebFrameMain;sources:DesktopCapturerSource[];
  timer?:ReturnType<typeof setTimeout>;requestId?:string;callback?:((streams:Streams|null)=>void)|null;audio?:boolean;outcome?:CaptureOutcome};
const object=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
let service:UiService|undefined, origin='';
const pending = new Map<string,CaptureEntry>();
const documents = new Map<number,Document>();
const trusted = (contents:Electron.WebContents) => { try { return new URL(contents.getURL()).origin === origin; } catch { return false; } };
const profile = app.commandLine.getSwitchValue('user-data-dir');
const userData=profile?resolve(profile):resolve(app.getPath('appData'),'conversa');
mkdirSync(userData,{recursive:true});app.setPath('userData',userData);app.setName('Drocsid');
if (!app.requestSingleInstanceLock()) {
  logFailure('bootstrap', 'ALREADY_RUNNING', null); app.exit(1);
} else {
app.on('second-instance', () => { const window = BrowserWindow.getAllWindows()[0]; if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });
app.whenReady().then(async () => {
const preferencesPath = resolve(app.getPath('userData'), 'preferences.json');
let preferences:Preferences = { name: '', server: '', quality: '1080' };
try { preferences = validatePreferences(JSON.parse(readFileSync(preferencesPath, 'utf8'))); }
catch (error) { if (!object(error)||error.code !== 'ENOENT') logFailure('preferences', 'INVALID_INPUT', null, error); }
ipcMain.on('preferences-read', event => { event.returnValue = trustedIpc(event, origin) ? { ...preferences } : null; });
ipcMain.handle('preferences-save', (event, value:unknown) => {
  if (!trustedIpc(event, origin)) return { ok: false, code: 'INVALID_INPUT' };
  try {
    const next = validatePreferences(value), temporary = `${preferencesPath}.${process.pid}.tmp`;
    writeFileSync(temporary, JSON.stringify(next), { mode: 0o600 }); renameSync(temporary, preferencesPath);
    preferences = next; return { ok: true };
  } catch (error) { const code=error instanceof ProtocolError&&error.code==='INVALID_INPUT'?'INVALID_INPUT':'PERSISTENCE_FAILED';logFailure('preferences',code,null,error);return {ok:false,code}; }
});
if(process.env.DROCSID_HOST!==undefined&&!['0','1'].includes(process.env.DROCSID_HOST))throw new ProtocolError('INVALID_INPUT');
let active:UiService;
if(process.env.DROCSID_HOST==='1'){
  const ice:unknown=process.env.ICE_SERVERS===undefined?undefined:JSON.parse(process.env.ICE_SERVERS);
  const {createService}=await import('../server/service.js');
  active=await createService({iceServers:readIceServers(ice),trustedLocal:process.env.DROCSID_TRUSTED_LOCAL==='1'});
}else{
  const ui=express(),server=createServer(ui),sockets=new Set<Socket>();let closed:Promise<void>|undefined;
  server.on('connection',socket=>{sockets.add(socket);socket.once('close',()=>sockets.delete(socket));});
  ui.get('/api/health',(_req,res)=>res.json({ok:true}));
  ui.get('/api/server',(_req,res)=>res.json({authentication:'client',protocolVersion:PROTOCOL_VERSION,version:metadata.version}));
  ui.use('/api',(_req,res)=>res.status(404).json({code:'SERVER_REQUIRED',message:'Informe o endereço do servidor do grupo.'}));
  active={app:ui,server,close(){
    if(closed)return closed;
    let timer:ReturnType<typeof setTimeout>|undefined;
    for(const socket of sockets)socket.destroy();
    closed=Promise.race([new Promise<void>((resolve,reject)=>server.close(error=>error&&(!('code' in error)||error.code!=='ERR_SERVER_NOT_RUNNING')?reject(error):resolve())),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new ProtocolError('SHUTDOWN_FAILED')),LIMITS.shutdownMs);})]).finally(()=>clearTimeout(timer));return closed;
  }};
}
service=active;
active.app.use((_req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self' http: https: ws: wss:");
  next();
});
active.app.use(express.static(resolve(root, 'dist')));
active.app.get('/{*path}', (_req, res) => res.sendFile(resolve(root, 'dist/index.html')));
await new Promise<void>((resolveListen, reject) => {
  active.server.once('error', reject);
  active.server.listen(0, '127.0.0.1', () => { active.server.removeListener('error', reject); resolveListen(); });
});
const address=active.server.address();if(!address||typeof address==='string')throw new ProtocolError('BOOTSTRAP_FAILED');
origin = `http://127.0.0.1:${address.port}`;

session.defaultSession.setPermissionCheckHandler((contents, permission, requestingOrigin, details) => allowPermissionCheck(contents, permission, requestingOrigin, details, origin));
session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => callback(allowPermissionRequest(contents, permission, details, origin)));
function settleCapture(entry:CaptureEntry, result:Streams|null = null, outcome:Omit<CaptureOutcome,'requestId'> = { outcome: 'cancelled', code: 'CANCELLED', phase: 'capture-selection' }):CaptureOutcome {
  const settled=entry.outcome ??= { ...outcome, requestId: entry.requestId || null };
  clearTimeout(entry.timer);
  if (!entry.callback) return settled;
  if(entry.requestId)pending.delete(entry.requestId);
  const callback = entry.callback; entry.callback = null;
  try { callback(result); } catch (error) { logFailure('capture', 'MEDIA_FAILED', entry.requestId, error); }
  return settled;
}
function cancelCaptures(contentsId?:number) { for (const [id, document] of documents) if ((contentsId === undefined || id === contentsId) && document.entry) settleCapture(document.entry); }
ipcMain.on('capture-document', event => {
  if (!trustedIpc(event, origin)) { event.returnValue = null; return; }
  let document = documents.get(event.sender.id);
  if (!document) { document = { token: randomUUID() }; documents.set(event.sender.id, document); }
  event.returnValue = document.token;
});
function captureDocument(event:IpcMainEvent, value:unknown) {
  const document = documents.get(event.sender.id);
  return trustedIpc(event, origin) && object(value) && document?.token === value.documentToken ? document : null;
}
ipcMain.on('capture-prepare', (event, value:unknown) => {
  const document = captureDocument(event, value), key = object(value)?value.key:undefined;
  if (!document || !event.senderFrame || !validCaptureKey(key) || (document.entry && !sameCaptureKey(document.entry.key, key))) {
    event.returnValue = { ok: false, code: 'INVALID_EVENT', phase: 'capture-prepare' }; return;
  }
  if (!document.entry) {
    const entry:CaptureEntry = { key: { callId:key.callId, generation:key.generation, operationId:key.operationId }, contentsId:event.sender.id, document, frame:event.senderFrame, sources:[] };
    document.entry = entry;
    entry.timer = setTimeout(() => {
      const outcome=settleCapture(entry, null, { outcome:'failed', code:'TIMEOUT', phase:'capture-selection' });
      if (!event.sender.isDestroyed() && documents.get(entry.contentsId) === document) event.sender.send('capture-error', { documentToken:document.token, key:entry.key, ...outcome });
    }, 60000);
  }
  event.returnValue = { ok: true };
});
ipcMain.on('capture-cancel', (event, value:unknown) => {
  const document = captureDocument(event, value), entry = document?.entry;
  const key=object(value)?value.key:undefined;
  if (entry && sameCaptureKey(entry.key, key)) settleCapture(entry);
  event.returnValue = { ok: !!entry && sameCaptureKey(entry.key, key) };
});
ipcMain.on('capture-finish', (event, value:unknown) => {
  const document = captureDocument(event, value), entry = document?.entry;
  if (!entry || !object(value) || !sameCaptureKey(entry.key, value.key)) { event.returnValue = { outcome:'failed',code:'INVALID_EVENT',phase:'capture-finish',requestId:null }; return; }
  event.returnValue = entry.outcome??settleCapture(entry, null, { outcome:'failed',code:'MEDIA_FAILED',phase:'capture' }); document.entry = null;
});
session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
  const window = BrowserWindow.getAllWindows().find(w => w.webContents.mainFrame === request.frame);
  if (!window || !allowDisplayCapture(window.webContents, request, origin)) return callback(null);
  const document = documents.get(window.webContents.id), entry = document?.entry;
  if (!entry || entry.frame !== request.frame || entry.requestId) return callback(null);
  const requestId = entry.requestId = randomUUID();
  entry.callback = callback; entry.audio = request.audioRequested;
  pending.set(requestId, entry);
  if (entry.outcome) return settleCapture(entry);
  try {
    const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 360, height: 210 }, fetchWindowIcons: true });
    if (!pending.has(requestId) || documents.get(entry.contentsId) !== document || window.isDestroyed() || !trusted(window.webContents)) return settleCapture(entry);
    entry.sources = sources;
    window.webContents.send('capture-sources', { documentToken:document.token, key:entry.key, requestId, sources: sources.map(s => ({ id: s.id, name: s.name, thumbnail: s.thumbnail.toDataURL() })) });
  } catch (error) {
    if (!pending.has(requestId)) return;
    logFailure('capture-inventory', 'MEDIA_FAILED', requestId, error);
    const outcome=settleCapture(entry, null, { outcome:'failed',code:'MEDIA_FAILED',phase:'capture-inventory' });
    if (!window.isDestroyed() && documents.get(entry.contentsId) === document) window.webContents.send('capture-error', { documentToken:document.token, key:entry.key, ...outcome });
  }
});
ipcMain.on('capture-select', (event, value:unknown) => {
  const document = captureDocument(event, value);
  if (!document || !object(value) || typeof value.requestId !== 'string') return;
  const { requestId, sourceId } = value;
  const entry = pending.get(requestId);
  if (!entry || document.entry !== entry || !sameCaptureKey(entry.key, value.key) || entry.contentsId !== event.sender.id) return;
  const source = entry.sources.find(s => s.id === sourceId);
  if (sourceId === null) settleCapture(entry);
  else if (!source) settleCapture(entry, null, { outcome:'failed',code:'INVALID_EVENT',phase:'capture-selection' });
  else settleCapture(entry, { video: source, ...(entry.audio ? { audio: 'loopback' } : {}) }, { outcome:'selected',code:null,phase:'capture-selection' });
});
ipcMain.on('playback-state', (event, enabled:unknown) => {
  if (trustedIpc(event, origin)) event.sender.setAudioMuted(enabled !== true);
});
function openWindow() {
  const window = new BrowserWindow({
    width: 1440, height: 940, minWidth: 1040, minHeight: 700, backgroundColor: '#121718', title: 'Drocsid',
    webPreferences: { preload: resolve(root, 'electron/preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, autoplayPolicy: 'document-user-activation-required' },
  });
  // No playback on startup, logout or reload. The renderer enables it only
  // after the user has joined a call, and disables it when leaving/muting playback.
  window.webContents.setAudioMuted(true);
  window.webContents.on('did-start-navigation', (_event, _url, _inPlace, isMainFrame) => {
    if (!isMainFrame) return;
    window.webContents.setAudioMuted(true); cancelCaptures(window.webContents.id);
    documents.set(window.webContents.id, { token:randomUUID() });
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  const contentsId = window.webContents.id;
  window.webContents.on('will-navigate', (event, url) => { if (new URL(url).origin !== origin) event.preventDefault(); });
  window.on('closed', () => { cancelCaptures(contentsId); documents.delete(contentsId); });
  window.loadURL(origin);
  return window;
}
Menu.setApplicationMenu(Menu.buildFromTemplate([
  { label: 'Drocsid', submenu: [{ label: 'Nova janela de teste', accelerator: 'Ctrl+Shift+N', click: openWindow }, { type: 'separator' }, { role: 'quit', label: 'Sair' }] },
  { label: 'Editar', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
  { label: 'Exibir', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' }] },
]));
openWindow();
app.on('window-all-closed', () => app.quit());
let quitting = false;
app.on('before-quit', event => {
  if (quitting) return;
  event.preventDefault(); quitting = true;
  cancelCaptures();
  active.close().then(() => app.quit(), error => { logFailure('shutdown', 'SHUTDOWN_FAILED', null, error); app.exit(1); });
});
}).catch(async error => {
  logFailure('bootstrap', 'BOOTSTRAP_FAILED', null, error);
  try { await service?.close(); } catch (cleanupError) { logFailure('shutdown', 'SHUTDOWN_FAILED', null, cleanupError); }
  app.exit(1);
});
}
