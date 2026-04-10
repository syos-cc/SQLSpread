const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');
}

ipcMain.handle('sqlspread:open-database', async () => {
  if (!mainWindow) return { canceled: true };

  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Open SQLite database',
    properties: ['openFile'],
    filters: [
      {
        name: 'SQLite databases',
        extensions: ['sqlite', 'sqlite3', 'db', 'db3']
      },
      {
        name: 'All files',
        extensions: ['*']
      }
    ]
  });

  if (canceled || !filePaths.length) {
    return { canceled: true };
  }

  const filePath = filePaths[0];
  const data = await fs.readFile(filePath);

  return {
    canceled: false,
    path: filePath,
    name: path.basename(filePath),
    data: Array.from(data)
  };
});

ipcMain.handle('sqlspread:save-database', async (_event, payload = {}) => {
  if (!mainWindow) return { canceled: true };

  const suggestedName =
    typeof payload.filename === 'string' && payload.filename.trim()
      ? payload.filename.trim()
      : 'database.sqlite';

  let targetPath =
    typeof payload.path === 'string' && payload.path.trim()
      ? payload.path
      : null;

  if (!targetPath) {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save SQLite database',
      defaultPath: suggestedName,
      filters: [
        {
          name: 'SQLite databases',
          extensions: ['sqlite', 'sqlite3', 'db', 'db3']
        },
        {
          name: 'All files',
          extensions: ['*']
        }
      ]
    });

    if (canceled || !filePath) {
      return { canceled: true };
    }

    targetPath = filePath;
  }

  const bytes = payload.data;
  if (!Array.isArray(bytes)) {
    throw new Error('Invalid database payload');
  }

  await fs.writeFile(targetPath, Buffer.from(bytes));

  return {
    canceled: false,
    path: targetPath,
    name: path.basename(targetPath)
  };
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});