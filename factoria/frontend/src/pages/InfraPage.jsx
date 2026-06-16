// Infra & IA Interna — containers Docker + chat de configuração
import React, { useEffect, useState, useRef } from "react";
import Card      from "../components/Card";
import Badge     from "../components/Badge";
import Button    from "../components/Button";
import Input     from "../components/Input";
import StatusDot from "../components/StatusDot";

const API = "/api";

export default function InfraPage() {
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

  const cardH2 = { margin: "0 0 16px", fontSize: 13, fontWeight: 700, color: "var(--text-sec)", textTransform: "uppercase", letterSpacing: 0.6 };

  return (
    <div className="fade-in" style={{ padding: "32px 32px 60px" }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, letterSpacing: 2, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase" }}>
          Plataforma
        </div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Infra & IA Interna</h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        {/* Status geral */}
        <Card>
          <div style={cardH2}>Status da Plataforma</div>
          {status ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              <Row k="Docker"  v={<Badge label={status.docker ? "OK" : "offline"} variant={status.docker ? "ok" : "error"} />} />
              <Row k="Cérebro (LLM)" v={<strong style={{ color: "var(--text-pri)" }}>{status.cerebro}</strong>} />
              <Row k="Uptime"  v={`${Math.floor(status.uptime / 60)} min`} />
              <Row k="RAM"     v={`${Math.round(status.memoria?.heapUsed / 1024 / 1024)} MB`} />
            </div>
          ) : <p style={{ color: "var(--text-muted)" }}>Carregando…</p>}

          <div style={{ ...cardH2, marginTop: 4 }}>Containers WAHA</div>
          {docker.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Nenhum container rodando.</p>}
          {docker.map((c) => (
            <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginBottom: 8 }}>
              <StatusDot status={c.status?.includes("Up") ? "running" : "stopped"} size={8} />
              <div>
                <strong style={{ color: "var(--text-pri)" }}>{c.name}</strong> — {c.status}<br />
                <span style={{ color: "var(--text-muted)" }}>{c.ports}</span>
              </div>
            </div>
          ))}
          <Button variant="ghost" onClick={carregar} style={{ marginTop: 12 }}>Atualizar</Button>
        </Card>

        {/* Chat IA interna */}
        <Card>
          <div style={cardH2}>Chat da IA Interna</div>
          <div ref={chatRef} style={{
            background: "#050505",
            borderRadius: "var(--radius-sm)",
            padding: 14,
            height: 300,
            overflowY: "auto",
            marginBottom: 12,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}>
            {msgs.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.papel === "user" ? "flex-end" : "flex-start",
                background: m.papel === "user" ? "var(--accent)" : "var(--bg-card)",
                color: m.papel === "user" ? "#fff" : "var(--text-pri)",
                padding: "8px 12px",
                borderRadius: 12,
                maxWidth: "80%",
                fontSize: 13,
                lineHeight: 1.5,
              }}>
                {m.texto}
              </div>
            ))}
            {enviando && (
              <div style={{ alignSelf: "flex-start", color: "var(--text-muted)", fontSize: 12, fontStyle: "italic" }}>
                digitando…
              </div>
            )}
          </div>
          <form onSubmit={enviar} style={{ display: "flex", gap: 8 }}>
            <Input
              style={{ flex: 1 }}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte sobre o FactorIA…"
              disabled={enviando}
            />
            <Button variant="primary" type="submit" disabled={enviando}>Enviar</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
      <span style={{ color: "var(--text-muted)" }}>{k}</span>
      <span style={{ color: "var(--text-sec)" }}>{v}</span>
    </div>
  );
}
