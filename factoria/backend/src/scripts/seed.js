// Cria um admin inicial de forma não-interativa (útil pra deploy/headless).
// Uso: ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run seed
require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });

const prisma = require("../db");
const { hashSenha } = require("../services/auth");

async function main() {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const senha = process.env.ADMIN_PASSWORD || "";

  if (!email || senha.length < 8) {
    console.error("Defina ADMIN_EMAIL e ADMIN_PASSWORD (mín. 8 chars).");
    process.exit(1);
  }

  const existe = await prisma.user.findUnique({ where: { email } });
  if (existe) {
    console.log(`[seed] Usuário ${email} já existe — nada a fazer.`);
    return;
  }

  await prisma.user.create({
    data: { email, name: process.env.ADMIN_NAME || "Admin", passwordHash: await hashSenha(senha), role: "admin" },
  });
  console.log(`[seed] Admin ${email} criado.`);
}

main()
  .catch((e) => { console.error("[seed] Erro:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
