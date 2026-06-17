// Electron — processo principal do FactorIA.
// Sobe o backend Express com as chaves do Porão injetadas como env vars.

const { app, BrowserWindow, ipcMain, shell, safeStorage } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");

// store só pode ser importado após app.whenReady() resolver o safeStorage,
// mas o módulo em si pode ser requerido antes — só as chamadas de encrypt/decrypt
// precisam esperar. O app.whenReady() garante isso.
const store = require("./store");

const isDev = process.env.NODE_ENV === "development";
const BACKEND_PORT = process.env.PORT || 4000;

let mainWindow;
let backendProcess;

// ── Banco ───────────────────────────────────────────────────────────────────
// Garante que o SQLite tenha todas as tabelas (idempotente). Como é self-hosted
// e usa `prisma db push`, não precisamos de arquivos de migração versionados.
function garantirBanco() {
  return new Promise((resolve) => {
    const backendDir = path.join(__dirname, "../backend");
    const prismaBin = path.join(
      backendDir,
      "node_modules",
      ".bin",
      process.platform === "win32" ? "prisma.cmd" : "prisma"
    );
    const proc = spawn(prismaBin, ["db", "push", "--skip-generate", "--accept-data-loss"], {
      cwd: backendDir,
      env: { ...process.env, ...store.getAll() }, // DATABASE_URL do Porão
      stdio: ["ignore", "pipe", "pipe"],
    });
    proc.stdout.on("data", (d) => process.stdout.write(`[db] ${d}`));
    proc.stderr.on("data", (d) => process.stderr.write(`[db] ${d}`));
    proc.on("exit", (code) => {
      if (code !== 0) console.warn(`[db] prisma db push saiu com código ${code}`);
      resolve();
    });
    proc.on("error", (err) => {
      console.warn("[db] não consegui rodar prisma db push:", err.message);
      resolve(); // segue mesmo assim — backend reporta erro de schema se faltar
    });
  });
}

// ── Backend ───────────────────────────────────────────────────────────────────

function iniciarBackend() {
  const serverPath = path.join(__dirname, "../backend/src/server.js");
  const poraoEnv   = store.getAll(); // chaves decriptadas → injetadas no filho

  backendProcess = spawn(process.execPath, [serverPath], {
    cwd: path.join(__dirname, "../backend"),
    env: { ...process.env, ...poraoEnv }, // Porão sobrescreve o .env (se existir)
    stdio: ["ignore", "pipe", "pipe"],
  });

  backendProcess.stdout.on("data", (d) => {
    const linha = d.toString();
    process.stdout.write(`[backend] ${linha}`);
    mainWindow?.webContents.send("backend:log", linha.trim());
  });
  backendProcess.stderr.on("data", (d) => {
    const linha = d.toString();
    process.stderr.write(`[backend] ${linha}`);
    mainWindow?.webContents.send("backend:log", `[err] ${linha.trim()}`);
  });
  backendProcess.on("exit", (code) => {
    console.log(`[backend] Encerrou com código ${code}`);
  });
}

function aguardarBackend(tentativas = 30) {
  return new Promise((resolve, reject) => {
    let restantes = tentativas;
    const tentar = () => {
      http
        .get(`http://127.0.0.1:${BACKEND_PORT}/health`, (res) => {
          if (res.statusCode === 200) return resolve();
          agendar();
        })
        .on("error", agendar);
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
    width: 1400,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: "FactorIA",
    backgroundColor: "#080808",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  const url = isDev
    ? "http://localhost:5173"
    : `file://${path.join(__dirname, "../frontend/dist/index.html")}`;

  mainWindow.loadURL(url);
  mainWindow.on("closed", () => { mainWindow = null; });
}

// ── IPC handlers — Porão ─────────────────────────────────────────────────────

function registrarIPC() {
  // Versão do app
  ipcMain.handle("get-version", () => app.getVersion());

  // Retorna chaves mascaradas (••••) — UI sabe o que está preenchido sem expor o valor
  ipcMain.handle("porao:get", () => store.getAllMasked());

  // Salva as chaves (campos em branco = manter o valor já salvo)
  ipcMain.handle("porao:set", (_event, dados) => {
    const ok = store.setAll(dados);
    return { ok };
  });

  // Reinicia o backend com as novas chaves injetadas
  ipcMain.handle("porao:restart-backend", async () => {
    if (backendProcess) {
      backendProcess.kill("SIGTERM");
      backendProcess = null;
      await new Promise((r) => setTimeout(r, 1000));
    }
    iniciarBackend();
    try {
      await aguardarBackend(20);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
}

// ── Ciclo de vida ─────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  registrarIPC();
  await garantirBanco();   // sincroniza o schema antes de subir o backend
  iniciarBackend();
  try {
    await aguardarBackend();
  } catch (err) {
    console.error("[electron]", err.message);
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
