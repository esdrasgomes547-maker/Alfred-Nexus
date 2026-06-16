// Gerencia containers Docker do WAHA (1 por bot).
// Cada bot ganha uma porta isolada: 4100, 4101, 4102, ...
// O container é nomeado "waha-bot-<botId>".

const { execSync, spawn } = require("child_process");

const WAHA_IMAGE   = "devlikeapro/waha:latest";
const PORTA_BASE   = 4100;

function nomeContainer(botId) {
  return `waha-bot-${botId}`;
}

// Retorna a porta alocada pra este bot (PORTA_BASE + índice baseado no botId)
// Na prática o portRepository calcula isso via banco — aqui aceitamos como arg.
function criar(botId, porta, webhookUrl) {
  const nome = nomeContainer(botId);

  // Remove container anterior se existir (idempotente)
  try {
    execSync(`docker rm -f ${nome}`, { stdio: "ignore" });
  } catch (_) {}

  const args = [
    "run", "-d",
    "--name", nome,
    "--restart", "unless-stopped",
    "-p", `${porta}:3000`,
    "-e", `WHATSAPP_HOOK_URL=${webhookUrl}`,
    "-e", "WHATSAPP_HOOK_EVENTS=message",
    WAHA_IMAGE,
  ];

  const proc = spawn("docker", args, { detached: true, stdio: "ignore" });
  proc.unref();

  console.log(`[docker] Container ${nome} criado na porta ${porta}`);
  return nome;
}

function parar(botId) {
  const nome = nomeContainer(botId);
  try {
    execSync(`docker stop ${nome}`, { stdio: "pipe" });
    console.log(`[docker] Container ${nome} parado.`);
    return true;
  } catch (err) {
    console.error(`[docker] Erro ao parar ${nome}:`, err.message);
    return false;
  }
}

function remover(botId) {
  const nome = nomeContainer(botId);
  try {
    execSync(`docker rm -f ${nome}`, { stdio: "pipe" });
    console.log(`[docker] Container ${nome} removido.`);
    return true;
  } catch (err) {
    console.error(`[docker] Erro ao remover ${nome}:`, err.message);
    return false;
  }
}

function iniciar(botId) {
  const nome = nomeContainer(botId);
  try {
    execSync(`docker start ${nome}`, { stdio: "pipe" });
    console.log(`[docker] Container ${nome} iniciado.`);
    return true;
  } catch (err) {
    console.error(`[docker] Erro ao iniciar ${nome}:`, err.message);
    return false;
  }
}

function status(botId) {
  const nome = nomeContainer(botId);
  try {
    const saida = execSync(
      `docker inspect --format "{{.State.Status}}" ${nome}`,
      { stdio: "pipe" }
    ).toString().trim();
    return saida; // "running" | "exited" | "created" | ...
  } catch (_) {
    return "ausente";
  }
}

function logs(botId, linhas = 100) {
  const nome = nomeContainer(botId);
  try {
    return execSync(`docker logs --tail ${linhas} ${nome}`, { stdio: "pipe" })
      .toString();
  } catch (_) {
    return "";
  }
}

module.exports = { criar, parar, remover, iniciar, status, logs, nomeContainer };
