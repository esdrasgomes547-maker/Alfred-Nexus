// Usuários — gestão de acesso da plataforma (somente admin).
import React, { useEffect, useState, useCallback } from "react";
import Card   from "../components/Card";
import Input  from "../components/Input";
import Button from "../components/Button";
import Badge  from "../components/Badge";
import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";

const PAPEIS = ["admin", "operator", "viewer"];
const PAPEL_VARIANT = { admin: "ok", operator: "info", viewer: "default" };
const label = { display: "block", fontSize: 12, color: "var(--text-sec)", marginBottom: 5 };

export default function Usuarios() {
  const { user: atual } = useAuth();
  const [users, setUsers] = useState([]);
  const [form, setForm]   = useState({ email: "", senha: "", name: "", role: "operator" });
  const [erro, setErro]   = useState(null);

  const carregar = useCallback(async () => {
    setUsers(await api.get("/api/auth/users").catch(() => []));
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  async function criar(e) {
    e.preventDefault();
    setErro(null);
    try {
      await api.post("/api/auth/users", form);
      setForm({ email: "", senha: "", name: "", role: "operator" });
      carregar();
    } catch (err) { setErro(err.message); }
  }

  async function mudarPapel(u, role)   { await api.patch(`/api/auth/users/${u.id}`, { role }); carregar(); }
  async function alternarAtivo(u)      { await api.patch(`/api/auth/users/${u.id}`, { active: !u.active }); carregar(); }
  async function remover(u)            { if (confirm(`Remover ${u.email}?`)) { await api.del(`/api/auth/users/${u.id}`); carregar(); } }

  return (
    <div className="fade-in" style={{ padding: "36px 32px 60px", maxWidth: 860 }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, letterSpacing: 2, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase" }}>Plataforma</div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Usuários & Acesso</h1>
        <p style={{ color: "var(--text-sec)", fontSize: 13, marginTop: 8, lineHeight: 1.6 }}>
          Papéis: <strong>admin</strong> (tudo) · <strong>operator</strong> (opera bots e atendimento) · <strong>viewer</strong> (só leitura).
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 18, alignItems: "start" }}>
        <Card>
          {users.map((u) => (
            <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{u.name || u.email} {u.id === atual.id && <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(você)</span>}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{u.email}</div>
              </div>
              <select value={u.role} disabled={u.id === atual.id} onChange={(e) => mudarPapel(u, e.target.value)}
                style={{ padding: "5px 8px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text-pri)", fontSize: 12 }}>
                {PAPEIS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <Badge label={u.active ? "Ativo" : "Inativo"} variant={u.active ? "ok" : "default"} style={{ cursor: u.id === atual.id ? "default" : "pointer" }} onClick={() => u.id !== atual.id && alternarAtivo(u)} />
              {u.id !== atual.id && <Button variant="danger" onClick={() => remover(u)} style={{ padding: "4px 10px" }}>✕</Button>}
            </div>
          ))}
          {users.length === 0 && <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Carregando…</div>}
        </Card>

        <Card>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-sec)", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 16 }}>Novo usuário</div>
          <form onSubmit={criar}>
            <div style={{ marginBottom: 12 }}><label style={label}>Nome</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div style={{ marginBottom: 12 }}><label style={label}>E-mail</label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div style={{ marginBottom: 12 }}><label style={label}>Senha (mín. 8)</label><Input type="password" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} /></div>
            <div style={{ marginBottom: 16 }}>
              <label style={label}>Papel</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                style={{ width: "100%", padding: "9px 10px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text-pri)", fontSize: 13 }}>
                {PAPEIS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            {erro && <div style={{ color: "var(--red)", fontSize: 12, marginBottom: 12 }}>{erro}</div>}
            <Button variant="primary" type="submit" disabled={!form.email || form.senha.length < 8}>Criar usuário</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
