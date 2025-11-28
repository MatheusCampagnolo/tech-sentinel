const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { PythonShell } = require("python-shell");
const { exec } = require("child_process");

let mainWindow;
let pyshell;

ipcMain.on("kill-process", (event, pid) => {
  console.log(`Tentando matar processo PID: ${pid}`);

  exec(`taskkill /F /PID ${pid}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Erro ao matar processo: ${error.message}`);
      return;
    }
    console.log(`Processo ${pid} eliminado.`);
  });
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    // remover a barra de menu padrão (File, Edit, etc)
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // Remove o menu explicitamente
  mainWindow.setMenuBarVisibility(false);

  const isDev = process.env.NODE_ENV === "development";

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    // Descomente para abrir o DevTools automaticamente em dev
    // mainWindow.webContents.openDevTools(); 
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  startPythonSubprocess();

  mainWindow.on("closed", () => {
    mainWindow = null;
    if (pyshell) pyshell.kill();
  });
}

function startPythonSubprocess() {
  const pythonExecutable = path.join(__dirname, "../venv/Scripts/python.exe");

  let options = {
    mode: "text",
    pythonPath: pythonExecutable,
    scriptPath: path.join(__dirname, "../engine"),
  };

  try {
    pyshell = new PythonShell("api.py", options);
  } catch (e) {
    console.error("Erro ao iniciar PythonShell:", e);
  }

  pyshell.on("message", function (message) {
    if (mainWindow) {
      mainWindow.webContents.send("from-python", message);
    }
  });

  pyshell.on("stderr", function (stderr) {
    console.log("PY Error:", stderr);
  });

  pyshell.end(function (err, code, signal) {
    if (err) console.error("Python morreu:", err);
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (pyshell) pyshell.kill();
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
