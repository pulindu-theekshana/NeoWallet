const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  appVersion:  '1.0.0',
  getApiToken: () => ipcRenderer.invoke('get-api-token'),
});