// Integrações — chaves de API do gateway /v1 e webhooks de saída.
import React, { useEffect, useState, useCallback } from "react";
import Card   from "../components/Card";
import Input  from "../components/Input";
import Button from "../components/Button";
import Badge  from "../components/Badge";
import { api } from "../lib/api";

const cardH2 = { margin: "0 0 16px", fontSize: 13, fontWeight: 700, color: "var(--text-sec)", textTransform: "uppercase", letterSpacing: 0.6 };
const label  = { display: "block", fontSize: 12, color: "var(--text-sec)", marginBottom: 5 };
const ESCOPOS = ["send", "read", "chat"];

export default function Integracoes() {
  const [bots, setBots]     = useState([]);
  const [chaves, setChaves] = useState([]);
  const [hooks, setHooks]   = useState([]);
  const [novaChaveTexto, setNovaChaveTexto] = useState(null); // chave em texto (mostra 1x)

  // formulário de nova chave
  const [label_, setLabel]   = useState("");
  const [botId, setBotId]    = useState("");
  const [escopos, setEsc]    = useState(["send", "read", "chat"]);

  // formulário de webhook
  const [url, setUrl]        = useState("");
  const [hookBot, setHookBot]= useState("");

  const carregar = useCallback(async () => {
    const [b, k, w] = await Promise.all([
      api.get("/api/bots").catch(() => []),
      api.get("/api/keys").catch(() => []),
      api.get("/api/keys/webhooks").catch(() => []),
    ]);
    setBots(b || []); setChaves(k || []); setHooks(w || []);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  function toggleEscopo(e) {
    setEsc((cur) => cur.includes(e) ? cur.filter((x) => x !== e) : [...cur, e]);
  }

  async function criarChave(e) {
    e.preventDefault();
    if (!label_.trim()) return;
    try {
      const r = await api.post("/api/keys", { label: label_, botId: botId || null, scopes: escopos });
      setNovaChaveTexto(r.chave);
      setLabel(""); setBotId(""); setEsc(["send", "read", "chat"]);
      carregar();
    } catch (err) { alert(err.message); }
  }

  async function toggleChave(k) { await api.patch(`/api/keys/${k.id}`, { active: !k.active }); carregar(); }
  async function delChave(k)    { if (confirm(`Revogar a chave "${k.label}"?`)) { await api.del(`/api/keys/${k.id}`); carregar(); } }

  async function criarHook(e) {
    e.preventDefault();
    if (!url.trim()) return;
    try { await api.post("/api/keys/webhooks", { url, botId: hookBot || null }); setUrl(""); setHookBot(""); carregar(); }
    catch (err) { alert(err.message); }
  }
  async function toggleHook(h) { await api.patch(`/api/keys/webhooks/${h.id}`, { active: !h.active }); carregar(); }
  async function delHook(h)    { await api.del(`/api/keys/webhooks/${h.id}`); carregar(); }

  const nomeBot = (id) => bots.find((b) => b.id === id)?.name || "—";

  return (
    <div className="fade-in" style={{ padding: "36px 32px 60px", maxWidth: 980 }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, letterSpacing: 2, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase" }}>Plataforma</div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Integrações</h1>
        <p style={{ color: "var(--text-sec)", fontSize: 13, marginTop: 8, lineHeight: 1.6 }}>
          Conecte sistemas externos (site, CRM, n8n) aos seus agentes pela API <code style={{ color: "var(--accent)" }}>/v1</code>.
        </p>
      </div>

      {/* chave recém-criada */}
      {novaChaveTexto && (
        <Card glow style={{ marginBottom: 20, borderColor: "var(--accent)" }}>
          <div style={{ ...cardH2, color: "var(--accent)" }}>Chave criada — copie agora!</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
            Esta é a única vez que a chave aparece. Guarde em local seguro.
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <code style={{ flex: 1, minWidth: 280, background: "#050505", padding: "10px 12px", borderRadius: "var(--radius-sm)", color: "var(--green)", fontSize: 13, wordBreak: "break-all" }}>
              {novaChaveTexto}
            </code>
            <Button variant="ghost" onClick={() => { navigator.clipboard?.writeText(novaChaveTexto); }}>Copiar</Button>
            <Button variant="ghost" onClick={() => setNovaChaveTexto(null)}>Fechar</Button>
          </div>
        </Card>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        {/* Chaves */}
        <Card>
          <div style={cardH2}>Chaves de API</div>
          {chaves.length === 0 && <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 14 }}>Nenhuma chave ainda.</div>}
          {chaves.map((k) => (
            <div key={k.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{k.label}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  {k.prefix}…  ·  {k.scopes}  ·  {k.botId ? nomeBot(k.botId) : "todos os bots"}
                </div>
              </div>
              <Badge label={k.active ? "Ativa" : "Inativa"} variant={k.active ? "ok" : "default"} style={{ cursor: "pointer" }} onClick={() => toggleChave(k)} />
              <Button variant="danger" onClick={() => delChave(k)} style={{ padding: "4px 10px" }}>✕</Button>
            </div>
          ))}

          <form onSubmit={criarChave} style={{ marginTop: 16 }}>
            <div style={{ marginBottom: 10 }}>
              <label style={label}>Nome da chave</label>
              <Input value={label_} placeholder="Ex.: site-pixxels" onChange={(e) => setLabel(e.target.value)} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={label}>Escopo do bot</label>
              <select value={botId} onChange={(e) => setBotId(e.target.value)}
                style={{ width: "100%", padding: "9px 10px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text-pri)", fontSize: 13 }}>
                <option value="">Todos os bots</option>
                {bots.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={label}>Permissões</label>
              <div style={{ display: "flex", gap: 8 }}>
                {ESCOPOS.map((e) => (
                  <button type="button" key={e} onClick={() => toggleEscopo(e)} style={{
                    flex: 1, padding: "7px 0", borderRadius: "var(--radius-sm)", cursor: "pointer", fontSize: 12,
                    border: `1px solid ${escopos.includes(e) ? "var(--accent)" : "var(--border)"}`,
                    background: escopos.includes(e) ? "rgba(124,58,237,0.16)" : "transparent",
                    color: escopos.includes(e) ? "var(--text-pri)" : "var(--text-muted)",
                  }}>{e}</button>
                ))}
              </div>
            </div>
            <Button variant="primary" type="submit" disabled={!label_.trim() || escopos.length === 0}>Gerar chave</Button>
          </form>
        </Card>

        {/* Webhooks */}
        <Card>
          <div style={cardH2}>Webhooks de saída</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.6 }}>
            Recebem eventos <code style={{ color: "var(--accent)" }}>message.in/out</code> e <code style={{ color: "var(--accent)" }}>handoff</code>, assinados via HMAC-SHA256.
          </div>
          {hooks.length === 0 && <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 14 }}>Nenhum webhook ainda.</div>}
          {hooks.map((h) => (
            <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>{h.url}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{h.botId ? nomeBot(h.botId) : "todos"} · {h.events}</div>
              </div>
              <Badge label={h.active ? "On" : "Off"} variant={h.active ? "ok" : "default"} style={{ cursor: "pointer" }} onClick={() => toggleHook(h)} />
              <Button variant="danger" onClick={() => delHook(h)} style={{ padding: "4px 10px" }}>✕</Button>
            </div>
          ))}

          <form onSubmit={criarHook} style={{ marginTop: 16 }}>
            <div style={{ marginBottom: 10 }}>
              <label style={label}>URL do endpoint</label>
              <Input value={url} placeholder="https://seu-sistema.com/webhook" onChange={(e) => setUrl(e.target.value)} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={label}>Bot</label>
              <select value={hookBot} onChange={(e) => setHookBot(e.target.value)}
                style={{ width: "100%", padding: "9px 10px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text-pri)", fontSize: 13 }}>
                <option value="">Todos os bots</option>
                {bots.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <Button variant="primary" type="submit" disabled={!url.trim()}>Adicionar webhook</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
