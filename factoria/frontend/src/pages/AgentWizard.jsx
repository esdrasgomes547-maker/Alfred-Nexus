// Wizard de criação de agente — 3 passos
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Input  from "../components/Input";
import Button from "../components/Button";
import { api } from "../lib/api";

const PASSOS = ["Identidade", "Personalidade", "Revisar"];

function Stepper({ atual }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 40 }}>
      {PASSOS.map((label, i) => (
        <React.Fragment key={label}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: i <= atual ? "var(--accent)" : "var(--bg-card)",
              border: `1px solid ${i <= atual ? "var(--accent)" : "var(--border)"}`,
              fontSize: 12,
              fontWeight: 700,
              color: i <= atual ? "#fff" : "var(--text-muted)",
              transition: "all .25s",
            }}>
              {i < atual ? "✓" : i + 1}
            </div>
            <span style={{ fontSize: 11, color: i === atual ? "var(--text-pri)" : "var(--text-muted)", whiteSpace: "nowrap" }}>
              {label}
            </span>
          </div>
          {i < PASSOS.length - 1 && (
            <div style={{
              flex: 1,
              height: 1,
              background: i < atual ? "var(--accent)" : "var(--border)",
              margin: "0 4px",
              marginBottom: 22,
              transition: "background .25s",
            }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

const LABEL = { fontSize: 13, color: "var(--text-sec)", display: "block", marginBottom: 5 };
const GROUP = { marginBottom: 22 };

export default function AgentWizard() {
  const navigate  = useNavigate();
  const [passo, setPasso]   = useState(0);
  const [criando, setCria]  = useState(false);
  const [form, setForm]     = useState({
    name:    "",
    cliente: "",
    prompt:  "",
    cmdOn:   "@lev",
    cmdOff:  "@levoff",
  });

  function campo(key, val) { setForm((f) => ({ ...f, [key]: val })); }

  async function criar() {
    setCria(true);
    try {
      const bot = await api.post("/api/bots", {
        name:   form.name,
        prompt: form.prompt,
        cmdOn:  form.cmdOn,
        cmdOff: form.cmdOff,
      });
      if (bot.id) navigate(`/bot/${bot.id}`);
    } catch (err) {
      alert(err.message || "Falha ao criar agente");
    } finally {
      setCria(false);
    }
  }

  return (
    <div className="fade-in" style={{ maxWidth: 560, margin: "0 auto", padding: "48px 28px" }}>
      {/* Voltar */}
      <button
        onClick={() => navigate("/")}
        style={{ background: "none", border: "none", color: "var(--text-sec)", cursor: "pointer", fontSize: 13, padding: 0, marginBottom: 32 }}
      >
        ← Voltar
      </button>

      <h1 style={{ margin: "0 0 28px", fontSize: 22, fontWeight: 700 }}>Novo Agente</h1>

      <Stepper atual={passo} />

      {/* ── Passo 1: Identidade ── */}
      {passo === 0 && (
        <div className="fade-in">
          <div style={GROUP}>
            <label style={LABEL}>Nome do agente *</label>
            <Input
              autoFocus
              value={form.name}
              placeholder="Ex.: Lev The Bot"
              onChange={(e) => campo("name", e.target.value)}
            />
          </div>
          <div style={GROUP}>
            <label style={LABEL}>Cliente / empresa (opcional)</label>
            <Input
              value={form.cliente}
              placeholder="Ex.: Pixxels Gamer Club"
              onChange={(e) => campo("cliente", e.target.value)}
            />
            <div style={{ marginTop: 5, fontSize: 11, color: "var(--text-muted)" }}>
              Só para seu controle — não afeta o comportamento do bot.
            </div>
          </div>
          <Button variant="primary" disabled={!form.name.trim()} onClick={() => setPasso(1)}>
            Próximo →
          </Button>
        </div>
      )}

      {/* ── Passo 2: Personalidade ── */}
      {passo === 1 && (
        <div className="fade-in">
          <div style={GROUP}>
            <label style={LABEL}>Prompt do sistema</label>
            <Input
              multiline
              autoFocus
              value={form.prompt}
              placeholder={`Você é um assistente de WhatsApp chamado ${form.name || "Lev"}. Responda de forma curta, natural e direta.`}
              onChange={(e) => campo("prompt", e.target.value)}
              style={{ minHeight: 140 }}
            />
            <div style={{ marginTop: 5, fontSize: 11, color: "var(--text-muted)" }}>
              Deixe em branco para usar o padrão do FactorIA.
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, ...GROUP }}>
            <div>
              <label style={LABEL}>Comando ligar</label>
              <Input
                value={form.cmdOn}
                placeholder="@lev"
                onChange={(e) => campo("cmdOn", e.target.value)}
              />
            </div>
            <div>
              <label style={LABEL}>Comando desligar</label>
              <Input
                value={form.cmdOff}
                placeholder="@levoff"
                onChange={(e) => campo("cmdOff", e.target.value)}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Button variant="ghost" onClick={() => setPasso(0)}>← Voltar</Button>
            <Button variant="primary" onClick={() => setPasso(2)}>Próximo →</Button>
          </div>
        </div>
      )}

      {/* ── Passo 3: Revisão ── */}
      {passo === 2 && (
        <div className="fade-in">
          <div style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            padding: 20,
            marginBottom: 24,
          }}>
            <Row label="Nome"    value={form.name} />
            {form.cliente && <Row label="Cliente" value={form.cliente} />}
            <Row label="cmdOn"   value={form.cmdOn} />
            <Row label="cmdOff"  value={form.cmdOff} />
            <Row label="Prompt"  value={form.prompt || "(padrão do FactorIA)"} mono={false} />
          </div>

          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>
            Um container Docker WAHA será criado automaticamente para este agente.<br />
            Após criar, conecte o WhatsApp escaneando o QR Code.
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <Button variant="ghost" onClick={() => setPasso(1)}>← Voltar</Button>
            <Button variant="primary" loading={criando} onClick={criar}>
              {criando ? "Criando…" : "✓ Criar agente"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, mono = true }) {
  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
      <span style={{ width: 80, fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, flexShrink: 0, paddingTop: 2 }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--text-pri)", fontFamily: mono ? "var(--font-mono)" : "var(--font)", wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}
