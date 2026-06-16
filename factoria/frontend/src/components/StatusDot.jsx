// Indicador circular de status com pulse animado
import React from "react";

const CONFIG = {
  running: { color: "var(--green)",  anim: "pulse-green 2s infinite",  label: "Rodando"   },
  stopped: { color: "var(--red)",    anim: "none",                      label: "Parado"    },
  pending: { color: "var(--yellow)", anim: "pulse-yellow 1.4s infinite",label: "Aguardando"},
  offline: { color: "var(--text-muted)", anim: "none",                  label: "Offline"   },
};

export default function StatusDot({ status = "offline", size = 10, style }) {
  const cfg = CONFIG[status] || CONFIG.offline;
  return (
    <span
      title={cfg.label}
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        background: cfg.color,
        flexShrink: 0,
        animation: cfg.anim,
        ...style,
      }}
    />
  );
}
