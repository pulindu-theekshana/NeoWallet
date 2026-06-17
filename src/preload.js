// preload.js runs before the renderer and can bridge Node.js ↔ browser safely.
// For our app the renderer talks directly to Flask via fetch(), so this stays minimal.
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  appVersion: '1.0.0',
});