// Preload — expõe APIs seguras do Electron pro renderer via contextBridge.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Versão do app
  getVersion: () => ipcRenderer.invoke("get-version"),

  // Porão: cofre de chaves
  poraoGet:     ()       => ipcRenderer.invoke("porao:get"),
  poraoSet:     (dados)  => ipcRenderer.invoke("porao:set", dados),
  poraoRestart: ()       => ipcRenderer.invoke("porao:restart-backend"),

  // Logs do backend em tempo real (stream)
  onBackendLog:  (cb) => ipcRenderer.on("backend:log", (_e, linha) => cb(linha)),
  offBackendLog: (cb) => ipcRenderer.removeListener("backend:log", cb),
});
