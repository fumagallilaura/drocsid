import { app, BrowserWindow, session, desktopCapturer, ipcMain, Menu } from 'electron';
import express from 'express';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { createService, logFailure } from '../server/service.js';
import { readIceServers } from '../shared/protocol.js';
import { allowPermissionCheck, allowPermissionRequest, allowDisplayCapture, trustedIpc, validatePreferences } from './policy.js';

const root = fileURLToPath(new URL('../', import.meta.url));
let service, origin;
const pending = new Map();
const trusted = contents => { try { return new URL(contents.getURL()).origin === origin; } catch { return false; } };
const profile = app.commandLine.getSwitchValue('user-data-dir');
if (profile) { mkdirSync(resolve(profile), { recursive: true }); app.setPath('userData', resolve(profile)); }
if (!app.requestSingleInstanceLock()) {
  logFailure('bootstrap', 'ALREADY_RUNNING', null); app.exit(1);
} else {
app.on('second-instance', () => { const window = BrowserWindow.getAllWindows()[0]; if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });
app.whenReady().then(async () => {
const preferencesPath = resolve(app.getPath('userData'), 'preferences.json');
let preferences = { name: '', server: '', quality: '1080' };
try { preferences = validatePreferences(JSON.parse(readFileSync(preferencesPath, 'utf8'))); }
catch (error) { if (error.code !== 'ENOENT') logFailure('preferences', 'INVALID_INPUT', null, error); }
ipcMain.on('preferences-read', event => { event.returnValue = trustedIpc(event, origin) ? { ...preferences } : null; });
ipcMain.handle('preferences-save', (event, value) => {
  if (!trustedIpc(event, origin)) return { ok: false, code: 'INVALID_INPUT' };
  try {
    const next = validatePreferences(value), temporary = `${preferencesPath}.${process.pid}.tmp`;
    writeFileSync(temporary, JSON.stringify(next), { mode: 0o600 }); renameSync(temporary, preferencesPath);
    preferences = next; return { ok: true };
  } catch (error) { logFailure('preferences', error.code === 'INVALID_INPUT' ? 'INVALID_INPUT' : 'PERSISTENCE_FAILED', null, error); return { ok: false, code: error.code === 'INVALID_INPUT' ? 'INVALID_INPUT' : 'PERSISTENCE_FAILED' }; }
});
const iceServers = readIceServers(process.env.ICE_SERVERS === undefined ? undefined : JSON.parse(process.env.ICE_SERVERS));
service = createService({ dbPath: resolve(app.getPath('userData'), 'conversa.sqlite'), iceServers });
service.app.use((_req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self' http: https: ws: wss:");
  next();
});
service.app.use(express.static(resolve(root, 'dist')));
service.app.get('/{*path}', (_req, res) => res.sendFile(resolve(root, 'dist/index.html')));
await new Promise((resolveListen, reject) => {
  service.server.once('error', reject);
  service.server.listen(0, '127.0.0.1', () => { service.server.removeListener('error', reject); resolveListen(); });
});
origin = `http://127.0.0.1:${service.server.address().port}`;

session.defaultSession.setPermissionCheckHandler((contents, permission, requestingOrigin, details) => allowPermissionCheck(contents, permission, requestingOrigin, details, origin));
session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => callback(allowPermissionRequest(contents, permission, details, origin)));
function settleCapture(requestId, result = null) {
  const entry = pending.get(requestId); if (!entry) return;
  pending.delete(requestId); clearTimeout(entry.timer);
  try { entry.callback(result); } catch (error) { logFailure('capture', 'MEDIA_FAILED', requestId, error); }
}
function cancelCaptures(contentsId) { for (const [id, entry] of pending) if (contentsId === undefined || entry.contentsId === contentsId) settleCapture(id); }
session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
  const window = BrowserWindow.getAllWindows().find(w => w.webContents.mainFrame === request.frame);
  if (!window || !allowDisplayCapture(window.webContents, request, origin)) return callback(null);
  const requestId = randomUUID();
  const entry = { contentsId: window.webContents.id, sources: [], callback, audio: request.audioRequested,
    timer: setTimeout(() => settleCapture(requestId), 60000) };
  pending.set(requestId, entry);
  try {
    const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 360, height: 210 }, fetchWindowIcons: true });
    if (!pending.has(requestId) || window.isDestroyed() || !trusted(window.webContents)) return settleCapture(requestId);
    entry.sources = sources;
    window.webContents.send('capture-sources', { requestId, sources: sources.map(s => ({ id: s.id, name: s.name, thumbnail: s.thumbnail.toDataURL() })) });
  } catch (error) {
    if (!pending.has(requestId)) return;
    logFailure('capture-inventory', 'MEDIA_FAILED', requestId, error);
    if (!window.isDestroyed()) window.webContents.send('capture-error', { requestId, code: 'MEDIA_FAILED' });
    settleCapture(requestId);
  }
});
ipcMain.on('capture-select', (event, value) => {
  if (!value || typeof value.requestId !== 'string' || !trustedIpc(event, origin)) return;
  const { requestId, sourceId } = value;
  const entry = pending.get(requestId);
  if (!entry || entry.contentsId !== event.sender.id) return;
  const source = entry.sources.find(s => s.id === sourceId);
  settleCapture(requestId, source ? { video: source, ...(entry.audio ? { audio: 'loopback' } : {}) } : null);
});
ipcMain.on('playback-state', (event, enabled) => {
  if (trustedIpc(event, origin)) event.sender.setAudioMuted(enabled !== true);
});
function openWindow() {
  const window = new BrowserWindow({
    width: 1440, height: 940, minWidth: 1040, minHeight: 700, backgroundColor: '#121718', title: 'Conversa',
    webPreferences: { preload: resolve(root, 'electron/preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, autoplayPolicy: 'document-user-activation-required' },
  });
  // No playback on startup, logout or reload. The renderer enables it only
  // after the user has joined a call, and disables it when leaving/deafening.
  window.webContents.setAudioMuted(true);
  window.webContents.on('did-start-loading', () => { window.webContents.setAudioMuted(true); cancelCaptures(window.webContents.id); });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  const contentsId = window.webContents.id;
  window.webContents.on('will-navigate', (event, url) => { if (new URL(url).origin !== origin) event.preventDefault(); });
  window.on('closed', () => cancelCaptures(contentsId));
  window.loadURL(origin);
  return window;
}
Menu.setApplicationMenu(Menu.buildFromTemplate([
  { label: 'Conversa', submenu: [{ label: 'Nova janela de teste', accelerator: 'Ctrl+Shift+N', click: openWindow }, { type: 'separator' }, { role: 'quit', label: 'Sair' }] },
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
  service.close().then(() => app.quit(), error => { logFailure('shutdown', 'SHUTDOWN_FAILED', null, error); app.exit(1); });
});
}).catch(async error => {
  logFailure('bootstrap', 'BOOTSTRAP_FAILED', null, error);
  try { await service?.close(); } catch (cleanupError) { logFailure('shutdown', 'SHUTDOWN_FAILED', null, cleanupError); }
  app.exit(1);
});
}
