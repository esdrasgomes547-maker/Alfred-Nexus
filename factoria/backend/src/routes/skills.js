// Rotas /api/skills — habilidades (gatilho → resposta fixa) dos bots
const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// GET /api/skills?botId=xxx — lista skills de um bot
router.get("/", async (req, res) => {
  const { botId } = req.query;
  if (!botId) return res.status(400).json({ error: "botId obrigatório" });
  const skills = await prisma.skill.findMany({
    where: { botId },
    orderBy: { createdAt: "asc" },
  });
  res.json(skills);
});

// POST /api/skills — cria skill
router.post("/", async (req, res) => {
  const { botId, name, trigger, response } = req.body;
  if (!botId || !trigger || !response) {
    return res.status(400).json({ error: "botId, trigger e response são obrigatórios" });
  }
  const skill = await prisma.skill.create({
    data: { botId, name: name || trigger, trigger, response },
  });
  res.status(201).json(skill);
});

// PATCH /api/skills/:id — edita skill
router.patch("/:id", async (req, res) => {
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
});

// DELETE /api/skills/:id — remove skill
router.delete("/:id", async (req, res) => {
  await prisma.skill.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

module.exports = router;
