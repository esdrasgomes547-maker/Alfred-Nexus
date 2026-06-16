// Rotas /api/auth — setup inicial, login, perfil e gestão de usuários (admin).
const express = require("express");
const router = express.Router();
const { z } = require("zod");
const prisma = require("../db");
const { asyncHandler, AppError, validar } = require("../utils/http");
const { hashSenha, verificarSenha, assinarToken } = require("../services/auth");
const { requireAuth, requireRole } = require("../middleware/auth");

const emailSchema = z.string().trim().toLowerCase().email("e-mail inválido");
const senhaSchema = z.string().min(8, "senha precisa de ao menos 8 caracteres").max(200);

const setupSchema = z.object({
  email: emailSchema,
  senha: senhaSchema,
  name:  z.string().trim().max(80).optional(),
});

const loginSchema = z.object({
  email: emailSchema,
  senha: z.string().min(1, "senha obrigatória"),
});

const criarUsuarioSchema = z.object({
  email: emailSchema,
  senha: senhaSchema,
  name:  z.string().trim().max(80).optional(),
  role:  z.enum(["admin", "operator", "viewer"]).optional(),
});

function semHash(u) {
  const { passwordHash, ...resto } = u;
  return resto;
}

// GET /api/auth/setup — informa se a plataforma já tem um admin.
router.get("/setup", asyncHandler(async (_req, res) => {
  const total = await prisma.user.count();
  res.json({ configurado: total > 0 });
}));

// POST /api/auth/setup — cria o PRIMEIRO admin. Só funciona com banco vazio.
router.post("/setup", validar(setupSchema), asyncHandler(async (req, res) => {
  const total = await prisma.user.count();
  if (total > 0) throw new AppError(409, "Plataforma já configurada — use o login");

  const { email, senha, name } = req.body;
  const user = await prisma.user.create({
    data: { email, name: name || "", passwordHash: await hashSenha(senha), role: "admin" },
  });
  res.status(201).json({ token: assinarToken(user), user: semHash(user) });
}));

// POST /api/auth/login — autentica e retorna o token.
router.post("/login", validar(loginSchema), asyncHandler(async (req, res) => {
  const { email, senha } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });

  // Mesma mensagem para "não existe" e "senha errada" (evita enumeração).
  const ok = user && user.active && (await verificarSenha(senha, user.passwordHash));
  if (!ok) throw new AppError(401, "Credenciais inválidas");

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  res.json({ token: assinarToken(user), user: semHash(user) });
}));

// GET /api/auth/me — perfil do usuário autenticado.
router.get("/me", requireAuth, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) throw new AppError(404, "Usuário não encontrado");
  res.json(semHash(user));
}));

// ── Gestão de usuários (apenas admin) ───────────────────────────────────────

router.get("/users", requireAuth, requireRole("admin"), asyncHandler(async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  res.json(users.map(semHash));
}));

router.post("/users", requireAuth, requireRole("admin"), validar(criarUsuarioSchema), asyncHandler(async (req, res) => {
  const { email, senha, name, role } = req.body;
  const existe = await prisma.user.findUnique({ where: { email } });
  if (existe) throw new AppError(409, "E-mail já cadastrado");

  const user = await prisma.user.create({
    data: { email, name: name || "", passwordHash: await hashSenha(senha), role: role || "operator" },
  });
  res.status(201).json(semHash(user));
}));

router.patch("/users/:id", requireAuth, requireRole("admin"), asyncHandler(async (req, res) => {
  const { name, role, active, senha } = req.body;
  const data = {};
  if (name   !== undefined) data.name = String(name).slice(0, 80);
  if (role   !== undefined && ["admin", "operator", "viewer"].includes(role)) data.role = role;
  if (active !== undefined) data.active = !!active;
  if (senha) {
    if (String(senha).length < 8) throw new AppError(400, "Senha muito curta");
    data.passwordHash = await hashSenha(senha);
  }
  const user = await prisma.user.update({ where: { id: req.params.id }, data });
  res.json(semHash(user));
}));

router.delete("/users/:id", requireAuth, requireRole("admin"), asyncHandler(async (req, res) => {
  if (req.params.id === req.user.id) throw new AppError(400, "Não dá pra deletar a si mesmo");
  await prisma.user.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

module.exports = router;
