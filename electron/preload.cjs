const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  platform: 'windows',
  preferences: ipcRenderer.sendSync('preferences-read'),
  savePreferences: async value => {
    const result = await ipcRenderer.invoke('preferences-save', value);
    if (!result.ok) throw Object.assign(new Error('Não foi possível salvar as preferências.'), { code: result.code });
  },
  setPlaybackEnabled: enabled => ipcRenderer.send('playback-state', enabled === true),
  onCaptureSources: callback => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('capture-sources', listener);
    return () => ipcRenderer.removeListener('capture-sources', listener);
  },
  onCaptureError: callback => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('capture-error', listener);
    return () => ipcRenderer.removeListener('capture-error', listener);
  },
  selectCapture: (requestId, sourceId) => ipcRenderer.send('capture-select', { requestId, sourceId }),
});
