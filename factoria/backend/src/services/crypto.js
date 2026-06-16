// Criptografia simples para dados sensíveis (ex.: chaves de API de clientes).
// Usa AES-256-GCM com a chave de CRYPTO_SECRET do .env.

const crypto = require("crypto");

const ALGORITMO = "aes-256-gcm";

function obterChave() {
  const secret = process.env.CRYPTO_SECRET || "";
  if (secret.length < 32) {
    console.warn("[crypto] CRYPTO_SECRET tem menos de 32 chars — use uma chave segura!");
  }
  return crypto.scryptSync(secret, "factoria-salt", 32);
}

function criptografar(texto) {
  const chave = obterChave();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITMO, chave, iv);
  const enc = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Formato: iv(hex):tag(hex):dados(hex)
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

function descriptografar(cifrado) {
  try {
    const [ivHex, tagHex, dadosHex] = cifrado.split(":");
    const chave = obterChave();
    const iv  = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const dados = Buffer.from(dadosHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITMO, chave, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(dados), decipher.final()]).toString("utf8");
  } catch (_) {
    return null; // dado corrompido ou chave errada
  }
}

module.exports = { criptografar, descriptografar };
