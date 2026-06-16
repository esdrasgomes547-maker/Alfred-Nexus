// Rotas /api/bots — CRUD, conectar, status, logs do bot
const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const docker = require("../services/docker");
const waha   = require("../services/waha");

const prisma = new PrismaClient();
const PORTA_BASE = 4100;

// Aloca a próxima porta disponível (PORTA_BASE + quantidade de bots existentes)
async function proximaPorta() {
  const total = await prisma.bot.count();
  return PORTA_BASE + total;
}

// GET /api/bots — lista todos os bots
router.get("/", async (_req, res) => {
  const bots = await prisma.bot.findMany({ orderBy: { createdAt: "desc" } });
  res.json(bots);
});

// GET /api/bots/:id — detalhe de um bot
router.get("/:id", async (req, res) => {
  const bot = await prisma.bot.findUnique({ where: { id: req.params.id } });
  if (!bot) return res.status(404).json({ error: "Bot não encontrado" });
  res.json(bot);
});

// POST /api/bots — cria novo bot e sobe seu container WAHA
router.post("/", async (req, res) => {
  const { name, prompt, cmdOn, cmdOff } = req.body;
  if (!name) return res.status(400).json({ error: "name obrigatório" });

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

  await prisma.bot.update({
    where: { id: bot.id },
    data: { wahaContainer: nomeContainer },
  });

  res.status(201).json({ ...bot, wahaContainer: nomeContainer });
});

// PATCH /api/bots/:id — edita bot (name, prompt, cmdOn, cmdOff)
router.patch("/:id", async (req, res) => {
  const { name, prompt, cmdOn, cmdOff } = req.body;
  const bot = await prisma.bot.update({
    where: { id: req.params.id },
    data: {
      ...(name   !== undefined && { name }),
      ...(prompt !== undefined && { prompt }),
      ...(cmdOn  !== undefined && { cmdOn }),
      ...(cmdOff !== undefined && { cmdOff }),
    },
  });
  res.json(bot);
});

// DELETE /api/bots/:id — remove bot e destrói container
router.delete("/:id", async (req, res) => {
  const bot = await prisma.bot.findUnique({ where: { id: req.params.id } });
  if (!bot) return res.status(404).json({ error: "Bot não encontrado" });

  docker.remover(bot.id);
  await prisma.bot.delete({ where: { id: bot.id } });
  res.json({ ok: true });
});

// POST /api/bots/:id/connect — inicia sessão WAHA (QR será gerado)
router.post("/:id/connect", async (req, res) => {
  const bot = await prisma.bot.findUnique({ where: { id: req.params.id } });
  if (!bot) return res.status(404).json({ error: "Bot não encontrado" });

  const containerStatus = docker.status(bot.id);
  if (containerStatus !== "running") {
    docker.iniciar(bot.id);
    // Aguarda o WAHA subir
    await new Promise((r) => setTimeout(r, 3000));
  }

  await waha.startSession(bot.wahaPort);
  res.json({ ok: true, message: "Sessão iniciada — acesse /api/bots/:id/qr para o QR" });
});

// GET /api/bots/:id/qr — screenshot do QR Code do WAHA
router.get("/:id/qr", async (req, res) => {
  const bot = await prisma.bot.findUnique({ where: { id: req.params.id } });
  if (!bot) return res.status(404).json({ error: "Bot não encontrado" });

  const data = await waha.getQR(bot.wahaPort);
  res.json(data || { error: "QR indisponível — container rodando?" });
});

// GET /api/bots/:id/status — status da sessão WAHA
router.get("/:id/status", async (req, res) => {
  const bot = await prisma.bot.findUnique({ where: { id: req.params.id } });
  if (!bot) return res.status(404).json({ error: "Bot não encontrado" });

  const sessionData = await waha.sessionStatus(bot.wahaPort);
  const containerStatus = docker.status(bot.id);
  res.json({ container: containerStatus, session: sessionData });
});

// GET /api/bots/:id/logs — últimas mensagens trocadas pelo bot
router.get("/:id/logs", async (req, res) => {
  const limite = parseInt(req.query.limit || "50", 10);
  const logs = await prisma.log.findMany({
    where: { botId: req.params.id },
    orderBy: { createdAt: "desc" },
    take: limite,
  });
  res.json(logs.reverse());
});

// GET /api/bots/:id/docker-logs — logs do container Docker
router.get("/:id/docker-logs", async (req, res) => {
  const bot = await prisma.bot.findUnique({ where: { id: req.params.id } });
  if (!bot) return res.status(404).json({ error: "Bot não encontrado" });
  const saida = docker.logs(bot.id, 200);
  res.json({ logs: saida });
});

module.exports = router;
