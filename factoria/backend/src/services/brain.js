// Cérebro dos bots — chama LLM com o prompt configurado no bot.
// Prioridade: Anthropic (se ANTHROPIC_API_KEY) > Groq > Ollama (fallback local).

const axios = require("axios");

function provedorEmUso() {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.GROQ_API_KEY)      return "groq";
  return "ollama";
}

// Diretrizes de base aplicadas a todo bot, somadas ao prompt customizado.
function diretrizesBase() {
  const data = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });
  return (
    `Hoje é ${data}. ` +
    "Você conversa pelo WhatsApp: seja breve, natural e humano — sem textão. " +
    "Use no máximo 2-3 frases por mensagem. " +
    "Nunca invente preços, datas ou disponibilidade que você não tenha. " +
    "Se não souber ou o cliente pedir, ofereça transferir para um atendente. " +
    "Não diga que é uma IA a menos que perguntem diretamente."
  );
}

// Monta o system prompt: persona do bot + diretrizes + dados já coletados.
function promptSistema(bot, contexto = {}) {
  const persona = bot.prompt?.trim()
    ? bot.prompt.trim()
    : `Você é o ${bot.name}, atendente virtual no WhatsApp.`;

  let sistema = `${persona}\n\n${diretrizesBase()}`;

  // Injeta dados coletados pelo fluxo (nome, etc.) pra IA não repetir perguntas.
  const vars = contexto.vars && Object.keys(contexto.vars).length ? contexto.vars : null;
  if (vars) {
    const linhas = Object.entries(vars).map(([k, v]) => `- ${k}: ${v}`).join("\n");
    sistema += `\n\nO que você já sabe sobre este cliente:\n${linhas}`;
  }
  return sistema;
}

async function _groq(sistema, historico) {
  const Groq = require("groq-sdk");
  const cliente = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const resp = await cliente.chat.completions.create({
    model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    max_tokens: 400,
    messages: [{ role: "system", content: sistema }, ...historico],
  });
  return resp.choices[0]?.message?.content?.trim() || "";
}

async function _anthropic(sistema, historico) {
  const Anthropic = require("@anthropic-ai/sdk");
  const cliente = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const resp = await cliente.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
    max_tokens: 400,
    system: sistema,
    messages: historico.length
      ? historico
      : [{ role: "user", content: "(início da conversa)" }],
  });
  return resp.content.map((b) => b.text || "").join("").trim();
}

async function _ollama(sistema, historico) {
  const url = `${process.env.OLLAMA_BASE_URL || "http://localhost:11434"}/api/chat`;
  const resp = await axios.post(
    url,
    {
      model: process.env.OLLAMA_MODEL || "llama3.1",
      stream: false,
      messages: [{ role: "system", content: sistema }, ...historico],
    },
    { timeout: 120_000 }
  );
  return resp.data?.message?.content?.trim() || "";
}

// Memória de curta duração em RAM, com chave composta bot+chat.
// Antes a chave era só o chatId: dois bots conversando com o MESMO número
// compartilhavam (e corrompiam) o mesmo histórico. Agora é isolada por bot.
// Para persistência longa, mover pro banco (model Log já guarda o histórico).
const memoria = new Map(); // "botId::chatId" -> [{role, content}]
const MAX_MENSAGENS = 20;  // ~10 trocas

function chave(bot, chatId) {
  return `${bot?.id || "global"}::${chatId}`;
}

function obterHistorico(bot, chatId) {
  const k = chave(bot, chatId);
  if (!memoria.has(k)) memoria.set(k, []);
  return memoria.get(k);
}

function registrarMensagem(bot, chatId, papel, conteudo) {
  const hist = obterHistorico(bot, chatId);
  hist.push({ role: papel, content: conteudo });
  if (hist.length > MAX_MENSAGENS) hist.splice(0, hist.length - MAX_MENSAGENS);
}

// Limpa a memória de uma conversa (ex.: após handoff ou reset).
function limparMemoria(bot, chatId) {
  memoria.delete(chave(bot, chatId));
}

// Reidrata a memória a partir do banco (model Log) quando a RAM está vazia —
// ex.: após reiniciar o backend, a conversa não "esquece" o contexto recente.
async function hidratarDoBanco(bot, chatId) {
  const k = chave(bot, chatId);
  if (memoria.get(k)?.length) return; // já tem contexto em RAM
  try {
    const prisma = require("../db");
    const logs = await prisma.log.findMany({
      where: { botId: bot.id, phone: chatId },
      orderBy: { createdAt: "desc" },
      take: MAX_MENSAGENS,
    });
    const hist = logs.reverse().map((l) => ({
      role: l.direction === "in" ? "user" : "assistant",
      content: l.body,
    }));
    if (hist.length) memoria.set(k, hist);
  } catch (_) { /* sem banco/logs → começa do zero */ }
}

// contexto: { vars } — dados coletados pelo fluxo, injetados no system prompt.
async function responder(bot, mensagem, chatId, contexto = {}) {
  if (bot?.id) await hidratarDoBanco(bot, chatId);
  const sistema = promptSistema(bot, contexto);
  registrarMensagem(bot, chatId, "user", mensagem);
  const historico = obterHistorico(bot, chatId);

  const provedor = provedorEmUso();
  try {
    let resposta;
    if (provedor === "anthropic") resposta = await _anthropic(sistema, historico);
    else if (provedor === "groq")  resposta = await _groq(sistema, historico);
    else                           resposta = await _ollama(sistema, historico);

    if (resposta) registrarMensagem(bot, chatId, "assistant", resposta);
    return resposta;
  } catch (err) {
    console.error(`[brain] Falha no provedor ${provedor}:`, err.message);
    return null; // silêncio em caso de falha — não responder lixo
  }
}

module.exports = { responder, provedorEmUso, limparMemoria };
