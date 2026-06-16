// Página principal — lista bots e permite criar novos
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API = "/api";

const s = {
  header:  { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 },
  h1:      { margin: 0, fontSize: 22, fontWeight: 600 },
  btnNew:  { padding: "8px 16px", background: "#238636", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14 },
  grid:    { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 },
  card:    { background: "#161b22", border: "1px solid #30363d", borderRadius: 10, padding: 20, cursor: "pointer", transition: "border-color .15s" },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  name:    { fontWeight: 600, fontSize: 16 },
  dot:     (active) => ({ width: 10, height: 10, borderRadius: "50%", background: active ? "#3fb950" : "#6e7681", marginTop: 4 }),
  meta:    { color: "#8b949e", fontSize: 12 },
  form:    { background: "#161b22", border: "1px solid #30363d", borderRadius: 10, padding: 24, marginBottom: 28, maxWidth: 480 },
  label:   { display: "block", marginBottom: 14 },
  input:   { display: "block", width: "100%", marginTop: 4, padding: "8px 10px", background: "#0d1117", border: "1px solid #30363d", borderRadius: 6, color: "#e2e8f0", fontSize: 14 },
  btnSave: { padding: "8px 20px", background: "#1f6feb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14 },
};

export default function Factory() {
  const [bots, setBots]         = useState([]);
  const [mostrarForm, setForm]  = useState(false);
  const [form, setFormData]     = useState({ name: "", cmdOn: "@lev", cmdOff: "@levoff", prompt: "" });
  const [carregando, setLoad]   = useState(false);
  const navigate = useNavigate();

  async function carregar() {
    const resp = await fetch(`${API}/bots`);
    setBots(await resp.json());
  }

  useEffect(() => { carregar(); }, []);

  async function criarBot(e) {
    e.preventDefault();
    setLoad(true);
    await fetch(`${API}/bots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setFormData({ name: "", cmdOn: "@lev", cmdOff: "@levoff", prompt: "" });
    setForm(false);
    setLoad(false);
    carregar();
  }

  return (
    <>
      <div style={s.header}>
        <h1 style={s.h1}>Fábrica de Bots</h1>
        <button style={s.btnNew} onClick={() => setForm((v) => !v)}>
          {mostrarForm ? "Cancelar" : "+ Novo Bot"}
        </button>
      </div>

      {mostrarForm && (
        <form style={s.form} onSubmit={criarBot}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16 }}>Novo Bot</h3>
          <label style={s.label}>
            Nome do bot
            <input style={s.input} required value={form.name} onChange={(e) => setFormData({ ...form, name: e.target.value })} placeholder="Ex.: Lev The Bot" />
          </label>
          <label style={s.label}>
            Comando ligar (cmdOn)
            <input style={s.input} value={form.cmdOn} onChange={(e) => setFormData({ ...form, cmdOn: e.target.value })} placeholder="@lev" />
          </label>
          <label style={s.label}>
            Comando desligar (cmdOff)
            <input style={s.input} value={form.cmdOff} onChange={(e) => setFormData({ ...form, cmdOff: e.target.value })} placeholder="@levoff" />
          </label>
          <label style={s.label}>
            Prompt do sistema (opcional)
            <textarea style={{ ...s.input, minHeight: 80, resize: "vertical" }} value={form.prompt} onChange={(e) => setFormData({ ...form, prompt: e.target.value })} placeholder="Você é um assistente de WhatsApp..." />
          </label>
          <button style={s.btnSave} type="submit" disabled={carregando}>
            {carregando ? "Criando..." : "Criar Bot"}
          </button>
        </form>
      )}

      <div style={s.grid}>
        {bots.map((bot) => (
          <div key={bot.id} style={s.card} onClick={() => navigate(`/bot/${bot.id}`)}
               onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#58a6ff")}
               onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#30363d")}>
            <div style={s.cardTop}>
              <span style={s.name}>{bot.name}</span>
              <div style={s.dot(bot.active)} title={bot.active ? "Ativo" : "Inativo"} />
            </div>
            <div style={s.meta}>Porta WAHA: {bot.wahaPort}</div>
            <div style={s.meta}>Liga: {bot.cmdOn} &nbsp;|&nbsp; Desliga: {bot.cmdOff}</div>
            <div style={{ ...s.meta, marginTop: 6 }}>
              Criado em {new Date(bot.createdAt).toLocaleDateString("pt-BR")}
            </div>
          </div>
        ))}
        {bots.length === 0 && (
          <p style={{ color: "#8b949e" }}>Nenhum bot ainda. Crie o primeiro!</p>
        )}
      </div>
    </>
  );
}
