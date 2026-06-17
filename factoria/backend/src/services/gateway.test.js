// Testes das funções puras do gateway — node --test
const { test } = require("node:test");
const assert = require("node:assert");
const gw = require("./gateway");

test("gerarChave retorna prefixo, chave completa e hash coerentes", () => {
  const { prefix, chaveCompleta, keyHash } = gw.gerarChave();
  assert.match(prefix, /^fct_[0-9a-f]{8}$/);
  assert.ok(chaveCompleta.startsWith(prefix + "_"));
  assert.equal(gw.extrairPrefix(chaveCompleta), prefix);
  assert.equal(gw.hashChave(chaveCompleta), keyHash);
});

test("hashChave é determinístico e sha256 (64 hex)", () => {
  const h1 = gw.hashChave("fct_abc_xyz");
  const h2 = gw.hashChave("fct_abc_xyz");
  assert.equal(h1, h2);
  assert.match(h1, /^[0-9a-f]{64}$/);
});

test("extrairPrefix rejeita formatos inválidos", () => {
  assert.equal(gw.extrairPrefix("chave-qualquer"), null);
  assert.equal(gw.extrairPrefix(""), null);
  assert.equal(gw.extrairPrefix(null), null);
  assert.equal(gw.extrairPrefix("fct_123_abc"), null); // prefixo curto demais
});

test("temEscopo respeita a lista de escopos", () => {
  const k = { scopes: "send,read" };
  assert.equal(gw.temEscopo(k, "send"), true);
  assert.equal(gw.temEscopo(k, "read"), true);
  assert.equal(gw.temEscopo(k, "chat"), false);
});

test("chaves geradas são únicas", () => {
  const a = gw.gerarChave().chaveCompleta;
  const b = gw.gerarChave().chaveCompleta;
  assert.notEqual(a, b);
});
