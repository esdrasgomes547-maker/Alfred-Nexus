// Exemplo de integração server-to-server com o gateway /v1 do FactorIA.
// Mostra os 3 verbos: listar bots, conversar com a IA e enviar WhatsApp.
//
//   node integracao.js
//
// Requer Node 18+ (fetch nativo). Troque BASE e API_KEY.

const BASE    = process.env.FACTORIA_URL || "http://127.0.0.1:4000";
const API_KEY = process.env.FACTORIA_KEY || "fct_xxxxxxxx_yyyy";

async function api(metodo, caminho, corpo) {
  const r = await fetch(BASE + caminho, {
    method: metodo,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`${r.status} ${data.error || ""}`);
  return data;
}

async function main() {
  // 1) Bots que a chave enxerga
  const { bots } = await api("GET", "/v1/bots");
  console.log("Bots acessíveis:", bots.map((b) => b.name));
  if (!bots.length) return console.log("Nenhum bot — crie um no painel.");
  const botId = bots[0].id;

  // 2) Conversa com a IA do bot (sem WhatsApp) — ideal pra widget/site
  const chat = await api("POST", "/v1/chat", {
    botId,
    sessionId: "exemplo-cli",
    message: "Quais os horários de funcionamento?",
  });
  console.log("IA respondeu:", chat.reply);

  // 3) Envia uma mensagem real de WhatsApp (precisa de escopo "send")
  // const envio = await api("POST", "/v1/messages", {
  //   botId, to: "5591999990000", text: "Olá! Sua reserva está confirmada. ✅",
  // });
  // console.log("Enviado:", envio);
}

main().catch((e) => { console.error("Falhou:", e.message); process.exit(1); });
