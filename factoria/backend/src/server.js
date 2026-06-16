// Backend do FactorIA — Express na porta 4000
require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });

const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");

const botsRouter   = require("./routes/bots");
const skillsRouter = require("./routes/skills");
const infraRouter  = require("./routes/infra");
const webhookRouter = require("./routes/webhook");

const app = express();
const PORT = process.env.PORT || 4000;

// Permite chamadas do Electron/Vite em dev
app.use(cors());
app.use(express.json());

// Rotas
app.use("/api/bots",    botsRouter);
app.use("/api/skills",  skillsRouter);
app.use("/api/infra",   infraRouter);
app.use("/webhook/waha", webhookRouter);

// Healthcheck (útil pro Electron confirmar que o backend está no ar)
app.get("/health", (_req, res) => res.json({ status: "ok", ts: Date.now() }));

// Inicializa banco + inicia servidor
const prisma = new PrismaClient();
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
process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
