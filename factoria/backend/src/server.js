// Backend do FactorIA — Express na porta 4000
require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const prisma = require("./db");
const { tratadorDeErro } = require("./utils/http");

const { requireAuth } = require("./middleware/auth");

const authRouter    = require("./routes/auth");
const botsRouter    = require("./routes/bots");
const skillsRouter  = require("./routes/skills");
const infraRouter   = require("./routes/infra");
const webhookRouter = require("./routes/webhook");

const app = express();
const PORT = process.env.PORT || 4000;

// ── Segurança base ──────────────────────────────────────────────────────────
// helmet: cabeçalhos de segurança. CSP desligado pois a UI roda via Electron/Vite.
app.use(helmet({ contentSecurityPolicy: false }));
// CORS liberado: o backend só escuta em 127.0.0.1 (loopback), acessível pelo
// Electron/Vite local. Não fica exposto na rede.
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Rate limit geral da API (não afeta o webhook, que tem seu próprio ritmo).
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,                // 300 req/min por IP — folgado pro uso local
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições — tente novamente em instantes." },
});

// Rate limit mais apertado pro login/setup (anti força-bruta).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas — aguarde alguns minutos." },
});

// ── Rotas ───────────────────────────────────────────────────────────────────
// Healthcheck (Electron usa pra confirmar que o backend subiu).
app.get("/health", (_req, res) => res.json({ status: "ok", ts: Date.now() }));

// Webhook do WAHA — sem rate limit nem auth (tráfego de máquina, vem do container).
app.use("/webhook/waha", webhookRouter);

// Autenticação (setup/login são públicos; o resto exige token — tratado no router).
app.use("/api/auth", authLimiter, authRouter);

// API interna da plataforma — tudo protegido por login.
app.use("/api", apiLimiter);
app.use("/api/bots",   requireAuth, botsRouter);
app.use("/api/skills", requireAuth, skillsRouter);
app.use("/api/infra",  requireAuth, infraRouter);

// 404 para rotas desconhecidas sob /api.
app.use("/api", (_req, res) => res.status(404).json({ error: "Rota não encontrada" }));

// Tratador de erro — sempre por último.
app.use(tratadorDeErro);

// ── Boot ────────────────────────────────────────────────────────────────────
prisma.$connect()
  .then(() => {
    app.listen(PORT, "127.0.0.1", () => {
      console.log(`[FactorIA] Backend rodando em http://127.0.0.1:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("[FactorIA] Falha ao conectar no banco:", err.message);
    process.exit(1);
  });

// Graceful shutdown
async function encerrar() {
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGTERM", encerrar);
process.on("SIGINT", encerrar);

module.exports = app;
