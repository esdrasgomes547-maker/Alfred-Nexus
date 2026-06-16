import React from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import Factory   from "./pages/Factory";
import BotDetail from "./pages/BotDetail";
import Infra     from "./pages/Infra";

const s = {
  layout: { display: "flex", minHeight: "100vh" },
  sidebar: {
    width: 220,
    background: "#161b22",
    borderRight: "1px solid #30363d",
    padding: "24px 0",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    flexShrink: 0,
  },
  brand: {
    padding: "0 20px 20px",
    fontSize: 20,
    fontWeight: 700,
    color: "#58a6ff",
    letterSpacing: -0.5,
  },
  link: {
    display: "block",
    padding: "10px 20px",
    color: "#8b949e",
    textDecoration: "none",
    borderRadius: 6,
    margin: "0 8px",
    fontSize: 14,
  },
  main: { flex: 1, padding: 32, overflow: "auto" },
};

const activeStyle = { color: "#e2e8f0", background: "#21262d" };

export default function App() {
  return (
    <div style={s.layout}>
      <nav style={s.sidebar}>
        <div style={s.brand}>⚡ FactorIA</div>
        <NavLink to="/"     style={({ isActive }) => ({ ...s.link, ...(isActive ? activeStyle : {}) })} end>
          Fábrica de Bots
        </NavLink>
        <NavLink to="/infra" style={({ isActive }) => ({ ...s.link, ...(isActive ? activeStyle : {}) })}>
          Infra & IA Interna
        </NavLink>
      </nav>
      <main style={s.main}>
        <Routes>
          <Route path="/"        element={<Factory />} />
          <Route path="/bot/:id" element={<BotDetail />} />
          <Route path="/infra"   element={<Infra />} />
        </Routes>
      </main>
    </div>
  );
}
