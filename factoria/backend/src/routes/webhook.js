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
const prisma = require("../db");
const waha  = require("../services/waha");
const brain = require("../services/brain");
const gateway = require("../services/gateway");
const atendimento = require("../services/atendimento");
const workflow = require("../services/workflow");

// Humanização: simula "digitando" por um tempo proporcional ao tamanho do
// texto (limitado), pra resposta não chegar instantânea como robô.
async function simularDigitando(bot, chatId, texto) {
  if (process.env.HUMANIZE === "off") return;
  try {
    await waha.startTyping(bot.wahaPort, chatId);
    const ms = Math.min(600 + texto.length * 25, 4500);
    await new Promise((r) => setTimeout(r, ms));
    await waha.stopTyping(bot.wahaPort, chatId);
  } catch (_) { /* presença é best-effort */ }
}

// Envia uma mensagem de saída: digitando + WAHA + log + evento de webhook.
async function enviarResposta(bot, chatId, texto) {
  if (!texto) return;
  await simularDigitando(bot, chatId, texto);
  await waha.sendText(bot.wahaPort, chatId, texto);
  await prisma.log.create({
    data: { botId: bot.id, phone: chatId, direction: "out", body: texto },
  });
  gateway.dispararEvento(bot.id, "message.out", { to: chatId, text: texto });
}

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
    gateway.dispararEvento(botId, "message.in", { from: chatId, text: textoOriginal });

    // Conversa do contato (atendimento virtual)
    const conversa = await atendimento.upsertConversa(botId, chatId, payload.notifyName || payload._data?.notifyName || "");

    // Um operador humano assumiu — a IA fica em silêncio.
    if (conversa.status === "human") return;

    // Pedido espontâneo de atendente humano → handoff.
    const motivo = atendimento.detectarHandoff(normalized);
    if (motivo) {
      await atendimento.handoff(conversa, motivo);
      await enviarResposta(bot, chatId, "Perfeito! Já estou te passando pra um atendente. 🙋 Aguarde um instante.");
      gateway.dispararEvento(botId, "handoff", { phone: chatId, reason: motivo });
      console.log(`[webhook] Handoff de ${chatId} no bot ${bot.name}: ${motivo}`);
      return;
    }

    // 1) Skills (resposta fixa, sem LLM) têm prioridade.
    const skills = await prisma.skill.findMany({ where: { botId, active: true } });
    const skill  = skills.find((s) => normalized.includes(s.trigger.toLowerCase()));
    if (skill) {
      await enviarResposta(bot, chatId, skill.response);
      return;
    }

    // 2) Fluxo de trabalho ativo? Roda a máquina de estados.
    const flow = await prisma.flow.findUnique({ where: { botId } }).catch(() => null);
    if (flow?.active) {
      let def = {};
      try { def = JSON.parse(flow.definition || "{}"); } catch (_) {}
      const vars = (() => { try { return JSON.parse(conversa.flowVars || "{}"); } catch { return {}; } })();

      const r = conversa.flowNodeId
        ? workflow.responder(def, conversa.flowNodeId, vars, textoOriginal)
        : workflow.iniciar(def, vars);

      for (const reply of r.replies || []) await enviarResposta(bot, chatId, reply);

      if (r.handoff) {
        await atendimento.handoff(conversa, r.reason || "fluxo");
        gateway.dispararEvento(botId, "handoff", { phone: chatId, reason: r.reason });
        return;
      }

      // Persiste o nó atual (null se terminou) e as variáveis coletadas.
      await atendimento.salvarEstadoFluxo(conversa.id, r.end ? null : r.nodeId, r.vars);

      // Só cai no cérebro se o nó pediu (tipo "ai"); senão encerra o turno.
      if (!r.defer) return;
    }

    // 3) Cérebro (LLM) — recebe os dados já coletados pelo fluxo como contexto.
    const vars = (() => { try { return JSON.parse(conversa.flowVars || "{}"); } catch { return {}; } })();
    const resposta = await brain.responder(bot, textoOriginal, chatId, { vars });
    await enviarResposta(bot, chatId, resposta);
  } catch (err) {
    console.error("[webhook] Erro:", err.message);
  }
});

module.exports = router;
