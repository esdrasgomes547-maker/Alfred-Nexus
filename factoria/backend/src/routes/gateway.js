// Gateway público de integração — /v1
// Autenticado por CHAVE DE API (não por login). Permite que sistemas externos
// (site, CRM, n8n) conversem com os bots e usem a inteligência deles.
const express = require("express");
const router = express.Router();
const { z } = require("zod");
const prisma = require("../db");
const waha = require("../services/waha");
const brain = require("../services/brain");
const gateway = require("../services/gateway");
const { asyncHandler, AppError, validar } = require("../utils/http");
const { requireApiKey, botAlvo } = require("../middleware/apiKey");

// Carrega o bot respeitando o escopo da chave.
async function resolverBot(req, botIdSolicitado) {
  const id = botAlvo(req, botIdSolicitado);
  if (!id) throw new AppError(400, "botId obrigatório (ou use uma chave restrita a um bot)");
  const bot = await prisma.bot.findUnique({ where: { id } });
  if (!bot) throw new AppError(404, "Bot não encontrado");
  if (req.apiKey.botId && req.apiKey.botId !== bot.id) {
    throw new AppError(403, "Chave não tem acesso a este bot");
  }
  return bot;
}

// GET /v1/bots — bots acessíveis pela chave
router.get("/bots", requireApiKey("read"), asyncHandler(async (req, res) => {
  const where = req.apiKey.botId ? { id: req.apiKey.botId } : {};
  const bots = await prisma.bot.findMany({
    where,
    select: { id: true, name: true, active: true, wahaPort: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ bots });
}));

// POST /v1/messages — envia mensagem de WhatsApp por um bot
const enviarSchema = z.object({
  botId: z.string().optional(),
  to:    z.string().trim().min(5, "destinatário (to) obrigatório"),
  text:  z.string().trim().min(1, "text obrigatório").max(4000),
});

router.post("/messages", requireApiKey("send"), validar(enviarSchema), asyncHandler(async (req, res) => {
  const bot = await resolverBot(req, req.body.botId);
  // Normaliza número → chatId do WhatsApp (formato "<num>@c.us")
  const chatId = /@/.test(req.body.to) ? req.body.to : `${req.body.to.replace(/\D/g, "")}@c.us`;

  const resultado = await waha.sendText(bot.wahaPort, chatId, req.body.text);
  if (!resultado) throw new AppError(502, "Falha ao enviar — o WAHA está conectado?");

  await prisma.log.create({
    data: { botId: bot.id, phone: chatId, direction: "out", body: req.body.text },
  });
  gateway.dispararEvento(bot.id, "message.out", { to: chatId, text: req.body.text, via: "api" });

  res.status(201).json({ ok: true, to: chatId });
}));

// GET /v1/messages?botId=&phone=&limit= — histórico de mensagens
router.get("/messages", requireApiKey("read"), asyncHandler(async (req, res) => {
  const bot = await resolverBot(req, req.query.botId);
  const limite = Math.min(parseInt(req.query.limit || "50", 10) || 50, 200);
  const where = { botId: bot.id };
  if (req.query.phone) {
    const p = String(req.query.phone);
    where.phone = /@/.test(p) ? p : `${p.replace(/\D/g, "")}@c.us`;
  }
  const logs = await prisma.log.findMany({ where, orderBy: { createdAt: "desc" }, take: limite });
  res.json({ messages: logs.reverse() });
}));

// POST /v1/chat — completa uma resposta usando o cérebro do bot, SEM enviar
// pro WhatsApp. Serve pra widget de site, simulações e integrações de chat.
const chatSchema = z.object({
  botId:   z.string().optional(),
  message: z.string().trim().min(1, "message obrigatório").max(4000),
  // sessionId isola o histórico em memória (ex.: id do visitante do site)
  sessionId: z.string().trim().max(120).optional(),
});

router.post("/chat", requireApiKey("chat"), validar(chatSchema), asyncHandler(async (req, res) => {
  const bot = await resolverBot(req, req.body.botId);
  const sessionId = req.body.sessionId || `api:${req.apiKey.id}`;

  const resposta = await brain.responder(bot, req.body.message, `gw::${sessionId}`);
  if (resposta === null) throw new AppError(502, "Cérebro indisponível — verifique a chave do LLM");

  res.json({ reply: resposta, botId: bot.id, sessionId });
}));

module.exports = router;
