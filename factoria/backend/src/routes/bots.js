// Rotas /api/bots — CRUD, conectar, status, logs do bot
const express = require("express");
const router = express.Router();
const { z } = require("zod");
const prisma = require("../db");
const docker = require("../services/docker");
const waha   = require("../services/waha");
const { asyncHandler, AppError, validar } = require("../utils/http");

const PORTA_BASE = 4100;

// Aloca a próxima porta livre.
// Usar count() era um bug: após deletar um bot, a contagem cai e a porta
// colide com outro container existente. Aqui pegamos a MAIOR porta usada + 1.
async function proximaPorta() {
  const ultimo = await prisma.bot.findFirst({
    orderBy: { wahaPort: "desc" },
    select: { wahaPort: true },
  });
  return ultimo ? ultimo.wahaPort + 1 : PORTA_BASE;
}

// Carrega um bot ou lança 404.
async function exigirBot(id) {
  const bot = await prisma.bot.findUnique({ where: { id } });
  if (!bot) throw new AppError(404, "Bot não encontrado");
  return bot;
}

const criarSchema = z.object({
  name:   z.string().trim().min(1, "name obrigatório").max(80),
  prompt: z.string().max(8000).optional(),
  cmdOn:  z.string().trim().min(1).max(40).optional(),
  cmdOff: z.string().trim().min(1).max(40).optional(),
});

const editarSchema = z.object({
  name:   z.string().trim().min(1).max(80).optional(),
  prompt: z.string().max(8000).optional(),
  cmdOn:  z.string().trim().min(1).max(40).optional(),
  cmdOff: z.string().trim().min(1).max(40).optional(),
  active: z.boolean().optional(),
});

// GET /api/bots — lista todos os bots
router.get("/", asyncHandler(async (_req, res) => {
  const bots = await prisma.bot.findMany({ orderBy: { createdAt: "desc" } });
  res.json(bots);
}));

// GET /api/bots/:id — detalhe de um bot
router.get("/:id", asyncHandler(async (req, res) => {
  res.json(await exigirBot(req.params.id));
}));

// POST /api/bots — cria novo bot e sobe seu container WAHA
router.post("/", validar(criarSchema), asyncHandler(async (req, res) => {
  const { name, prompt, cmdOn, cmdOff } = req.body;

  const porta = await proximaPorta();
  const bot = await prisma.bot.create({
    data: {
      name,
      prompt:  prompt  || "",
      cmdOn:   cmdOn   || "@lev",
      cmdOff:  cmdOff  || "@levoff",
      wahaPort: porta,
    },
  });

  // Webhook aponta pro nosso backend
  const webhookUrl = `http://host.docker.internal:${process.env.PORT || 4000}/webhook/waha/${bot.id}`;
  const nomeContainer = docker.criar(bot.id, porta, webhookUrl);

  const atualizado = await prisma.bot.update({
    where: { id: bot.id },
    data: { wahaContainer: nomeContainer },
  });

  res.status(201).json(atualizado);
}));

// PATCH /api/bots/:id — edita bot
router.patch("/:id", validar(editarSchema), asyncHandler(async (req, res) => {
  await exigirBot(req.params.id);
  const { name, prompt, cmdOn, cmdOff, active } = req.body;
  const bot = await prisma.bot.update({
    where: { id: req.params.id },
    data: {
      ...(name   !== undefined && { name }),
      ...(prompt !== undefined && { prompt }),
      ...(cmdOn  !== undefined && { cmdOn }),
      ...(cmdOff !== undefined && { cmdOff }),
      ...(active !== undefined && { active }),
    },
  });
  res.json(bot);
}));

// DELETE /api/bots/:id — remove bot e destrói container
router.delete("/:id", asyncHandler(async (req, res) => {
  const bot = await exigirBot(req.params.id);
  docker.remover(bot.id);
  await prisma.bot.delete({ where: { id: bot.id } });
  res.json({ ok: true });
}));

// POST /api/bots/:id/connect — inicia sessão WAHA (QR será gerado)
router.post("/:id/connect", asyncHandler(async (req, res) => {
  const bot = await exigirBot(req.params.id);

  if (docker.status(bot.id) !== "running") {
    docker.iniciar(bot.id);
    await new Promise((r) => setTimeout(r, 3000)); // aguarda o WAHA subir
  }

  await waha.startSession(bot.wahaPort);
  res.json({ ok: true, message: "Sessão iniciada — acesse /api/bots/:id/qr para o QR" });
}));

// GET /api/bots/:id/qr — screenshot do QR Code do WAHA
router.get("/:id/qr", asyncHandler(async (req, res) => {
  const bot = await exigirBot(req.params.id);
  const data = await waha.getQR(bot.wahaPort);
  res.json(data || { error: "QR indisponível — container rodando?" });
}));

// GET /api/bots/:id/status — status da sessão WAHA + container
router.get("/:id/status", asyncHandler(async (req, res) => {
  const bot = await exigirBot(req.params.id);
  const sessionData = await waha.sessionStatus(bot.wahaPort);
  res.json({ container: docker.status(bot.id), session: sessionData });
}));

// GET /api/bots/:id/logs — últimas mensagens trocadas pelo bot
router.get("/:id/logs", asyncHandler(async (req, res) => {
  const limite = Math.min(parseInt(req.query.limit || "50", 10) || 50, 500);
  const logs = await prisma.log.findMany({
    where: { botId: req.params.id },
    orderBy: { createdAt: "desc" },
    take: limite,
  });
  res.json(logs.reverse());
}));

// GET /api/bots/:id/docker-logs — logs do container Docker
router.get("/:id/docker-logs", asyncHandler(async (req, res) => {
  const bot = await exigirBot(req.params.id);
  res.json({ logs: docker.logs(bot.id, 200) });
}));

module.exports = router;
