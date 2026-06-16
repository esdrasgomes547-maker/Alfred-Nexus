// Porão — cofre de chaves encriptado com safeStorage do Electron.
// As chaves ficam em userData/poraoConfig.enc (binário), encriptado pelo
// keychain do OS. NUNCA ficam em texto plano em disco.

const { safeStorage, app } = require("electron");
const path = require("path");
const fs   = require("fs");

const CONFIG_PATH = path.join(app.getPath("userData"), "poraoConfig.enc");

const PADROES = {
  GROQ_API_KEY:       "",
  ANTHROPIC_API_KEY:  "",
  WAHA_BASE_URL:      "http://waha:3000",
  WAHA_API_KEY:       "",
  ELEVENLABS_API_KEY: "",
  ANDRE_WHATSAPP:     "",
  DATABASE_URL:       "file:./factoria.db",
};

function getAll() {
  if (!safeStorage.isEncryptionAvailable()) {
    console.warn("[store] safeStorage indisponível — usando padrões.");
    return { ...PADROES };
  }
  try {
    if (!fs.existsSync(CONFIG_PATH)) return { ...PADROES };
    const enc  = fs.readFileSync(CONFIG_PATH);
    const json = safeStorage.decryptString(enc);
    return { ...PADROES, ...JSON.parse(json) };
  } catch (err) {
    console.error("[store] Falha ao ler config:", err.message);
    return { ...PADROES };
  }
}

function setAll(dados) {
  if (!safeStorage.isEncryptionAvailable()) {
    console.warn("[store] safeStorage indisponível — config não salva.");
    return false;
  }
  try {
    const atual = getAll();
    // Não sobrescreve campo existente com string vazia (usuário deixou o campo em branco)
    const novo  = { ...atual };
    for (const [k, v] of Object.entries(dados)) {
      if (v !== "" && v !== undefined) novo[k] = v;
    }
    const enc = safeStorage.encryptString(JSON.stringify(novo));
    fs.writeFileSync(CONFIG_PATH, enc);
    return true;
  } catch (err) {
    console.error("[store] Falha ao salvar config:", err.message);
    return false;
  }
}

// Retorna objeto com valores mascarados (••••) para exibir na UI sem expor a chave real.
// Usado pelo poraoGet no IPC: o renderer sabe quais campos estão preenchidos, mas não o valor.
function getAllMasked() {
  const dados = getAll();
  const mascarado = {};
  for (const [k, v] of Object.entries(dados)) {
    mascarado[k] = v ? "••••••••" : "";
  }
  return mascarado;
}

module.exports = { getAll, setAll, getAllMasked };
