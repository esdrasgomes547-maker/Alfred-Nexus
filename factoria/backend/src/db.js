// Cliente Prisma — singleton.
// Antes cada arquivo de rota criava seu próprio `new PrismaClient()`, abrindo
// um pool de conexões por módulo. Aqui há UMA instância para todo o processo.
const { PrismaClient } = require("@prisma/client");

if (!global.__prisma) {
  global.__prisma = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

const prisma = global.__prisma;

module.exports = prisma;
