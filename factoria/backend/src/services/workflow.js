// Motor de fluxo de trabalho (workflow) — máquina de estados pura e testável.
//
// Uma definição de fluxo:
//   { start: "node1", nodes: { node1: { type, text, next, options, var } } }
//
// Tipos de nó:
//   message  → envia text e avança pro next automaticamente
//   menu     → envia text + opções numeradas; espera escolha (options[].next)
//   collect  → envia text (pergunta); guarda a próxima resposta em vars[var]
//   ai       → entrega o controle ao cérebro (LLM) a partir daqui
//   handoff  → transfere pra atendente humano
//   end      → encerra o fluxo (volta pro modo bot/IA padrão)

const TIPOS = ["message", "menu", "collect", "ai", "handoff", "end"];

// Substitui {{var}} no texto pelos valores coletados.
function render(texto, vars) {
  if (!texto) return "";
  return texto.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (vars?.[k] ?? ""));
}

function renderMenu(node, vars) {
  const linhas = (node.options || []).map((o, i) => `${i + 1}. ${o.label}`);
  return [render(node.text, vars), ...linhas].filter(Boolean).join("\n");
}

// Casa a mensagem do usuário a uma opção do menu (por número ou por texto).
function casarOpcao(options = [], mensagem = "") {
  const m = mensagem.trim().toLowerCase();
  const n = parseInt(m, 10);
  if (!Number.isNaN(n) && n >= 1 && n <= options.length) return options[n - 1];
  return options.find((o) => o.label && m.includes(o.label.toLowerCase())) || null;
}

// Avança a partir de nodeId acumulando mensagens até parar num nó que espera
// entrada (menu/collect/ai) ou termina (handoff/end).
function avancar(def, nodeId, vars) {
  const replies = [];
  let guard = 0;
  while (nodeId && guard++ < 50) {
    const node = def.nodes?.[nodeId];
    if (!node) return { replies, nodeId: null, end: true };

    switch (node.type) {
      case "message":
        if (node.text) replies.push(render(node.text, vars));
        nodeId = node.next || null;
        if (!nodeId) return { replies, nodeId: null, end: true };
        break;
      case "menu":
        replies.push(renderMenu(node, vars));
        return { replies, nodeId, waiting: true };
      case "collect":
        if (node.text) replies.push(render(node.text, vars));
        return { replies, nodeId, waiting: true };
      case "ai":
        if (node.text) replies.push(render(node.text, vars));
        return { replies, nodeId, defer: true };
      case "handoff":
        return { replies, nodeId: null, handoff: true, reason: node.text || "fluxo" };
      case "end":
        if (node.text) replies.push(render(node.text, vars));
        return { replies, nodeId: null, end: true };
      default:
        return { replies, nodeId: null, end: true };
    }
  }
  return { replies, nodeId: null, end: true };
}

// Inicia o fluxo do começo.
function iniciar(def, vars = {}) {
  if (!def?.start) return { replies: [], nodeId: null, end: true, vars };
  return { ...avancar(def, def.start, vars), vars };
}

// Processa a mensagem do usuário estando parado em `nodeId`.
function responder(def, nodeId, vars = {}, mensagem = "") {
  const node = def?.nodes?.[nodeId];
  if (!node) return iniciar(def, vars); // estado perdido → reinicia

  if (node.type === "collect") {
    const v = { ...vars };
    if (node.var) v[node.var] = mensagem.trim();
    return { ...avancar(def, node.next || null, v), vars: v };
  }

  if (node.type === "menu") {
    const escolha = casarOpcao(node.options, mensagem);
    if (!escolha) {
      return {
        replies: ["Não entendi a opção. Escolha um número da lista:", renderMenu(node, vars)],
        nodeId,
        waiting: true,
        vars,
      };
    }
    return { ...avancar(def, escolha.next || null, vars), vars };
  }

  if (node.type === "ai") {
    return { replies: [], nodeId, defer: true, vars };
  }

  return { ...iniciar(def, vars), vars };
}

// Valida uma definição de fluxo. Retorna { ok, erros: [] }.
function validarDefinicao(def) {
  const erros = [];
  if (!def || typeof def !== "object") return { ok: false, erros: ["definição vazia ou inválida"] };
  if (!def.start) erros.push("falta 'start'");
  if (!def.nodes || typeof def.nodes !== "object") {
    erros.push("falta 'nodes'");
    return { ok: false, erros };
  }
  if (def.start && !def.nodes[def.start]) erros.push(`start '${def.start}' não existe em nodes`);

  for (const [id, node] of Object.entries(def.nodes)) {
    if (!TIPOS.includes(node.type)) erros.push(`nó '${id}': tipo inválido '${node.type}'`);
    if (node.next && !def.nodes[node.next]) erros.push(`nó '${id}': next '${node.next}' não existe`);
    if (node.type === "menu") {
      if (!Array.isArray(node.options) || node.options.length === 0) {
        erros.push(`nó '${id}': menu sem options`);
      } else {
        node.options.forEach((o, i) => {
          if (o.next && !def.nodes[o.next]) erros.push(`nó '${id}' opção ${i + 1}: next '${o.next}' não existe`);
        });
      }
    }
    if (node.type === "collect" && !node.var) erros.push(`nó '${id}': collect sem 'var'`);
  }
  return { ok: erros.length === 0, erros };
}

module.exports = { iniciar, responder, validarDefinicao, casarOpcao, render, TIPOS };
