// Rotas /api/skills — habilidades (gatilho → resposta fixa) dos bots
const express = require("express");
const router = express.Router();
const { z } = require("zod");
const prisma = require("../db");
const { asyncHandler, validar } = require("../utils/http");

const criarSchema = z.object({
  botId:    z.string().min(1, "botId obrigatório"),
  name:     z.string().trim().max(80).optional(),
  trigger:  z.string().trim().min(1, "trigger obrigatório").max(200),
  response: z.string().trim().min(1, "response obrigatório").max(4000),
});

const editarSchema = z.object({
  name:     z.string().trim().max(80).optional(),
  trigger:  z.string().trim().min(1).max(200).optional(),
  response: z.string().trim().min(1).max(4000).optional(),
  active:   z.boolean().optional(),
});

// GET /api/skills?botId=xxx — lista skills de um bot
router.get("/", asyncHandler(async (req, res) => {
  const { botId } = req.query;
  if (!botId) return res.status(400).json({ error: "botId obrigatório" });
  const skills = await prisma.skill.findMany({
    where: { botId },
    orderBy: { createdAt: "asc" },
  });
  res.json(skills);
}));

// POST /api/skills — cria skill
router.post("/", validar(criarSchema), asyncHandler(async (req, res) => {
  const { botId, name, trigger, response } = req.body;
  const skill = await prisma.skill.create({
    data: { botId, name: name || trigger, trigger, response },
  });
  res.status(201).json(skill);
}));

// PATCH /api/skills/:id — edita skill
router.patch("/:id", validar(editarSchema), asyncHandler(async (req, res) => {
  const { name, trigger, response, active } = req.body;
  const skill = await prisma.skill.update({
    where: { id: req.params.id },
    data: {
      ...(name     !== undefined && { name }),
      ...(trigger  !== undefined && { trigger }),
      ...(response !== undefined && { response }),
      ...(active   !== undefined && { active }),
    },
  });
  res.json(skill);
}));

// DELETE /api/skills/:id — remove skill
router.delete("/:id", asyncHandler(async (req, res) => {
  await prisma.skill.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

module.exports = router;
