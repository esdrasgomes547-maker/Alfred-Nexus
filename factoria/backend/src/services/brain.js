// Cérebro dos bots — chama LLM com o prompt configurado no bot.
// Prioridade: Anthropic (se ANTHROPIC_API_KEY) > Groq > Ollama (fallback local).

const axios = require("axios");

function provedorEmUso() {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.GROQ_API_KEY)      return "groq";
  return "ollama";
}

function promptSistema(bot) {
  if (bot.prompt?.trim()) return bot.prompt.trim();
  return (
    `Você é um assistente de WhatsApp chamado ${bot.name}. ` +
    "Responda de forma curta, natural e direta. " +
    "Nunca mencione que é uma IA a menos que perguntado diretamente."
  );
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

async function responder(bot, mensagem, chatId) {
  const sistema = promptSistema(bot);
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
