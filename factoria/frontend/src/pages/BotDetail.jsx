// Detalhe de um bot — status, QR, skills, logs, edição
import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";

const API = "/api";

const s = {
  back:    { background: "none", border: "none", color: "#58a6ff", cursor: "pointer", fontSize: 14, padding: 0, marginBottom: 20 },
  header:  { display: "flex", alignItems: "center", gap: 14, marginBottom: 28 },
  dot:     (a) => ({ width: 12, height: 12, borderRadius: "50%", background: a ? "#3fb950" : "#6e7681" }),
  h1:      { margin: 0, fontSize: 22, fontWeight: 600 },
  grid:    { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 },
  card:    { background: "#161b22", border: "1px solid #30363d", borderRadius: 10, padding: 20 },
  h2:      { margin: "0 0 14px", fontSize: 15, fontWeight: 600, color: "#8b949e" },
  btn:     (c) => ({ padding: "7px 14px", background: c || "#21262d", color: "#e2e8f0", border: "1px solid #30363d", borderRadius: 6, cursor: "pointer", fontSize: 13 }),
  input:   { display: "block", width: "100%", marginTop: 4, padding: "7px 10px", background: "#0d1117", border: "1px solid #30363d", borderRadius: 6, color: "#e2e8f0", fontSize: 13 },
  label:   { display: "block", marginBottom: 10, fontSize: 13 },
  logBox:  { background: "#0d1117", borderRadius: 6, padding: 12, maxHeight: 300, overflowY: "auto", fontSize: 12, fontFamily: "monospace" },
  logLine: (d) => ({ color: d === "in" ? "#79c0ff" : "#3fb950", marginBottom: 4 }),
  skillRow: { display: "flex", gap: 8, alignItems: "center", marginBottom: 8 },
};

export default function BotDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bot, setBot]         = useState(null);
  const [status, setStatus]   = useState(null);
  const [logs, setLogs]       = useState([]);
  const [skills, setSkills]   = useState([]);
  const [qr, setQr]           = useState(null);
  const [editForm, setEdit]   = useState({});
  const [novaSkill, setNS]    = useState({ name: "", trigger: "", response: "" });

  const carregar = useCallback(async () => {
    const [b, st, lg, sk] = await Promise.all([
      fetch(`${API}/bots/${id}`).then((r) => r.json()),
      fetch(`${API}/bots/${id}/status`).then((r) => r.json()),
      fetch(`${API}/bots/${id}/logs?limit=50`).then((r) => r.json()),
      fetch(`${API}/skills?botId=${id}`).then((r) => r.json()),
    ]);
    setBot(b);
    setStatus(st);
    setLogs(Array.isArray(lg) ? lg : []);
    setSkills(Array.isArray(sk) ? sk : []);
    setEdit({ name: b.name, cmdOn: b.cmdOn, cmdOff: b.cmdOff, prompt: b.prompt });
  }, [id]);

  useEffect(() => { carregar(); }, [carregar]);

  async function conectar() {
    await fetch(`${API}/bots/${id}/connect`, { method: "POST" });
    setTimeout(carregar, 3000);
  }

  async function verQR() {
    const data = await fetch(`${API}/bots/${id}/qr`).then((r) => r.json());
    setQr(data?.mimetype ? `data:${data.mimetype};base64,${data.data}` : null);
  }

  async function salvarEdicao(e) {
    e.preventDefault();
    await fetch(`${API}/bots/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    carregar();
  }

  async function deletarBot() {
    if (!confirm(`Deletar o bot "${bot?.name}"? O container WAHA será removido.`)) return;
    await fetch(`${API}/bots/${id}`, { method: "DELETE" });
    navigate("/");
  }

  async function adicionarSkill(e) {
    e.preventDefault();
    await fetch(`${API}/skills`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ botId: id, ...novaSkill }),
    });
    setNS({ name: "", trigger: "", response: "" });
    carregar();
  }

  async function toggleSkill(skillId, active) {
    await fetch(`${API}/skills/${skillId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    carregar();
  }

  async function deletarSkill(skillId) {
    await fetch(`${API}/skills/${skillId}`, { method: "DELETE" });
    carregar();
  }

  if (!bot) return <p style={{ color: "#8b949e" }}>Carregando...</p>;

  const sessaoStatus = status?.session?.status || "—";
  const containerOk = status?.container === "running";

  return (
    <>
      <button style={s.back} onClick={() => navigate("/")}>← Voltar</button>

      <div style={s.header}>
        <div style={s.dot(bot.active)} />
        <h1 style={s.h1}>{bot.name}</h1>
        <span style={{ color: "#8b949e", fontSize: 13 }}>
          Container: {containerOk ? "🟢 rodando" : "🔴 parado"} &nbsp;|&nbsp;
          Sessão WAHA: {sessaoStatus} &nbsp;|&nbsp; Porta: {bot.wahaPort}
        </span>
      </div>

      <div style={s.grid}>
        {/* Conexão */}
        <div style={s.card}>
          <div style={s.h2}>Conexão WhatsApp</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={s.btn("#238636")} onClick={conectar}>Conectar</button>
            <button style={s.btn()} onClick={verQR}>Ver QR Code</button>
            <button style={s.btn()} onClick={carregar}>Atualizar</button>
          </div>
          {qr && <img src={qr} alt="QR Code" style={{ marginTop: 14, width: "100%", borderRadius: 6 }} />}
        </div>

        {/* Editar bot */}
        <div style={s.card}>
          <div style={s.h2}>Configurações</div>
          <form onSubmit={salvarEdicao}>
            <label style={s.label}>
              Nome
              <input style={s.input} value={editForm.name || ""} onChange={(e) => setEdit({ ...editForm, name: e.target.value })} />
            </label>
            <label style={s.label}>
              cmdOn (ligar)
              <input style={s.input} value={editForm.cmdOn || ""} onChange={(e) => setEdit({ ...editForm, cmdOn: e.target.value })} />
            </label>
            <label style={s.label}>
              cmdOff (desligar)
              <input style={s.input} value={editForm.cmdOff || ""} onChange={(e) => setEdit({ ...editForm, cmdOff: e.target.value })} />
            </label>
            <label style={s.label}>
              Prompt do sistema
              <textarea style={{ ...s.input, minHeight: 70, resize: "vertical" }} value={editForm.prompt || ""} onChange={(e) => setEdit({ ...editForm, prompt: e.target.value })} />
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={s.btn("#1f6feb")} type="submit">Salvar</button>
              <button style={s.btn("#da3633")} type="button" onClick={deletarBot}>Deletar Bot</button>
            </div>
          </form>
        </div>

        {/* Skills */}
        <div style={{ ...s.card, gridColumn: "span 2" }}>
          <div style={s.h2}>Habilidades (Skills)</div>
          {skills.map((sk) => (
            <div key={sk.id} style={s.skillRow}>
              <span style={{ flex: 1, fontSize: 13 }}>
                <strong>{sk.name}</strong> — gatilho: <code>{sk.trigger}</code>
              </span>
              <button style={s.btn()} onClick={() => toggleSkill(sk.id, sk.active)}>
                {sk.active ? "Ativa" : "Inativa"}
              </button>
              <button style={s.btn("#da3633")} onClick={() => deletarSkill(sk.id)}>✕</button>
            </div>
          ))}
          <form onSubmit={adicionarSkill} style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <input style={{ ...s.input, flex: 1, minWidth: 100 }} placeholder="Nome" value={novaSkill.name} onChange={(e) => setNS({ ...novaSkill, name: e.target.value })} />
            <input style={{ ...s.input, flex: 1, minWidth: 100 }} placeholder="Gatilho" required value={novaSkill.trigger} onChange={(e) => setNS({ ...novaSkill, trigger: e.target.value })} />
            <input style={{ ...s.input, flex: 2, minWidth: 150 }} placeholder="Resposta" required value={novaSkill.response} onChange={(e) => setNS({ ...novaSkill, response: e.target.value })} />
            <button style={s.btn("#238636")} type="submit">+ Skill</button>
          </form>
        </div>

        {/* Logs */}
        <div style={{ ...s.card, gridColumn: "span 2" }}>
          <div style={{ ...s.h2, display: "flex", justifyContent: "space-between" }}>
            Histórico de mensagens
            <button style={s.btn()} onClick={carregar}>Atualizar</button>
          </div>
          <div style={s.logBox}>
            {logs.length === 0 && <span style={{ color: "#8b949e" }}>Sem mensagens ainda.</span>}
            {logs.map((lg) => (
              <div key={lg.id} style={s.logLine(lg.direction)}>
                [{new Date(lg.createdAt).toLocaleTimeString("pt-BR")}]
                {lg.direction === "in" ? " ← " : " → "}
                <strong>{lg.phone}</strong>: {lg.body}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
