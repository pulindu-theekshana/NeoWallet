const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

// Required for Windows installer (Squirrel) to work
try { if (require('electron-squirrel-startup')) app.quit(); } catch (_) {}

// true when running the installed app, false during "npm start"
const isDev = !app.isPackaged;

let mainWindow;
let pythonProcess;

function startPythonBackend() {
  let command, args = [], options = {};

  if (isDev) {
    // ── Development: use venv + app.py ──────────────────────
    const root = path.join(__dirname, '..');
    command  = path.join(root, 'venv', 'Scripts', 'python.exe');
    args     = [path.join(root, 'backend', 'app.py')];
    options  = { cwd: path.join(root, 'backend') };
  } else {
    // ── Production: use the PyInstaller bundled exe ─────────
    // process.resourcesPath = the "resources" folder inside the installed app
    command  = path.join(process.resourcesPath, 'flask_backend.exe');
    options  = { cwd: process.resourcesPath };
  }

  console.log('[Main] Starting backend:', command);

  pythonProcess = spawn(command, args, options);

  // Log output for debugging (visible in dev terminal)
  pythonProcess.stdout?.on('data', d => console.log('[Flask]',     d.toString().trim()));
  pythonProcess.stderr?.on('data', d => console.log('[Flask LOG]', d.toString().trim()));
  pythonProcess.on('error', err  => console.error('[Backend] Failed to start:', err.message));
  pythonProcess.on('close', code => console.log('[Backend] Stopped, code:', code));
}

function createWindow() {
  const iconPath = isDev
    ? path.join(__dirname, '..', 'assets', 'icon.ico')
    : path.join(process.resourcesPath, 'icon.ico');

  mainWindow = new BrowserWindow({
    width:    1280,
    height:   800,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: '#111827',
    autoHideMenuBar: true,
    icon: iconPath,
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      nodeIntegration:  false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Uncomment to debug in production:
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  startPythonBackend();
  createWindow();
});

app.on('window-all-closed', () => {
  // Kill the Flask server when the app window closes
  if (pythonProcess) {
    pythonProcess.kill();
    console.log('[Main] Backend stopped.');
  }
  if (process.platform !== 'darwin') app.quit();
});