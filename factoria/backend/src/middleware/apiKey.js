// Middleware de autenticação por chave de API (para o gateway /v1).
// Aceita a chave em "Authorization: Bearer fct_..." ou no header "X-API-Key".
const gateway = require("../services/gateway");
const { AppError } = require("../utils/http");

function extrairChave(req) {
  const auth = req.headers.authorization || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  if (req.headers["x-api-key"]) return String(req.headers["x-api-key"]).trim();
  return null;
}

// Exige chave válida e, opcionalmente, um escopo (send|read|chat).
function requireApiKey(escopo) {
  return async (req, _res, next) => {
    const chave = extrairChave(req);
    if (!chave) return next(new AppError(401, "Chave de API necessária"));

    const apiKey = await gateway.resolverChave(chave);
    if (!apiKey) return next(new AppError(401, "Chave de API inválida"));

    if (escopo && !gateway.temEscopo(apiKey, escopo)) {
      return next(new AppError(403, `Chave sem escopo '${escopo}'`));
    }

    req.apiKey = apiKey;
    next();
  };
}

// Resolve o bot alvo respeitando o escopo da chave.
// Se a chave é restrita a um bot, ignora o botId do corpo e usa o dela.
function botAlvo(req, botIdSolicitado) {
  if (req.apiKey?.botId) return req.apiKey.botId;
  return botIdSolicitado || null;
}

module.exports = { requireApiKey, botAlvo };
