// Serviço de atendimento virtual — conversas, handoff humano e estado de fluxo.
const prisma = require("../db");

// Palavras/expressões que pedem um atendente humano. Detecção por inclusão
// (aqui faz sentido: é intenção do cliente, não um comando de controle).
const GATILHOS_HANDOFF = [
  "falar com atendente", "atendente", "falar com humano", "um humano",
  "pessoa de verdade", "quero falar com alguem", "quero falar com alguém",
  "atendimento humano", "reclamacao", "reclamação", "quero reclamar",
];

// Retorna o motivo do handoff se a mensagem pedir humano, ou null.
function detectarHandoff(normalized) {
  const t = (normalized || "").toLowerCase();
  const achou = GATILHOS_HANDOFF.find((g) => t.includes(g));
  return achou ? `cliente pediu: "${achou}"` : null;
}

// Garante uma conversa pra (bot, telefone). Atualiza nome e lastMessageAt.
async function upsertConversa(botId, phone, contactName = "") {
  const dados = { lastMessageAt: new Date() };
  if (contactName) dados.contactName = contactName;
  return prisma.conversation.upsert({
    where: { botId_phone: { botId, phone } },
    update: dados,
    create: { botId, phone, contactName: contactName || "" },
  });
}

// Transfere a conversa pra um humano.
async function handoff(conversa, motivo) {
  return prisma.conversation.update({
    where: { id: conversa.id },
    data: { status: "human", handoffReason: motivo },
  });
}

// Persiste o estado do fluxo (nó atual + variáveis coletadas).
async function salvarEstadoFluxo(conversaId, flowNodeId, flowVars) {
  return prisma.conversation.update({
    where: { id: conversaId },
    data: { flowNodeId: flowNodeId || null, flowVars: JSON.stringify(flowVars || {}) },
  });
}

module.exports = { detectarHandoff, upsertConversa, handoff, salvarEstadoFluxo, GATILHOS_HANDOFF };
