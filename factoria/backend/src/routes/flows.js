// Rotas /api/flows — fluxos de trabalho (workflow) por bot. Login operator+.
const express = require("express");
const router = express.Router();
const { z } = require("zod");
const prisma = require("../db");
const workflow = require("../services/workflow");
const { asyncHandler, AppError, validar } = require("../utils/http");
const { requireRole } = require("../middleware/auth");

// GET /api/flows/:botId — fluxo do bot (ou null)
router.get("/:botId", asyncHandler(async (req, res) => {
  const flow = await prisma.flow.findUnique({ where: { botId: req.params.botId } });
  res.json(flow || null);
}));

// POST /api/flows/:botId/validar — valida uma definição sem salvar
router.post("/:botId/validar", asyncHandler(async (req, res) => {
  res.json(workflow.validarDefinicao(req.body?.definition ?? req.body));
}));

// PUT /api/flows/:botId — cria/atualiza o fluxo do bot
const putSchema = z.object({
  name:       z.string().trim().max(80).optional(),
  active:     z.boolean().optional(),
  definition: z.any(),
});

router.put("/:botId", requireRole("operator"), validar(putSchema), asyncHandler(async (req, res) => {
  const bot = await prisma.bot.findUnique({ where: { id: req.params.botId } });
  if (!bot) throw new AppError(404, "Bot não encontrado");

  const def = req.body.definition;
  // Se vai ativar, a definição precisa ser válida.
  if (req.body.active) {
    const v = workflow.validarDefinicao(def);
    if (!v.ok) throw new AppError(400, "Fluxo inválido", v.erros);
  }

  const definitionStr = typeof def === "string" ? def : JSON.stringify(def || {});
  const dados = {
    name: req.body.name || "Fluxo principal",
    active: req.body.active ?? false,
    definition: definitionStr,
  };
  const flow = await prisma.flow.upsert({
    where: { botId: req.params.botId },
    update: dados,
    create: { botId: req.params.botId, ...dados },
  });
  res.json(flow);
}));

// DELETE /api/flows/:botId — remove o fluxo
router.delete("/:botId", requireRole("operator"), asyncHandler(async (req, res) => {
  await prisma.flow.deleteMany({ where: { botId: req.params.botId } });
  res.json({ ok: true });
}));

module.exports = router;
