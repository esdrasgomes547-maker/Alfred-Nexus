// Serviço de autenticação — hash de senha (bcrypt) e tokens JWT.
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

// Segredo do JWT. Preferimos JWT_SECRET; senão derivamos do CRYPTO_SECRET
// (já existente) pra não exigir mais uma variável obrigatória. Em produção,
// defina JWT_SECRET explicitamente.
function segredo() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const base = process.env.CRYPTO_SECRET || "factoria-dev-secret-troque-isto";
  return crypto.createHash("sha256").update(`jwt::${base}`).digest("hex");
}

const EXPIRACAO = process.env.JWT_EXPIRES || "7d";

async function hashSenha(senha) {
  return bcrypt.hash(senha, 10);
}

async function verificarSenha(senha, hash) {
  if (!hash) return false;
  return bcrypt.compare(senha, hash);
}

// Gera token com o mínimo necessário no payload (id, role, email).
function assinarToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    segredo(),
    { expiresIn: EXPIRACAO }
  );
}

// Retorna o payload se válido, ou null.
function verificarToken(token) {
  try {
    return jwt.verify(token, segredo());
  } catch (_) {
    return null;
  }
}

module.exports = { hashSenha, verificarSenha, assinarToken, verificarToken };
