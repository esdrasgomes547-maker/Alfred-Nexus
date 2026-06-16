// Electron — processo principal do FactorIA.
// Serve o frontend buildado e sobe o backend Express como processo filho.

const { app, BrowserWindow, shell } = require("electron");
const path  = require("path");
const { spawn } = require("child_process");
const http  = require("http");

const isDev = process.env.NODE_ENV === "development";
const BACKEND_PORT = process.env.PORT || 4000;
const FRONTEND_DEV = "http://localhost:5173";

let mainWindow;
let backendProcess;

// ── Backend ───────────────────────────────────────────────────────────────────

function iniciarBackend() {
  const serverPath = path.join(__dirname, "../backend/src/server.js");
  backendProcess = spawn(process.execPath, [serverPath], {
    cwd: path.join(__dirname, "../backend"),
    env: { ...process.env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  backendProcess.stdout.on("data", (d) => process.stdout.write(`[backend] ${d}`));
  backendProcess.stderr.on("data", (d) => process.stderr.write(`[backend] ${d}`));

  backendProcess.on("exit", (code) => {
    console.log(`[backend] Encerrou com código ${code}`);
  });
}

function aguardarBackend(tentativas = 20) {
  return new Promise((resolve, reject) => {
    let restantes = tentativas;
    const tentar = () => {
      http.get(`http://127.0.0.1:${BACKEND_PORT}/health`, (res) => {
        if (res.statusCode === 200) return resolve();
        agendar();
      }).on("error", agendar);
    };
    const agendar = () => {
      if (--restantes <= 0) return reject(new Error("Backend não subiu a tempo."));
      setTimeout(tentar, 500);
    };
    tentar();
  });
}

// ── Janela ────────────────────────────────────────────────────────────────────

function criarJanela() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "FactorIA",
    webPreferences: {
      preload:        path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Abre links externos no browser do sistema (não dentro do Electron)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  const url = isDev
    ? FRONTEND_DEV
    : `file://${path.join(__dirname, "../frontend/dist/index.html")}`;

  mainWindow.loadURL(url);
  mainWindow.on("closed", () => { mainWindow = null; });
}

// ── Ciclo de vida ─────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  iniciarBackend();
  try {
    await aguardarBackend();
  } catch (err) {
    console.error("[electron]", err.message);
    // Mesmo assim tenta abrir a janela — o usuário verá o erro na UI
  }
  criarJanela();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) criarJanela();
});

app.on("before-quit", () => {
  if (backendProcess) {
    backendProcess.kill("SIGTERM");
    backendProcess = null;
  }
});
