// Atendimento — central de conversas: assumir, devolver à IA, responder manual.
import React, { useEffect, useState, useCallback, useRef } from "react";
import Card      from "../components/Card";
import Input     from "../components/Input";
import Button    from "../components/Button";
import Badge     from "../components/Badge";
import StatusDot from "../components/StatusDot";
import { api } from "../lib/api";

const STATUS_META = {
  bot:    { dot: "running", label: "IA",      variant: "ok"      },
  human:  { dot: "pending", label: "Humano",  variant: "warn"    },
  closed: { dot: "offline", label: "Fechada", variant: "default" },
};

export default function Atendimento() {
  const [bots, setBots]       = useState([]);
  const [filtroBot, setFiltro]= useState("");
  const [filtroSt, setFiltroSt]= useState("");
  const [conversas, setConversas] = useState([]);
  const [sel, setSel]         = useState(null);     // conversa selecionada (detalhe)
  const [mensagens, setMsgs]  = useState([]);
  const [texto, setTexto]     = useState("");
  const [enviando, setEnv]    = useState(false);
  const chatRef = useRef(null);

  const carregarLista = useCallback(async () => {
    const qs = new URLSearchParams();
    if (filtroBot) qs.set("botId", filtroBot);
    if (filtroSt)  qs.set("status", filtroSt);
    const lista = await api.get(`/api/conversations?${qs}`).catch(() => []);
    setConversas(lista || []);
  }, [filtroBot, filtroSt]);

  useEffect(() => {
    api.get("/api/bots").then((b) => setBots(b || [])).catch(() => {});
  }, []);

  useEffect(() => {
    carregarLista();
    const t = setInterval(carregarLista, 10_000);
    return () => clearInterval(t);
  }, [carregarLista]);

  const abrir = useCallback(async (id) => {
    const r = await api.get(`/api/conversations/${id}`).catch(() => null);
    if (r) { setSel(r.conversa); setMsgs(r.mensagens || []); }
  }, []);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [mensagens]);

  // Recarrega o detalhe periodicamente enquanto aberto.
  useEffect(() => {
    if (!sel) return;
    const t = setInterval(() => abrir(sel.id), 6_000);
    return () => clearInterval(t);
  }, [sel, abrir]);

  async function acao(verbo) {
    if (!sel) return;
    await api.post(`/api/conversations/${sel.id}/${verbo}`).catch((e) => alert(e.message));
    await abrir(sel.id);
    carregarLista();
  }

  async function enviar(e) {
    e.preventDefault();
    if (!texto.trim() || !sel) return;
    setEnv(true);
    try {
      await api.post(`/api/conversations/${sel.id}/responder`, { text: texto.trim() });
      setTexto("");
      await abrir(sel.id);
    } catch (err) { alert(err.message); }
    finally { setEnv(false); }
  }

  const nomeBot = (id) => bots.find((b) => b.id === id)?.name || "—";
  const selStatus = sel ? (STATUS_META[sel.status] || STATUS_META.bot) : null;

  return (
    <div className="fade-in" style={{ padding: "36px 32px 60px" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, letterSpacing: 2, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase" }}>Plataforma</div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Atendimento</h1>
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <select value={filtroBot} onChange={(e) => setFiltro(e.target.value)} style={selectStyle}>
          <option value="">Todos os bots</option>
          {bots.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={filtroSt} onChange={(e) => setFiltroSt(e.target.value)} style={selectStyle}>
          <option value="">Todos os status</option>
          <option value="bot">IA atendendo</option>
          <option value="human">Com humano</option>
          <option value="closed">Fechadas</option>
        </select>
        <Button variant="ghost" onClick={carregarLista}>Atualizar</Button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 18, alignItems: "start" }}>
        {/* Lista */}
        <Card style={{ padding: 0, maxHeight: 560, overflowY: "auto" }}>
          {conversas.length === 0 && <div style={{ padding: 20, color: "var(--text-muted)", fontSize: 13 }}>Nenhuma conversa.</div>}
          {conversas.map((c) => {
            const m = STATUS_META[c.status] || STATUS_META.bot;
            const ativo = sel?.id === c.id;
            return (
              <div key={c.id} onClick={() => abrir(c.id)} style={{
                padding: "12px 16px", cursor: "pointer",
                borderBottom: "1px solid var(--border)",
                background: ativo ? "rgba(124,58,237,0.12)" : "transparent",
                borderLeft: ativo ? "2px solid var(--accent)" : "2px solid transparent",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                  <StatusDot status={m.dot} size={8} />
                  <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{c.contactName || c.phone}</span>
                  <Badge label={m.label} variant={m.variant} />
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {nomeBot(c.botId)} · {new Date(c.lastMessageAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            );
          })}
        </Card>

        {/* Detalhe */}
        <Card style={{ minHeight: 560, display: "flex", flexDirection: "column" }}>
          {!sel ? (
            <div style={{ margin: "auto", color: "var(--text-muted)", fontSize: 14 }}>Selecione uma conversa</div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                <StatusDot status={selStatus.dot} size={10} />
                <strong style={{ fontSize: 15 }}>{sel.contactName || sel.phone}</strong>
                <Badge label={selStatus.label} variant={selStatus.variant} />
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{nomeBot(sel.botId)}</span>
                <div style={{ flex: 1 }} />
                {sel.status !== "human" && <Button variant="primary" onClick={() => acao("assumir")}>Assumir</Button>}
                {sel.status === "human" && <Button variant="success" onClick={() => acao("devolver")}>Devolver à IA</Button>}
                {sel.status !== "closed" && <Button variant="ghost" onClick={() => acao("encerrar")}>Encerrar</Button>}
              </div>

              {sel.handoffReason && (
                <div style={{ fontSize: 11, color: "var(--yellow)", marginBottom: 10 }}>Motivo do handoff: {sel.handoffReason}</div>
              )}

              <div ref={chatRef} style={{ flex: 1, overflowY: "auto", background: "#050505", borderRadius: "var(--radius-sm)", padding: 14, display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                {mensagens.length === 0 && <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Sem mensagens.</span>}
                {mensagens.map((m) => (
                  <div key={m.id} style={{
                    alignSelf: m.direction === "in" ? "flex-start" : "flex-end",
                    background: m.direction === "in" ? "var(--bg-card)" : "var(--accent)",
                    color: m.direction === "in" ? "var(--text-pri)" : "#fff",
                    padding: "8px 12px", borderRadius: 12, maxWidth: "75%", fontSize: 13, lineHeight: 1.5,
                  }}>
                    {m.body}
                    <div style={{ fontSize: 9, opacity: 0.6, marginTop: 3 }}>{new Date(m.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
                ))}
              </div>

              <form onSubmit={enviar} style={{ display: "flex", gap: 8 }}>
                <Input style={{ flex: 1 }} value={texto} onChange={(e) => setTexto(e.target.value)}
                  placeholder={sel.status === "human" ? "Responder como atendente…" : "Enviar manualmente (a IA segue ativa)…"} disabled={enviando || sel.status === "closed"} />
                <Button variant="primary" type="submit" disabled={enviando || sel.status === "closed"}>Enviar</Button>
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

const selectStyle = {
  padding: "9px 12px", background: "var(--bg-input)", border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)", color: "var(--text-pri)", fontSize: 13, minWidth: 160,
};
