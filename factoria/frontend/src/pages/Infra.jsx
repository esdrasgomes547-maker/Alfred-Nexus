// Página Infra — status dos containers Docker + chat da IA interna
import React, { useEffect, useState, useRef } from "react";

const API = "/api";

const s = {
  h1:     { margin: "0 0 24px", fontSize: 22, fontWeight: 600 },
  grid:   { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 },
  card:   { background: "#161b22", border: "1px solid #30363d", borderRadius: 10, padding: 20 },
  h2:     { margin: "0 0 14px", fontSize: 15, fontWeight: 600, color: "#8b949e" },
  badge:  (ok) => ({ display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: 11, background: ok ? "#1a4731" : "#4d1a1a", color: ok ? "#3fb950" : "#f85149" }),
  chatBox: { background: "#0d1117", borderRadius: 6, padding: 12, height: 280, overflowY: "auto", fontSize: 13, marginBottom: 10, fontFamily: "monospace" },
  msgUser: { color: "#79c0ff", marginBottom: 8 },
  msgBot:  { color: "#e2e8f0", marginBottom: 8 },
  inputRow: { display: "flex", gap: 8 },
  input:  { flex: 1, padding: "8px 10px", background: "#0d1117", border: "1px solid #30363d", borderRadius: 6, color: "#e2e8f0", fontSize: 13 },
  btn:    { padding: "8px 16px", background: "#1f6feb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 },
  meta:   { color: "#8b949e", fontSize: 12, marginBottom: 4 },
};

export default function Infra() {
  const [status, setStatus]     = useState(null);
  const [docker, setDocker]     = useState([]);
  const [msgs, setMsgs]         = useState([{ papel: "bot", texto: "Oi! Sou a IA interna do FactorIA. Como posso ajudar?" }]);
  const [input, setInput]       = useState("");
  const [enviando, setEnviando] = useState(false);
  const chatRef = useRef(null);

  async function carregar() {
    const [st, dk] = await Promise.all([
      fetch(`${API}/infra/status`).then((r) => r.json()),
      fetch(`${API}/infra/docker`).then((r) => r.json()),
    ]);
    setStatus(st);
    setDocker(dk.containers || []);
  }

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 15_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [msgs]);

  async function enviar(e) {
    e.preventDefault();
    if (!input.trim() || enviando) return;
    const texto = input.trim();
    setInput("");
    setMsgs((m) => [...m, { papel: "user", texto }]);
    setEnviando(true);
    const resp = await fetch(`${API}/infra/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensagem: texto }),
    });
    const data = await resp.json();
    setMsgs((m) => [...m, { papel: "bot", texto: data.resposta || "..." }]);
    setEnviando(false);
  }

  return (
    <>
      <h1 style={s.h1}>Infra & IA Interna</h1>
      <div style={s.grid}>
        {/* Status geral */}
        <div style={s.card}>
          <div style={s.h2}>Status da Plataforma</div>
          {status ? (
            <>
              <div style={s.meta}>Docker: <span style={s.badge(status.docker)}>{status.docker ? "OK" : "offline"}</span></div>
              <div style={s.meta}>Cérebro (LLM): <strong>{status.cerebro}</strong></div>
              <div style={s.meta}>Uptime: {Math.floor(status.uptime / 60)} min</div>
              <div style={s.meta}>
                RAM: {Math.round(status.memoria?.heapUsed / 1024 / 1024)} MB usados
              </div>
            </>
          ) : <p style={{ color: "#8b949e" }}>Carregando...</p>}

          <div style={{ marginTop: 20 }}>
            <div style={s.h2}>Containers WAHA</div>
            {docker.length === 0 && <p style={{ color: "#8b949e", fontSize: 13 }}>Nenhum container rodando.</p>}
            {docker.map((c) => (
              <div key={c.name} style={{ fontSize: 12, marginBottom: 6 }}>
                <strong>{c.name}</strong> — {c.status}<br />
                <span style={{ color: "#8b949e" }}>{c.ports}</span>
              </div>
            ))}
          </div>
          <button style={{ ...s.btn, marginTop: 12 }} onClick={carregar}>Atualizar</button>
        </div>

        {/* Chat da IA interna */}
        <div style={s.card}>
          <div style={s.h2}>Chat da IA Interna</div>
          <div style={s.chatBox} ref={chatRef}>
            {msgs.map((m, i) => (
              <div key={i} style={m.papel === "user" ? s.msgUser : s.msgBot}>
                <strong>{m.papel === "user" ? "Você" : "FactorIA"}:</strong> {m.texto}
              </div>
            ))}
            {enviando && <div style={s.msgBot}><em>digitando...</em></div>}
          </div>
          <form style={s.inputRow} onSubmit={enviar}>
            <input
              style={s.input}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte qualquer coisa sobre o FactorIA..."
              disabled={enviando}
            />
            <button style={s.btn} type="submit" disabled={enviando}>Enviar</button>
          </form>
        </div>
      </div>
    </>
  );
}
