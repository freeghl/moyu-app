const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('moyuAPI', {
  getDefaultSites: () => ipcRenderer.invoke('get-default-sites'),
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close: () => ipcRenderer.invoke('window-close'),
  onBossMode: (callback) => {
    ipcRenderer.on('toggle-boss-mode', (_, isBoss) => callback(isBoss));
  },
  onCursorPos: (callback) => {
    ipcRenderer.on('cursor-pos', (_, pos) => callback(pos));
  },
});
