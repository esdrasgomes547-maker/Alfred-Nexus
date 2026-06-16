// Rotas /api/keys — gestão de chaves de API e webhooks de saída.
// Protegidas por LOGIN (operator+). A chave em texto só aparece UMA vez (criação).
const express = require("express");
const router = express.Router();
const { z } = require("zod");
const prisma = require("../db");
const gateway = require("../services/gateway");
const { asyncHandler, AppError, validar } = require("../utils/http");
const { requireRole } = require("../middleware/auth");

// Esconde o hash; expõe só o prefixo (suficiente pra UI identificar a chave).
function publica(k) {
  const { keyHash, ...resto } = k;
  return resto;
}

// ── Chaves de API ───────────────────────────────────────────────────────────

router.get("/", requireRole("operator"), asyncHandler(async (_req, res) => {
  const chaves = await prisma.apiKey.findMany({ orderBy: { createdAt: "desc" } });
  res.json(chaves.map(publica));
}));

const criarSchema = z.object({
  label:  z.string().trim().min(1, "label obrigatório").max(80),
  botId:  z.string().optional().nullable(),
  scopes: z.array(z.enum(["send", "read", "chat"])).optional(),
});

router.post("/", requireRole("operator"), validar(criarSchema), asyncHandler(async (req, res) => {
  const { label, botId, scopes } = req.body;
  if (botId) {
    const bot = await prisma.bot.findUnique({ where: { id: botId } });
    if (!bot) throw new AppError(404, "Bot do escopo não encontrado");
  }
  const { prefix, chaveCompleta, keyHash } = gateway.gerarChave();
  const registro = await prisma.apiKey.create({
    data: {
      label,
      prefix,
      keyHash,
      botId: botId || null,
      scopes: (scopes && scopes.length ? scopes : ["send", "read", "chat"]).join(","),
    },
  });
  // chaveCompleta só agora — nunca mais será recuperável.
  res.status(201).json({ ...publica(registro), chave: chaveCompleta });
}));

router.patch("/:id", requireRole("operator"), asyncHandler(async (req, res) => {
  const { active, label } = req.body;
  const data = {};
  if (active !== undefined) data.active = !!active;
  if (label  !== undefined) data.label = String(label).slice(0, 80);
  const k = await prisma.apiKey.update({ where: { id: req.params.id }, data });
  res.json(publica(k));
}));

router.delete("/:id", requireRole("operator"), asyncHandler(async (req, res) => {
  await prisma.apiKey.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

// ── Webhooks de saída ───────────────────────────────────────────────────────

router.get("/webhooks", requireRole("operator"), asyncHandler(async (_req, res) => {
  const hooks = await prisma.webhookEndpoint.findMany({ orderBy: { createdAt: "desc" } });
  res.json(hooks);
}));

const webhookSchema = z.object({
  url:    z.string().url("URL inválida"),
  botId:  z.string().optional().nullable(),
  events: z.array(z.string()).optional(),
});

router.post("/webhooks", requireRole("operator"), validar(webhookSchema), asyncHandler(async (req, res) => {
  const { url, botId, events } = req.body;
  const crypto = require("crypto");
  const hook = await prisma.webhookEndpoint.create({
    data: {
      url,
      botId: botId || null,
      secret: crypto.randomBytes(24).toString("hex"),
      events: (events && events.length ? events : ["message.in", "message.out", "handoff"]).join(","),
    },
  });
  res.status(201).json(hook);
}));

router.patch("/webhooks/:id", requireRole("operator"), asyncHandler(async (req, res) => {
  const { active, url, events } = req.body;
  const data = {};
  if (active !== undefined) data.active = !!active;
  if (url    !== undefined) data.url = String(url);
  if (Array.isArray(events)) data.events = events.join(",");
  const hook = await prisma.webhookEndpoint.update({ where: { id: req.params.id }, data });
  res.json(hook);
}));

router.delete("/webhooks/:id", requireRole("operator"), asyncHandler(async (req, res) => {
  await prisma.webhookEndpoint.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

module.exports = router;
