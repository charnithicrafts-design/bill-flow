/**
 * Bill Flow by CN-SC
 * Preload Script for Secure Context Bridge
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('billflow', {
  printReceipt: (html) => ipcRenderer.invoke('print-receipt', html),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getServerPort: () => ipcRenderer.invoke('get-server-port'),
});
