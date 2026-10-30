// Lichtschlinge als Desktop-App (für Steam): ein Vollbildfenster mit der Spielseite aus ../www
'use strict';
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

if (!app.requestSingleInstanceLock()) app.quit();

let win = null;
function createWindow() {
  win = new BrowserWindow({
    width: 1600, height: 900, minWidth: 800, minHeight: 500,
    fullscreen: !process.argv.includes('--windowed'),
    backgroundColor: '#06040f',
    autoHideMenuBar: true,
    title: 'Lichtschlinge',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false   // der Host einer Runde mit Freunden darf im Hintergrund weiterrechnen
    }
  });
  win.setMenu(null);
  win.loadFile(path.join(__dirname, '..', 'www', 'index.html'));
  // Externe Links im Standardbrowser öffnen, nie im Spielfenster
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file://')) { e.preventDefault(); if (/^https:\/\//.test(url)) shell.openExternal(url); } });
  win.on('closed', () => { win = null; });
}

ipcMain.on('ls:quit', () => app.quit());
ipcMain.on('ls:fullscreen', () => { if (win) win.setFullScreen(!win.isFullScreen()); });

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
