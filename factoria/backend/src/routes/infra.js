// Rotas /api/infra — Docker, IA interna (chat de configuração), settings
const express = require("express");
const router = express.Router();
const { execSync } = require("child_process");
const brain = require("../services/brain");
const { asyncHandler } = require("../utils/http");

// GET /api/infra/docker — lista containers WAHA ativos
router.get("/docker", (_req, res) => {
  try {
    const saida = execSync(
      'docker ps --filter "name=waha-bot-" --format "{{.Names}}\\t{{.Status}}\\t{{.Ports}}"',
      { stdio: "pipe" }
    ).toString().trim();

    const containers = saida
      ? saida.split("\n").map((linha) => {
          const [name, status, ports] = linha.split("\t");
          return { name, status, ports };
        })
      : [];

    res.json({ containers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/infra/status — resumo geral da infra
router.get("/status", (_req, res) => {
  let dockerOk = false;
  try {
    execSync("docker info", { stdio: "ignore" });
    dockerOk = true;
  } catch (_) {}

  res.json({
    docker: dockerOk,
    cerebro: brain.provedorEmUso(),
    uptime: process.uptime(),
    memoria: process.memoryUsage(),
  });
});

// POST /api/infra/chat — IA interna (chat de configuração/ajuda)
// A IA responde perguntas sobre como operar o FactorIA.
// Pendência #5 do handoff: em breve executará ações via tool-calling.
router.post("/chat", asyncHandler(async (req, res) => {
  const { mensagem } = req.body;
  if (!mensagem) return res.status(400).json({ error: "mensagem obrigatória" });

  // Bot fictício para o chat interno (usa o prompt da plataforma, não de um cliente)
  const botInterno = {
    name: "FactorIA",
    prompt:
      "Você é o assistente interno do FactorIA, plataforma de criação de bots de WhatsApp. " +
      "Ajude o operador (Lev The Dev / Esdras) a configurar bots, entender logs, " +
      "resolver problemas e tomar decisões de produto. " +
      "Seja direto e técnico. Responda em português.",
  };

  const resposta = await brain.responder(botInterno, mensagem, "__interno__");
  res.json({ resposta: resposta || "Não consegui processar — verifique a chave do LLM no .env" });
}));

module.exports = router;
