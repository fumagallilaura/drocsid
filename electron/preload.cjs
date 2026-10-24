const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  platform: 'windows',
  setPlaybackEnabled: enabled => ipcRenderer.send('playback-state', enabled === true),
  onCaptureSources: callback => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('capture-sources', listener);
    return () => ipcRenderer.removeListener('capture-sources', listener);
  },
  selectCapture: (requestId, sourceId) => ipcRenderer.send('capture-select', { requestId, sourceId }),
});
