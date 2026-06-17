// Testes da detecção de handoff — node --test
const { test } = require("node:test");
const assert = require("node:assert");
const at = require("./atendimento");

test("detecta pedido explícito de atendente", () => {
  assert.ok(at.detectarHandoff("quero falar com atendente"));
  assert.ok(at.detectarHandoff("me passa pra um humano por favor"));
  assert.ok(at.detectarHandoff("isso é uma reclamação séria"));
});

test("não dispara handoff em conversa normal", () => {
  assert.equal(at.detectarHandoff("quanto custa a hora de PS5?"), null);
  assert.equal(at.detectarHandoff("quero reservar pra sábado"), null);
  assert.equal(at.detectarHandoff(""), null);
});

test("retorna o motivo citando o gatilho", () => {
  const m = at.detectarHandoff("atendente agora");
  assert.match(m, /atendente/);
});
