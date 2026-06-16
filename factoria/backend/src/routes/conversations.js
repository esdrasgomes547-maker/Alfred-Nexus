// Rotas /api/conversations — central de atendimento virtual (protegidas por login).
const express = require("express");
const router = express.Router();
const { z } = require("zod");
const prisma = require("../db");
const waha = require("../services/waha");
const gateway = require("../services/gateway");
const brain = require("../services/brain");
const { asyncHandler, AppError, validar } = require("../utils/http");

async function exigirConversa(id) {
  const c = await prisma.conversation.findUnique({ where: { id } });
  if (!c) throw new AppError(404, "Conversa não encontrada");
  return c;
}

// GET /api/conversations?botId=&status= — lista conversas
router.get("/", asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.botId)  where.botId = String(req.query.botId);
  if (req.query.status) where.status = String(req.query.status);
  const conversas = await prisma.conversation.findMany({
    where,
    orderBy: { lastMessageAt: "desc" },
    take: 200,
  });
  res.json(conversas);
}));

// GET /api/conversations/:id — conversa + últimas mensagens
router.get("/:id", asyncHandler(async (req, res) => {
  const conversa = await exigirConversa(req.params.id);
  const logs = await prisma.log.findMany({
    where: { botId: conversa.botId, phone: conversa.phone },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
  res.json({ conversa, mensagens: logs.reverse() });
}));

// POST /api/conversations/:id/assumir — operador assume (IA cala)
router.post("/:id/assumir", asyncHandler(async (req, res) => {
  const conversa = await exigirConversa(req.params.id);
  const atualizada = await prisma.conversation.update({
    where: { id: conversa.id },
    data: { status: "human", assignedTo: req.user.id, handoffReason: conversa.handoffReason || "assumido pelo operador" },
  });
  res.json(atualizada);
}));

// POST /api/conversations/:id/devolver — devolve pra IA
router.post("/:id/devolver", asyncHandler(async (req, res) => {
  const conversa = await exigirConversa(req.params.id);
  brain.limparMemoria({ id: conversa.botId }, conversa.phone); // contexto fresco
  const atualizada = await prisma.conversation.update({
    where: { id: conversa.id },
    data: { status: "bot", assignedTo: null },
  });
  res.json(atualizada);
}));

// POST /api/conversations/:id/encerrar — fecha a conversa
router.post("/:id/encerrar", asyncHandler(async (req, res) => {
  const conversa = await exigirConversa(req.params.id);
  const atualizada = await prisma.conversation.update({
    where: { id: conversa.id },
    data: { status: "closed" },
  });
  res.json(atualizada);
}));

// POST /api/conversations/:id/reiniciar-fluxo — zera o estado do workflow
router.post("/:id/reiniciar-fluxo", asyncHandler(async (req, res) => {
  const conversa = await exigirConversa(req.params.id);
  const atualizada = await prisma.conversation.update({
    where: { id: conversa.id },
    data: { flowNodeId: null, flowVars: "{}" },
  });
  res.json(atualizada);
}));

// POST /api/conversations/:id/responder — operador envia mensagem manual (como o bot)
const respSchema = z.object({ text: z.string().trim().min(1, "text obrigatório").max(4000) });
router.post("/:id/responder", validar(respSchema), asyncHandler(async (req, res) => {
  const conversa = await exigirConversa(req.params.id);
  const bot = await prisma.bot.findUnique({ where: { id: conversa.botId } });
  if (!bot) throw new AppError(404, "Bot da conversa não encontrado");

  const r = await waha.sendText(bot.wahaPort, conversa.phone, req.body.text);
  if (!r) throw new AppError(502, "Falha ao enviar — WAHA conectado?");

  await prisma.log.create({
    data: { botId: bot.id, phone: conversa.phone, direction: "out", body: req.body.text },
  });
  await prisma.conversation.update({
    where: { id: conversa.id },
    data: { lastMessageAt: new Date() },
  });
  gateway.dispararEvento(bot.id, "message.out", { to: conversa.phone, text: req.body.text, via: "operador" });
  res.status(201).json({ ok: true });
}));

module.exports = router;
