// Detalhe de um agente — conexão, configurações, skills, fluxo, histórico
import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Card      from "../components/Card";
import Input     from "../components/Input";
import Button    from "../components/Button";
import Badge     from "../components/Badge";
import StatusDot from "../components/StatusDot";
import { api } from "../lib/api";

function sessionVariant(status) {
  if (status === "WORKING") return "ok";
  if (status === "SCAN_QR_CODE") return "warn";
  return "default";
}

const cardH2 = { margin: "0 0 16px", fontSize: 13, fontWeight: 700, color: "var(--text-sec)", textTransform: "uppercase", letterSpacing: 0.6 };
const label  = { display: "block", fontSize: 12, color: "var(--text-sec)", marginBottom: 5 };
const group  = { marginBottom: 16 };

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
      api.get(`/api/bots/${id}`),
      api.get(`/api/bots/${id}/status`).catch(() => null),
      api.get(`/api/bots/${id}/logs?limit=60`).catch(() => []),
      api.get(`/api/skills?botId=${id}`).catch(() => []),
    ]);
    setBot(b);
    setStatus(st);
    setLogs(Array.isArray(lg) ? lg : []);
    setSkills(Array.isArray(sk) ? sk : []);
    setEdit({ name: b.name, cmdOn: b.cmdOn, cmdOff: b.cmdOff, prompt: b.prompt });
  }, [id]);

  useEffect(() => { carregar(); }, [carregar]);

  async function conectar() {
    await api.post(`/api/bots/${id}/connect`);
    setTimeout(carregar, 3000);
  }

  async function verQR() {
    const data = await api.get(`/api/bots/${id}/qr`).catch(() => null);
    setQr(data?.mimetype ? `data:${data.mimetype};base64,${data.data}` : null);
  }

  async function salvarEdicao(e) {
    e.preventDefault();
    setSalv(true);
    try { await api.patch(`/api/bots/${id}`, editForm); await carregar(); }
    catch (err) { alert(err.message); }
    finally { setSalv(false); }
  }

  async function deletarBot() {
    if (!confirm(`Deletar o agente "${bot?.name}"? O container WAHA será removido.`)) return;
    await api.del(`/api/bots/${id}`);
    navigate("/");
  }

  async function adicionarSkill(e) {
    e.preventDefault();
    if (!novaSkill.trigger.trim() || !novaSkill.response.trim()) return;
    await api.post(`/api/skills`, { botId: id, ...novaSkill });
    setNS({ name: "", trigger: "", response: "" });
    carregar();
  }

  async function toggleSkill(skillId, active) {
    await api.patch(`/api/skills/${skillId}`, { active: !active });
    carregar();
  }

  async function deletarSkill(skillId) {
    await api.del(`/api/skills/${skillId}`);
    carregar();
  }

  if (!bot) return <div style={{ padding: 32, color: "var(--text-sec)" }}>Carregando…</div>;

  const sessLabel = status?.session?.status || "—";
  const containerOk = status?.container === "running";

  return (
    <div className="fade-in" style={{ padding: "32px 32px 60px" }}>
      <button onClick={() => navigate("/")} style={{ background: "none", border: "none", color: "var(--text-sec)", cursor: "pointer", fontSize: 13, padding: 0, marginBottom: 24 }}>
        ← Voltar
      </button>

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
              <Badge label={sk.active ? "Ativa" : "Inativa"} variant={sk.active ? "ok" : "default"} style={{ cursor: "pointer" }} onClick={() => toggleSkill(sk.id, sk.active)} />
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

        {/* Fluxo de trabalho */}
        <div style={{ gridColumn: "span 2" }}>
          <FlowEditor botId={id} />
        </div>

        {/* Histórico */}
        <Card style={{ gridColumn: "span 2" }}>
          <div style={{ ...cardH2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            Histórico de mensagens
            <Button variant="ghost" onClick={carregar} style={{ textTransform: "none", fontWeight: 500 }}>Atualizar</Button>
          </div>
          <div style={{ background: "#050505", borderRadius: "var(--radius-sm)", padding: 14, maxHeight: 320, overflowY: "auto", fontSize: 12, fontFamily: "var(--font-mono)" }}>
            {logs.length === 0 && <span style={{ color: "var(--text-muted)" }}>Sem mensagens ainda.</span>}
            {logs.map((lg) => (
              <div key={lg.id} style={{ color: lg.direction === "in" ? "var(--blue)" : "var(--green)", marginBottom: 5, lineHeight: 1.6 }}>
                <span style={{ color: "var(--text-muted)" }}>[{new Date(lg.createdAt).toLocaleTimeString("pt-BR")}]</span>
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

// ── Editor de fluxo de trabalho ───────────────────────────────────────────────
const MODELO = {
  start: "saudacao",
  nodes: {
    saudacao: { type: "message", text: "Oi! Seja bem-vindo. 👋", next: "menu" },
    menu: {
      type: "menu",
      text: "Como posso te ajudar?",
      options: [
        { label: "Fazer um pedido", next: "nome" },
        { label: "Tirar dúvidas",   next: "duvidas" },
        { label: "Falar com humano", next: "humano" },
      ],
    },
    nome:    { type: "collect", text: "Legal! Qual seu nome?", var: "nome", next: "confirma" },
    confirma:{ type: "message", text: "Perfeito, {{nome}}! Vou te ajudar com o pedido.", next: "duvidas" },
    duvidas: { type: "ai", text: "Pode perguntar o que quiser!" },
    humano:  { type: "handoff", text: "cliente escolheu falar com humano" },
  },
};

function FlowEditor({ botId }) {
  const [texto, setTexto]   = useState("");
  const [ativo, setAtivo]   = useState(false);
  const [nome, setNome]     = useState("Fluxo principal");
  const [msg, setMsg]       = useState(null);
  const [salvando, setSalv] = useState(false);

  const carregar = useCallback(async () => {
    const flow = await api.get(`/api/flows/${botId}`).catch(() => null);
    if (flow) {
      setAtivo(flow.active);
      setNome(flow.name || "Fluxo principal");
      try { setTexto(JSON.stringify(JSON.parse(flow.definition || "{}"), null, 2)); }
      catch { setTexto(flow.definition || ""); }
    } else {
      setTexto(JSON.stringify(MODELO, null, 2));
    }
  }, [botId]);

  useEffect(() => { carregar(); }, [carregar]);

  function parse() {
    try { return { def: JSON.parse(texto) }; }
    catch (e) { return { erro: "JSON inválido: " + e.message }; }
  }

  async function validar() {
    const { def, erro } = parse();
    if (erro) return setMsg({ tipo: "erro", txt: erro });
    const r = await api.post(`/api/flows/${botId}/validar`, { definition: def });
    setMsg(r.ok ? { tipo: "ok", txt: "Fluxo válido ✓" } : { tipo: "erro", txt: r.erros.join(" · ") });
  }

  async function salvar(ativarAgora) {
    const { def, erro } = parse();
    if (erro) return setMsg({ tipo: "erro", txt: erro });
    setSalv(true);
    try {
      const flow = await api.put(`/api/flows/${botId}`, { name: nome, active: ativarAgora, definition: def });
      setAtivo(flow.active);
      setMsg({ tipo: "ok", txt: ativarAgora ? "Fluxo salvo e ativado ✓" : "Fluxo salvo (inativo)" });
    } catch (err) {
      setMsg({ tipo: "erro", txt: err.detalhes ? err.detalhes.join(" · ") : err.message });
    } finally { setSalv(false); }
  }

  const corMsg = msg?.tipo === "ok" ? "var(--green)" : "var(--red)";

  return (
    <Card>
      <div style={{ ...cardH2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Fluxo de trabalho</span>
        <Badge label={ativo ? "Ativo" : "Inativo"} variant={ativo ? "ok" : "default"} />
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.6 }}>
        Roteiro automático que o bot segue antes de cair na IA. Tipos de nó:{" "}
        <code style={{ color: "var(--accent)" }}>message</code>,{" "}
        <code style={{ color: "var(--accent)" }}>menu</code>,{" "}
        <code style={{ color: "var(--accent)" }}>collect</code>,{" "}
        <code style={{ color: "var(--accent)" }}>ai</code>,{" "}
        <code style={{ color: "var(--accent)" }}>handoff</code>,{" "}
        <code style={{ color: "var(--accent)" }}>end</code>.
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={label}>Nome do fluxo</label>
        <Input value={nome} onChange={(e) => setNome(e.target.value)} />
      </div>

      <Input multiline value={texto} onChange={(e) => setTexto(e.target.value)}
        style={{ minHeight: 240, fontFamily: "var(--font-mono)", fontSize: 12 }} />

      {msg && <div style={{ color: corMsg, fontSize: 12, marginTop: 10 }}>{msg.txt}</div>}

      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        <Button variant="ghost"   onClick={validar}>Validar</Button>
        <Button variant="primary" loading={salvando} onClick={() => salvar(true)}>Salvar e ativar</Button>
        <Button variant="ghost"   onClick={() => salvar(false)}>Salvar inativo</Button>
        <Button variant="ghost"   onClick={() => setTexto(JSON.stringify(MODELO, null, 2))}>Carregar modelo</Button>
      </div>
    </Card>
  );
}
