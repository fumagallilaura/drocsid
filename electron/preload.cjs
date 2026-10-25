const { contextBridge, ipcRenderer } = require('electron');
const documentToken = ipcRenderer.sendSync('capture-document');
const captureMessage = key => ({ documentToken, key });
contextBridge.exposeInMainWorld('desktop', {
  platform: 'windows',
  preferences: ipcRenderer.sendSync('preferences-read'),
  savePreferences: async value => {
    const result = await ipcRenderer.invoke('preferences-save', value);
    if (!result.ok) throw Object.assign(new Error('Não foi possível salvar as preferências.'), { code: result.code });
  },
  setPlaybackEnabled: enabled => ipcRenderer.send('playback-state', enabled === true),
  prepareCapture: key => ipcRenderer.sendSync('capture-prepare', captureMessage(key)),
  cancelCapture: key => ipcRenderer.sendSync('capture-cancel', captureMessage(key)),
  finishCapture: key => ipcRenderer.sendSync('capture-finish', captureMessage(key)),
  onCaptureSources: callback => {
    const listener = (_event, payload) => { if (payload.documentToken === documentToken) { const { documentToken: _token, ...value } = payload; callback(value); } };
    ipcRenderer.on('capture-sources', listener);
    return () => ipcRenderer.removeListener('capture-sources', listener);
  },
  onCaptureError: callback => {
    const listener = (_event, payload) => { if (payload.documentToken === documentToken) { const { documentToken: _token, ...value } = payload; callback(value); } };
    ipcRenderer.on('capture-error', listener);
    return () => ipcRenderer.removeListener('capture-error', listener);
  },
  selectCapture: (key, requestId, sourceId) => ipcRenderer.send('capture-select', { ...captureMessage(key), requestId, sourceId }),
});
