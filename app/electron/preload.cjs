// Schmale Brücke zur Spielseite: nur Beenden und Vollbild, sonst nichts aus Node
'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('lsApp', {
  platform: 'desktop',
  quit: () => ipcRenderer.send('ls:quit'),
  toggleFullscreen: () => ipcRenderer.send('ls:fullscreen')
});
