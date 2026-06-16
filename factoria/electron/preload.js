// Preload — expõe versão limitada do Node/Electron pra renderer (seguro).
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Versão do app (do package.json raiz)
  getVersion: () => ipcRenderer.invoke("get-version"),
});
