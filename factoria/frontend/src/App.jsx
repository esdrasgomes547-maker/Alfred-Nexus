import React, { useEffect, useState } from "react";
import { Routes, Route, NavLink, useLocation } from "react-router-dom";

import { useAuth } from "./auth/AuthContext";
import Gate         from "./pages/Gate";
import Dashboard    from "./pages/Dashboard";
import AgentWizard  from "./pages/AgentWizard";
import AgentDetail  from "./pages/AgentDetail";
import Atendimento  from "./pages/Atendimento";
import Integracoes  from "./pages/Integracoes";
import InfraPage    from "./pages/InfraPage";
import Porao        from "./pages/Porao";

// ── Navegação ───────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { to: "/",            icon: "◈", label: "Agentes",     end: true },
  { to: "/atendimento", icon: "✦", label: "Atendimento"            },
  { to: "/integracoes", icon: "⇄", label: "Integrações"            },
  { to: "/infra",       icon: "⬡", label: "Infra & IA"             },
];

function SidebarLink({ to, icon, label, end }) {
  return (
    <NavLink to={to} end={end} style={({ isActive }) => ({
      display: "flex", alignItems: "center", gap: 10,
      padding: "9px 14px", margin: "0 8px",
      borderRadius: "var(--radius-sm)",
      color: isActive ? "var(--text-pri)" : "var(--text-sec)",
      background: isActive ? "rgba(124,58,237,0.14)" : "transparent",
      borderLeft: isActive ? "2px solid var(--accent)" : "2px solid transparent",
      textDecoration: "none", fontSize: 13, fontWeight: 500,
      transition: "background .15s, color .15s",
    })}>
      <span style={{ fontSize: 15, lineHeight: 1 }}>{icon}</span>
      {label}
    </NavLink>
  );
}

export default function App() {
  const { user, carregando, logout } = useAuth();
  const [versao, setVersao] = useState("—");
  const location = useLocation();
  const isPorao  = location.pathname === "/porao";

  useEffect(() => {
    window.electronAPI?.getVersion().then(setVersao).catch(() => {});
  }, []);

  if (carregando) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-sec)" }}>
        Carregando…
      </div>
    );
  }

  // Sem usuário autenticado → tela de login/setup.
  if (!user) return <Gate />;

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* Sidebar */}
      <nav style={{
        width: 208, flexShrink: 0,
        background: "var(--bg-surface)",
        borderRight: "1px solid var(--border)",
        display: "flex", flexDirection: "column",
        padding: "0 0 14px",
      }}>
        <div style={{ padding: "22px 22px 18px", fontSize: 18, fontWeight: 700, letterSpacing: -0.5, userSelect: "none" }}>
          Factor<span style={{ color: "var(--accent)" }}>IA</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
          {NAV_ITEMS.map((n) => <SidebarLink key={n.to} {...n} />)}
        </div>

        {/* Rodapé: usuário + Porão + versão */}
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
          <NavLink to="/porao" style={({ isActive }) => ({
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 14px", margin: "0 8px",
            borderRadius: "var(--radius-sm)",
            color: isActive ? "var(--text-pri)" : "var(--text-muted)",
            textDecoration: "none", fontSize: 12, transition: "color .15s",
          })}>
            <span style={{ fontSize: 13 }}>🔐</span><span>Porão</span>
          </NavLink>

          <div style={{ padding: "10px 18px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ overflow: "hidden" }}>
              <div style={{ fontSize: 11, color: "var(--text-sec)", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                {user.name || user.email}
              </div>
              <div style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>{user.role}</div>
            </div>
            <button onClick={logout} title="Sair" style={{
              background: "none", border: "none", color: "var(--text-muted)",
              cursor: "pointer", fontSize: 14, padding: 4,
            }}>⏻</button>
          </div>
          <div style={{ padding: "8px 18px 0", color: "var(--text-muted)", fontSize: 10 }}>v{versao}</div>
        </div>
      </nav>

      {/* Conteúdo */}
      <main style={{
        flex: 1, overflow: "auto",
        background: isPorao ? "#0a080f" : "var(--bg-base)",
        transition: "background .3s",
      }}>
        <Routes>
          <Route path="/"             element={<Dashboard />} />
          <Route path="/novo"         element={<AgentWizard />} />
          <Route path="/bot/:id"      element={<AgentDetail />} />
          <Route path="/atendimento"  element={<Atendimento />} />
          <Route path="/integracoes"  element={<Integracoes />} />
          <Route path="/infra"        element={<InfraPage />} />
          <Route path="/porao"        element={<Porao />} />
        </Routes>
      </main>
    </div>
  );
}
