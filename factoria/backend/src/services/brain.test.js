// Testes da normalização de histórico do cérebro — node --test
const { test } = require("node:test");
const assert = require("node:assert");
const { normalizarHistorico } = require("./brain");

test("funde mensagens consecutivas do mesmo papel", () => {
  const h = normalizarHistorico([
    { role: "user", content: "oi" },
    { role: "user", content: "tudo bem?" },
    { role: "assistant", content: "tudo!" },
  ]);
  assert.equal(h.length, 2);
  assert.equal(h[0].content, "oi\ntudo bem?");
  assert.equal(h[1].role, "assistant");
});

test("descarta mensagens de assistant no início", () => {
  const h = normalizarHistorico([
    { role: "assistant", content: "oi, sou o bot" },
    { role: "user", content: "oi" },
  ]);
  assert.equal(h.length, 1);
  assert.equal(h[0].role, "user");
});

test("ignora mensagens vazias", () => {
  const h = normalizarHistorico([
    { role: "user", content: "" },
    { role: "user", content: "olá" },
  ]);
  assert.equal(h.length, 1);
  assert.equal(h[0].content, "olá");
});

test("alterna corretamente um diálogo normal", () => {
  const h = normalizarHistorico([
    { role: "user", content: "a" },
    { role: "assistant", content: "b" },
    { role: "user", content: "c" },
  ]);
  assert.deepEqual(h.map((m) => m.role), ["user", "assistant", "user"]);
});
