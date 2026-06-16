// Webhook — recebe eventos do WAHA em tempo real para cada bot.
// Rota: POST /webhook/waha/:botId
//
// ── FIX @lev/@levoff (não reintroduzir) ──────────────────────────────────────
// Detecção de comando usa IGUALDADE EXATA sobre a mensagem inteira normalizada.
// NUNCA usar .includes() — qualquer mensagem contendo a substring (inclusive a
// confirmação do próprio bot que volta como evento) dispararia o comando errado.
//
// ── Hardening anti-loop ───────────────────────────────────────────────────────
// IDs de mensagens enviadas por nós vivem em global.sentMessages (TTLMap em
// waha.js). O ID recebido é normalizado igual ao que foi registrado no envio.

const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const waha  = require("../services/waha");
const brain = require("../services/brain");

const prisma = new PrismaClient();

// Deduplicação de eventos (WAHA às vezes reenvia). TTL de 5 min.
const seen = new Map(); // msgId -> timestamp

function limpaSeen() {
  const limite = Date.now() - 5 * 60 * 1000;
  for (const [id, ts] of seen.entries()) {
    if (ts < limite) seen.delete(id);
  }
}

// Normaliza o ID da mensagem recebida para o mesmo formato que waha.js registra.
function normalizarId(raw) {
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  return raw._serialized || raw.id || raw.key?.id || String(raw);
}

router.post("/:botId", async (req, res) => {
  // Responde 200 imediatamente — o WAHA não deve esperar o processamento
  res.sendStatus(200);

  try {
    const { botId } = req.params;
    const corpo = req.body;

    if (corpo.event !== "message") return;
    const payload = corpo.payload || {};

    // Ignora mensagens enviadas pelo próprio bot
    if (payload.fromMe) return;

    const msgId = normalizarId(payload.id || payload.key);

    // Anti-loop: ignora mensagens que nós enviamos (registradas no sentMessages)
    if (global.sentMessages?.has(msgId)) {
      global.sentMessages.delete(msgId);
      return;
    }

    // Deduplicação de reentregas do WAHA
    limpaSeen();
    if (seen.has(msgId)) return;
    seen.set(msgId, Date.now());

    const bot = await prisma.bot.findUnique({ where: { id: botId } });
    if (!bot) return;

    const chatId = payload.from || payload.chatId;

    // Normaliza a mensagem recebida (NFKC remove variações de Unicode)
    const textoOriginal = (payload.body || "").normalize("NFKC").replace(/\s+/g, " ").trim();
    const normalized    = textoOriginal.toLowerCase();

    // Comandos de controle configuráveis por bot (pendência #2 do handoff)
    const cmdOn  = (bot.cmdOn  || "@lev").toLowerCase();
    const cmdOff = (bot.cmdOff || "@levoff").toLowerCase();

    // ── IGUALDADE EXATA — não usar .includes() ──────────────────────────────
    const isActivate   = normalized === cmdOn;
    const isDeactivate = normalized === cmdOff;
    // ────────────────────────────────────────────────────────────────────────

    if (isActivate) {
      await prisma.bot.update({ where: { id: botId }, data: { active: true } });
      await waha.sendText(bot.wahaPort, chatId, "Lev ON. 🟢");
      console.log(`[webhook] Bot ${bot.name} ativado por ${chatId}`);
      return;
    }

    if (isDeactivate) {
      await prisma.bot.update({ where: { id: botId }, data: { active: false } });
      await waha.sendText(bot.wahaPort, chatId, "Lev OFF.");
      console.log(`[webhook] Bot ${bot.name} desativado por ${chatId}`);
      return;
    }

    // Bot desligado — silêncio total
    if (!bot.active) return;

    // Registra mensagem recebida
    await prisma.log.create({
      data: { botId, phone: chatId, direction: "in", body: textoOriginal },
    });

    // Verifica se alguma skill responde (resposta fixa, sem LLM)
    const skills = await prisma.skill.findMany({ where: { botId, active: true } });
    const skill  = skills.find((s) => normalized.includes(s.trigger.toLowerCase()));

    let resposta;
    if (skill) {
      resposta = skill.response;
    } else {
      // Cérebro (LLM)
      resposta = await brain.responder(bot, textoOriginal, chatId);
    }

    if (resposta) {
      await waha.sendText(bot.wahaPort, chatId, resposta);
      await prisma.log.create({
        data: { botId, phone: chatId, direction: "out", body: resposta },
      });
    }
  } catch (err) {
    console.error("[webhook] Erro:", err.message);
  }
});

module.exports = router;
