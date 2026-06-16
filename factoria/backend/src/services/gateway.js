// Gateway de integração — chaves de API e webhooks de saída.
// Liga sistemas externos (CRM, site, n8n) ao fluxo de mensagens dos bots.
const crypto = require("crypto");
const axios = require("axios");
const prisma = require("../db");

// ── Chaves de API ───────────────────────────────────────────────────────────
// Formato: fct_<8 hex>_<48 hex>. O prefixo (fct_ + 8 hex) é guardado em texto
// pra localizar a chave; o resto entra no hash sha256. Chave de alta entropia
// dispensa hash lento (bcrypt) — sha256 é suficiente e rápido por request.

function gerarChave() {
  const id = crypto.randomBytes(4).toString("hex");   // 8 hex
  const segredo = crypto.randomBytes(24).toString("hex"); // 48 hex
  const prefix = `fct_${id}`;
  const chaveCompleta = `${prefix}_${segredo}`;
  return { prefix, chaveCompleta, keyHash: hashChave(chaveCompleta) };
}

function hashChave(chave) {
  return crypto.createHash("sha256").update(chave).digest("hex");
}

// Extrai o prefixo (fct_xxxxxxxx) de uma chave completa.
function extrairPrefix(chave) {
  const m = /^(fct_[0-9a-f]{8})_/.exec(chave || "");
  return m ? m[1] : null;
}

// Resolve uma chave crua → registro do banco (ou null). Atualiza lastUsedAt.
async function resolverChave(chaveCrua) {
  const prefix = extrairPrefix(chaveCrua);
  if (!prefix) return null;
  const registro = await prisma.apiKey.findUnique({ where: { prefix } });
  if (!registro || !registro.active) return null;

  // Comparação em tempo constante pra evitar timing attack.
  const a = Buffer.from(registro.keyHash);
  const b = Buffer.from(hashChave(chaveCrua));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  // best-effort, não bloqueia a request
  prisma.apiKey.update({ where: { id: registro.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});
  return registro;
}

function temEscopo(apiKey, escopo) {
  return (apiKey.scopes || "").split(",").map((s) => s.trim()).includes(escopo);
}

// ── Webhooks de saída ───────────────────────────────────────────────────────
// Dispara um evento para todos os endpoints inscritos (do bot ou globais).
// Payload assinado com HMAC-SHA256 no header X-FactorIA-Signature.

async function dispararEvento(botId, evento, dados) {
  let endpoints;
  try {
    endpoints = await prisma.webhookEndpoint.findMany({
      where: { active: true, OR: [{ botId }, { botId: null }] },
    });
  } catch (_) {
    return;
  }

  const inscritos = endpoints.filter((e) =>
    (e.events || "").split(",").map((s) => s.trim()).includes(evento)
  );
  if (inscritos.length === 0) return;

  const corpo = JSON.stringify({ evento, botId, dados, ts: Date.now() });

  await Promise.allSettled(
    inscritos.map((e) => {
      const assinatura = crypto.createHmac("sha256", e.secret).update(corpo).digest("hex");
      return axios.post(e.url, corpo, {
        headers: {
          "Content-Type": "application/json",
          "X-FactorIA-Signature": assinatura,
          "X-FactorIA-Event": evento,
        },
        timeout: 8000,
      }).catch((err) => {
        console.error(`[gateway] webhook ${e.url} falhou:`, err.message);
      });
    })
  );
}

module.exports = {
  gerarChave,
  hashChave,
  extrairPrefix,
  resolverChave,
  temEscopo,
  dispararEvento,
};
