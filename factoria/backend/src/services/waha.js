// Cliente WAHA — chamadas HTTP pra API do WhatsApp de cada bot.
// Cada bot tem seu próprio container WAHA na porta wahaPort.
//
// Hardening anti-loop: toda mensagem enviada tem seu ID registrado em
// global.sentMessages (TTLMap). O webhook ignora mensagens cujo ID consta lá.

const axios = require("axios");

// ── TTLMap: substitui Set/Map que crescem infinitamente (pendência #3) ──────
class TTLMap {
  constructor(ttlMs = 5 * 60 * 1000) {
    this._map = new Map(); // id -> timestamp da inserção
    this._ttl = ttlMs;
  }

  set(key) {
    this._map.set(key, Date.now());
    // Limpa expirados a cada inserção (custo amortizado)
    if (this._map.size > 500) this._purge();
  }

  has(key) {
    const ts = this._map.get(key);
    if (ts === undefined) return false;
    if (Date.now() - ts > this._ttl) {
      this._map.delete(key);
      return false;
    }
    return true;
  }

  delete(key) {
    return this._map.delete(key);
  }

  _purge() {
    const limite = Date.now() - this._ttl;
    for (const [k, ts] of this._map.entries()) {
      if (ts < limite) this._map.delete(k);
    }
  }
}

// Singleton global — sobrevive a require() repetidos no mesmo processo
if (!global.sentMessages) {
  global.sentMessages = new TTLMap(5 * 60 * 1000);
}

// ── Extrai o ID canônico da resposta do WAHA ─────────────────────────────────
function extrairId(data) {
  if (!data) return null;
  if (typeof data.id === "string") return data.id;
  if (data.id?._serialized) return data.id._serialized;
  if (data.id?.id)           return data.id.id;
  if (data.key?.id)          return data.key.id;
  return null;
}

// ── Helpers HTTP ──────────────────────────────────────────────────────────────
function baseUrl(wahaPort) {
  return `http://127.0.0.1:${wahaPort}`;
}

async function req(wahaPort, method, path, body = null) {
  try {
    const resp = await axios({
      method,
      url: `${baseUrl(wahaPort)}${path}`,
      data: body,
      timeout: 15_000,
    });
    return resp.data;
  } catch (err) {
    console.error(`[waha] ${method.toUpperCase()} ${path} →`, err.message);
    return null;
  }
}

// ── API pública ───────────────────────────────────────────────────────────────

// ── Anti-ban: ritmo controlado de envio (guardrail do projeto) ──────────────
// WAHA é não-oficial — rajadas de mensagens aumentam o risco de ban. Os envios
// de cada bot são serializados numa fila, com um intervalo mínimo entre eles.
const GAP_MIN_MS = parseInt(process.env.SEND_GAP_MS || "1200", 10);
const filaEnvio = new Map(); // wahaPort -> cauda da fila (Promise)
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

function enfileirar(wahaPort, tarefa) {
  const anterior = filaEnvio.get(wahaPort) || Promise.resolve();
  // tarefa roda após a anterior (mesmo se ela falhou); o gap vem depois.
  const minha = anterior.then(tarefa, tarefa);
  filaEnvio.set(wahaPort, minha.then(() => espera(GAP_MIN_MS), () => espera(GAP_MIN_MS)));
  return minha;
}

async function sendText(wahaPort, chatId, text) {
  return enfileirar(wahaPort, async () => {
    const data = await req(wahaPort, "post", "/api/sendText", {
      session: "default",
      chatId,
      text,
    });
    const id = extrairId(data);
    if (id) global.sentMessages.set(id);
    return data;
  });
}

async function startSession(wahaPort) {
  return req(wahaPort, "post", "/api/sessions/default/start", {});
}

async function stopSession(wahaPort) {
  return req(wahaPort, "post", "/api/sessions/default/stop", {});
}

async function sessionStatus(wahaPort) {
  return req(wahaPort, "get", "/api/sessions/default");
}

async function getQR(wahaPort) {
  return req(wahaPort, "get", "/api/screenshot");
}

async function startTyping(wahaPort, chatId) {
  return req(wahaPort, "post", "/api/startTyping", {
    session: "default",
    chatId,
  });
}

async function stopTyping(wahaPort, chatId) {
  return req(wahaPort, "post", "/api/stopTyping", {
    session: "default",
    chatId,
  });
}

module.exports = {
  sendText,
  startSession,
  stopSession,
  sessionStatus,
  getQR,
  startTyping,
  stopTyping,
};
