// Middleware de autenticação e autorização (RBAC).
const prisma = require("../db");
const { verificarToken } = require("../services/auth");
const { AppError } = require("../utils/http");

// Hierarquia de papéis — um nível inclui os de baixo.
const NIVEL = { viewer: 1, operator: 2, admin: 3 };

// Extrai o token do header Authorization: Bearer <token>.
function extrairToken(req) {
  const h = req.headers.authorization || "";
  if (h.startsWith("Bearer ")) return h.slice(7).trim();
  return null;
}

// Exige usuário autenticado. Anexa req.user = { id, role, email }.
async function requireAuth(req, _res, next) {
  const token = extrairToken(req);
  if (!token) return next(new AppError(401, "Autenticação necessária"));

  const payload = verificarToken(token);
  if (!payload) return next(new AppError(401, "Token inválido ou expirado"));

  // Confere que o usuário ainda existe e está ativo (revogação imediata).
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.active) return next(new AppError(401, "Usuário inativo"));

  req.user = { id: user.id, role: user.role, email: user.email, name: user.name };
  next();
}

// Exige papel mínimo. Uso: requireRole("admin") ou requireRole("operator").
function requireRole(minimo) {
  const exigido = NIVEL[minimo] || 99;
  return (req, _res, next) => {
    if (!req.user) return next(new AppError(401, "Autenticação necessária"));
    if ((NIVEL[req.user.role] || 0) < exigido) {
      return next(new AppError(403, "Permissão insuficiente"));
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, NIVEL };
