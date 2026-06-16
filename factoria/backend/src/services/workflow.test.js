// Testes do motor de fluxo — node --test
const { test } = require("node:test");
const assert = require("node:assert");
const wf = require("./workflow");

// Fluxo de exemplo: saúda → menu → coleta nome → IA / handoff
const def = {
  start: "saudacao",
  nodes: {
    saudacao: { type: "message", text: "Oi! Bem-vindo.", next: "menu" },
    menu: {
      type: "menu",
      text: "O que você quer?",
      options: [
        { label: "Reservar", next: "pedeNome" },
        { label: "Falar com humano", next: "humano" },
        { label: "Tirar dúvida", next: "duvida" },
      ],
    },
    pedeNome: { type: "collect", text: "Qual seu nome?", var: "nome", next: "confirma" },
    confirma: { type: "message", text: "Prazer, {{nome}}! Vou te ajudar.", next: "duvida" },
    duvida: { type: "ai", text: "Pode perguntar!" },
    humano: { type: "handoff", text: "pediu atendente" },
  },
};

test("iniciar avança message → para no menu", () => {
  const r = wf.iniciar(def, {});
  assert.equal(r.nodeId, "menu");
  assert.ok(r.waiting);
  assert.equal(r.replies[0], "Oi! Bem-vindo.");
  assert.match(r.replies[1], /1\. Reservar/);
  assert.match(r.replies[1], /2\. Falar com humano/);
});

test("menu por número avança e coleta", () => {
  const r = wf.responder(def, "menu", {}, "1");
  assert.equal(r.nodeId, "pedeNome");
  assert.ok(r.waiting);
  assert.equal(r.replies[0], "Qual seu nome?");
});

test("menu por texto também casa", () => {
  const r = wf.responder(def, "menu", {}, "quero reservar");
  assert.equal(r.nodeId, "pedeNome");
});

test("opção inválida re-emite o menu e fica parado", () => {
  const r = wf.responder(def, "menu", {}, "banana");
  assert.equal(r.nodeId, "menu");
  assert.ok(r.waiting);
  assert.match(r.replies[0], /Não entendi/);
});

test("collect guarda a variável e renderiza no próximo passo", () => {
  const r = wf.responder(def, "pedeNome", {}, "Esdras");
  assert.equal(r.vars.nome, "Esdras");
  // confirma (message) renderiza {{nome}} e cai no nó ai
  assert.equal(r.replies[0], "Prazer, Esdras! Vou te ajudar.");
  assert.equal(r.nodeId, "duvida");
  assert.ok(r.defer);
});

test("nó ai mantém defer ao responder", () => {
  const r = wf.responder(def, "duvida", { nome: "X" }, "qual o preço?");
  assert.ok(r.defer);
  assert.equal(r.nodeId, "duvida");
});

test("handoff é sinalizado", () => {
  const r = wf.responder(def, "menu", {}, "2");
  assert.ok(r.handoff);
  assert.equal(r.reason, "pediu atendente");
});

test("estado perdido reinicia o fluxo", () => {
  const r = wf.responder(def, "no-que-nao-existe", {}, "oi");
  assert.equal(r.nodeId, "menu");
});

test("validarDefinicao detecta erros", () => {
  const ruim = { start: "x", nodes: { y: { type: "banana" } } };
  const v = wf.validarDefinicao(ruim);
  assert.equal(v.ok, false);
  assert.ok(v.erros.some((e) => /start/.test(e)));
  assert.ok(v.erros.some((e) => /tipo inválido/.test(e)));
});

test("validarDefinicao aceita fluxo válido", () => {
  assert.equal(wf.validarDefinicao(def).ok, true);
});
