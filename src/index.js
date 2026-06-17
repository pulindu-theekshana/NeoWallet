const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

// This handles Windows installer startup events
if (require('electron-squirrel-startup')) { app.quit(); }

let mainWindow;
let pythonProcess;

function startPythonBackend() {
  // Points to the venv Python inside your project folder
  const projectRoot = path.join(__dirname, '..');
  const pythonExe   = path.join(projectRoot, 'venv', 'Scripts', 'python.exe');
  const backendFile  = path.join(projectRoot, 'backend', 'app.py');

  console.log('[Main] Launching Python backend...');

  pythonProcess = spawn(pythonExe, [backendFile], {
    cwd: path.join(projectRoot, 'backend'),
  });

  pythonProcess.stdout.on('data', data => console.log(`[Python] ${data}`));
  pythonProcess.stderr.on('data', data => console.error(`[Python ERR] ${data}`));
  pythonProcess.on('close',  code => console.log(`[Python] exited with code ${code}`));
  pythonProcess.on('error',  err  => console.error('[Python] Failed to start:', err.message));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width:    1280,
    height:   800,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: '#111827',
    autoHideMenuBar: true,   // Hides the File/Edit menu bar for a cleaner look
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      nodeIntegration:  false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Uncomment the next line to open Chrome DevTools for debugging:
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  startPythonBackend();
  createWindow();
});

app.on('window-all-closed', () => {
  if (pythonProcess) {
    pythonProcess.kill();
    console.log('[Main] Python backend stopped.');
  }
  if (process.platform !== 'darwin') app.quit();
});