import { app, BrowserWindow, session, desktopCapturer, ipcMain, Menu } from 'electron';
import express from 'express';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createService } from '../server/service.js';

const root = fileURLToPath(new URL('../', import.meta.url));
let service, origin;
const pending = new Map();
const trusted = contents => { try { return new URL(contents.getURL()).origin === origin; } catch { return false; } };
app.whenReady().then(async () => {
service = createService({ dbPath: resolve(app.getPath('userData'), 'conversa.sqlite') });
service.app.use((_req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self' http: https: ws: wss:");
  next();
});
service.app.use(express.static(resolve(root, 'dist')));
service.app.get('/{*path}', (_req, res) => res.sendFile(resolve(root, 'dist/index.html')));
await new Promise(resolveListen => service.server.listen(0, '127.0.0.1', resolveListen));
origin = `http://127.0.0.1:${service.server.address().port}`;

session.defaultSession.setPermissionCheckHandler((contents, permission) => !!contents && trusted(contents) && ['media', 'display-capture'].includes(permission));
session.defaultSession.setPermissionRequestHandler((contents, permission, callback) => callback(trusted(contents) && ['media', 'display-capture'].includes(permission)));
session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
  const window = BrowserWindow.getAllWindows().find(w => w.webContents.mainFrame === request.frame);
  if (!window || !trusted(window.webContents)) return callback({});
  try {
    const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 360, height: 210 }, fetchWindowIcons: true });
    const requestId = randomUUID();
    const timer = setTimeout(() => { pending.delete(requestId); callback({}); }, 60000);
    pending.set(requestId, { contentsId: window.webContents.id, sources, callback, audio: request.audioRequested, timer });
    window.webContents.send('capture-sources', { requestId, sources: sources.map(s => ({ id: s.id, name: s.name, thumbnail: s.thumbnail.toDataURL() })) });
  } catch { callback({}); }
});
ipcMain.on('capture-select', (event, { requestId, sourceId } = {}) => {
  const entry = pending.get(requestId);
  if (!entry || entry.contentsId !== event.sender.id || !trusted(event.sender)) return;
  clearTimeout(entry.timer); pending.delete(requestId);
  const source = entry.sources.find(s => s.id === sourceId);
  entry.callback(source ? { video: source, ...(entry.audio ? { audio: 'loopback' } : {}) } : {});
});
ipcMain.on('playback-state', (event, enabled) => {
  if (trusted(event.sender)) event.sender.setAudioMuted(enabled !== true);
});
function openWindow() {
  const window = new BrowserWindow({
    width: 1440, height: 940, minWidth: 1040, minHeight: 700, backgroundColor: '#121718', title: 'Conversa',
    webPreferences: { preload: resolve(root, 'electron/preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, autoplayPolicy: 'document-user-activation-required' },
  });
  // No playback on startup, logout or reload. The renderer enables it only
  // after the user has joined a call, and disables it when leaving/deafening.
  window.webContents.setAudioMuted(true);
  window.webContents.on('did-start-loading', () => window.webContents.setAudioMuted(true));
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  const contentsId = window.webContents.id;
  window.webContents.on('will-navigate', (event, url) => { if (new URL(url).origin !== origin) event.preventDefault(); });
  window.on('closed', () => {
    for (const [id, entry] of pending) if (entry.contentsId === contentsId) { clearTimeout(entry.timer); entry.callback({}); pending.delete(id); }
  });
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
  service.close().finally(() => app.quit());
});
}).catch(error => { console.error(error); app.exit(1); });
