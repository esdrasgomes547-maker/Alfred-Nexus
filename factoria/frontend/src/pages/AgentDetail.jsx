// Detalhe de um agente — conexão, configurações, skills, histórico
import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Card      from "../components/Card";
import Input     from "../components/Input";
import Button    from "../components/Button";
import Badge     from "../components/Badge";
import StatusDot from "../components/StatusDot";

const API = "/api";

function sessionVariant(status) {
  if (status === "WORKING") return "ok";
  if (status === "SCAN_QR_CODE") return "warn";
  return "default";
}

export default function AgentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bot, setBot]       = useState(null);
  const [status, setStatus] = useState(null);
  const [logs, setLogs]     = useState([]);
  const [skills, setSkills] = useState([]);
  const [qr, setQr]         = useState(null);
  const [editForm, setEdit] = useState({});
  const [novaSkill, setNS]  = useState({ name: "", trigger: "", response: "" });
  const [salvando, setSalv] = useState(false);

  const carregar = useCallback(async () => {
    const [b, st, lg, sk] = await Promise.all([
      fetch(`${API}/bots/${id}`).then((r) => r.json()),
      fetch(`${API}/bots/${id}/status`).then((r) => r.json()),
      fetch(`${API}/bots/${id}/logs?limit=60`).then((r) => r.json()),
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
    setSalv(true);
    await fetch(`${API}/bots/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    setSalv(false);
    carregar();
  }

  async function deletarBot() {
    if (!confirm(`Deletar o agente "${bot?.name}"? O container WAHA será removido.`)) return;
    await fetch(`${API}/bots/${id}`, { method: "DELETE" });
    navigate("/");
  }

  async function adicionarSkill(e) {
    e.preventDefault();
    if (!novaSkill.trigger.trim() || !novaSkill.response.trim()) return;
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

  if (!bot) return <div style={{ padding: 32, color: "var(--text-sec)" }}>Carregando…</div>;

  const sessLabel = status?.session?.status || "—";
  const containerOk = status?.container === "running";

  const cardH2 = { margin: "0 0 16px", fontSize: 13, fontWeight: 700, color: "var(--text-sec)", textTransform: "uppercase", letterSpacing: 0.6 };
  const label  = { display: "block", fontSize: 12, color: "var(--text-sec)", marginBottom: 5 };
  const group  = { marginBottom: 16 };

  return (
    <div className="fade-in" style={{ padding: "32px 32px 60px" }}>
      <button onClick={() => navigate("/")} style={{ background: "none", border: "none", color: "var(--text-sec)", cursor: "pointer", fontSize: 13, padding: 0, marginBottom: 24 }}>
        ← Voltar
      </button>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28, flexWrap: "wrap" }}>
        <StatusDot status={containerOk ? "running" : "stopped"} size={11} />
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{bot.name}</h1>
        <Badge label={sessLabel} variant={sessionVariant(sessLabel)} />
        <Badge label={`Porta ${bot.wahaPort}`} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        {/* Conexão */}
        <Card>
          <div style={cardH2}>Conexão WhatsApp</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: qr ? 16 : 0 }}>
            <Button variant="success" onClick={conectar}>Conectar</Button>
            <Button variant="ghost" onClick={verQR}>Ver QR Code</Button>
            <Button variant="ghost" onClick={carregar}>Atualizar</Button>
          </div>
          {qr && (
            <div style={{ background: "#fff", padding: 12, borderRadius: "var(--radius-sm)", display: "inline-block" }}>
              <img src={qr} alt="QR Code" style={{ width: "100%", maxWidth: 220, display: "block" }} />
            </div>
          )}
        </Card>

        {/* Configurações */}
        <Card>
          <div style={cardH2}>Configurações</div>
          <form onSubmit={salvarEdicao}>
            <div style={group}>
              <label style={label}>Nome</label>
              <Input value={editForm.name || ""} onChange={(e) => setEdit({ ...editForm, name: e.target.value })} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, ...group }}>
              <div>
                <label style={label}>cmdOn</label>
                <Input value={editForm.cmdOn || ""} onChange={(e) => setEdit({ ...editForm, cmdOn: e.target.value })} />
              </div>
              <div>
                <label style={label}>cmdOff</label>
                <Input value={editForm.cmdOff || ""} onChange={(e) => setEdit({ ...editForm, cmdOff: e.target.value })} />
              </div>
            </div>
            <div style={group}>
              <label style={label}>Prompt do sistema</label>
              <Input multiline value={editForm.prompt || ""} onChange={(e) => setEdit({ ...editForm, prompt: e.target.value })} style={{ minHeight: 80 }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="primary" type="submit" loading={salvando}>Salvar</Button>
              <Button variant="danger" type="button" onClick={deletarBot}>Deletar agente</Button>
            </div>
          </form>
        </Card>

        {/* Skills */}
        <Card style={{ gridColumn: "span 2" }}>
          <div style={cardH2}>Habilidades (Skills)</div>
          {skills.map((sk) => (
            <div key={sk.id} style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ flex: 1, fontSize: 13 }}>
                <strong>{sk.name}</strong>{" "}
                <span style={{ color: "var(--text-muted)" }}>gatilho:</span>{" "}
                <code style={{ color: "var(--accent)" }}>{sk.trigger}</code>
              </span>
              <Badge
                label={sk.active ? "Ativa" : "Inativa"}
                variant={sk.active ? "ok" : "default"}
                style={{ cursor: "pointer" }}
                onClick={() => toggleSkill(sk.id, sk.active)}
              />
              <Button variant="danger" onClick={() => deletarSkill(sk.id)} style={{ padding: "4px 10px" }}>✕</Button>
            </div>
          ))}
          {skills.length === 0 && <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 14 }}>Nenhuma skill ainda.</div>}

          <form onSubmit={adicionarSkill} style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <Input style={{ flex: 1, minWidth: 100 }} placeholder="Nome" value={novaSkill.name} onChange={(e) => setNS({ ...novaSkill, name: e.target.value })} />
            <Input style={{ flex: 1, minWidth: 100 }} placeholder="Gatilho" value={novaSkill.trigger} onChange={(e) => setNS({ ...novaSkill, trigger: e.target.value })} />
            <Input style={{ flex: 2, minWidth: 160 }} placeholder="Resposta" value={novaSkill.response} onChange={(e) => setNS({ ...novaSkill, response: e.target.value })} />
            <Button variant="primary" type="submit">+ Skill</Button>
          </form>
        </Card>

        {/* Histórico */}
        <Card style={{ gridColumn: "span 2" }}>
          <div style={{ ...cardH2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            Histórico de mensagens
            <Button variant="ghost" onClick={carregar} style={{ textTransform: "none", fontWeight: 500 }}>Atualizar</Button>
          </div>
          <div style={{
            background: "#050505",
            borderRadius: "var(--radius-sm)",
            padding: 14,
            maxHeight: 320,
            overflowY: "auto",
            fontSize: 12,
            fontFamily: "var(--font-mono)",
          }}>
            {logs.length === 0 && <span style={{ color: "var(--text-muted)" }}>Sem mensagens ainda.</span>}
            {logs.map((lg) => (
              <div key={lg.id} style={{ color: lg.direction === "in" ? "var(--blue)" : "var(--green)", marginBottom: 5, lineHeight: 1.6 }}>
                <span style={{ color: "var(--text-muted)" }}>
                  [{new Date(lg.createdAt).toLocaleTimeString("pt-BR")}]
                </span>
                {lg.direction === "in" ? " ← " : " → "}
                <strong>{lg.phone}</strong>: {lg.body}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
