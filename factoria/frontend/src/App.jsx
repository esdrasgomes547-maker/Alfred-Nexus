import React, { useEffect, useState } from "react";
import { Routes, Route, NavLink, useLocation } from "react-router-dom";

import Dashboard    from "./pages/Dashboard";
import AgentWizard  from "./pages/AgentWizard";
import AgentDetail  from "./pages/AgentDetail";
import InfraPage    from "./pages/InfraPage";
import Porao        from "./pages/Porao";

// ── Sidebar ───────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { to: "/",      icon: "◈", label: "Agentes",  end: true },
  { to: "/infra", icon: "⬡", label: "Infra & IA"         },
];

function SidebarLink({ to, icon, label, end }) {
  return (
    <NavLink to={to} end={end} style={({ isActive }) => ({
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "9px 14px",
      margin: "0 8px",
      borderRadius: "var(--radius-sm)",
      color: isActive ? "var(--text-pri)" : "var(--text-sec)",
      background: isActive ? "rgba(124,58,237,0.14)" : "transparent",
      borderLeft: isActive ? "2px solid var(--accent)" : "2px solid transparent",
      textDecoration: "none",
      fontSize: 13,
      fontWeight: 500,
      transition: "background .15s, color .15s",
    })}>
      <span style={{ fontSize: 15, lineHeight: 1 }}>{icon}</span>
      {label}
    </NavLink>
  );
}

export default function App() {
  const [versao, setVersao] = useState("—");
  const location = useLocation();
  const isPorao  = location.pathname === "/porao";

  useEffect(() => {
    window.electronAPI?.getVersion().then(setVersao).catch(() => {});
  }, []);

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* Sidebar */}
      <nav style={{
        width: 200,
        flexShrink: 0,
        background: "var(--bg-surface)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        padding: "0 0 16px",
      }}>
        {/* Logo */}
        <div style={{
          padding: "22px 22px 18px",
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: -0.5,
          userSelect: "none",
        }}>
          Factor<span style={{ color: "var(--accent)" }}>IA</span>
        </div>

        {/* Links principais */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
          {NAV_ITEMS.map((n) => (
            <SidebarLink key={n.to} {...n} />
          ))}
        </div>

        {/* Porão — discreto no rodapé */}
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
          <NavLink to="/porao" style={({ isActive }) => ({
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 14px",
            margin: "0 8px",
            borderRadius: "var(--radius-sm)",
            color: isActive ? "var(--text-pri)" : "var(--text-muted)",
            textDecoration: "none",
            fontSize: 12,
            transition: "color .15s",
          })}>
            <span style={{ fontSize: 13 }}>🔐</span>
            <span>Porão</span>
          </NavLink>
          <div style={{ padding: "6px 22px 0", color: "var(--text-muted)", fontSize: 10 }}>
            v{versao}
          </div>
        </div>
      </nav>

      {/* Conteúdo */}
      <main style={{
        flex: 1,
        overflow: "auto",
        background: isPorao ? "#0a080f" : "var(--bg-base)", // fundo mais escuro/roxo no Porão
        transition: "background .3s",
      }}>
        <Routes>
          <Route path="/"         element={<Dashboard />} />
          <Route path="/novo"     element={<AgentWizard />} />
          <Route path="/bot/:id"  element={<AgentDetail />} />
          <Route path="/infra"    element={<InfraPage />} />
          <Route path="/porao"    element={<Porao />} />
        </Routes>
      </main>
    </div>
  );
}
