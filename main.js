/**
 * Bill Flow by CN-SC
 * Electron Main Process
 */
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { startServer } = require('./server');

// Disable backgrounding for consistent performance in background
app.commandLine.appendSwitch('disable-renderer-backgrounding');

let mainWindow;
let serverProcess;

app.whenReady().then(() => {
  // 1. Start the Express server
  const dbPath = path.join(app.getPath('userData'), 'billflow.db');
  serverProcess = startServer(dbPath);

  // 2. Create the main BrowserWindow
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: 'Bill Flow by CN-SC',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  // Register IPC handlers
  ipcMain.handle('print-receipt', async (event, receiptHTML) => {
    let printWindow;
    try {
      printWindow = new BrowserWindow({
        show: false,
        width: 302,
        height: 900,
        webPreferences: { offscreen: true }
      });

      await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(receiptHTML)}`);

      return new Promise((resolve, reject) => {
        printWindow.webContents.print({
          silent: true,
          printBackground: true,
          margins: { marginType: 'none' },
          pageSize: { width: 80000, height: 297000 } // microns for 80mm width
        }, (success, errorType) => {
          if (success) {
            resolve({ printed: true });
          } else {
            reject(new Error(errorType || 'Print failed'));
          }
        });
      });
    } catch (error) {
      throw error;
    } finally {
      if (printWindow && !printWindow.isDestroyed()) {
        printWindow.close();
        printWindow.destroy();
      }
    }
  });

  ipcMain.handle('get-app-version', () => app.getVersion());
  ipcMain.handle('get-server-port', () => 8080);
});

// Window management
app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  if (serverProcess) {
    if (serverProcess.server) {
      serverProcess.server.close();
    }
    if (serverProcess.db) {
      serverProcess.db.close();
    }
  }
});
