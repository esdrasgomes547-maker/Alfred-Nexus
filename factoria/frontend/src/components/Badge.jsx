// Pill de texto para status, variante, etc.
import React from "react";

const VARIANTS = {
  ok:      { bg: "var(--green-dim)",  color: "var(--green)"  },
  error:   { bg: "var(--red-dim)",    color: "var(--red)"    },
  warn:    { bg: "var(--yellow-dim)", color: "var(--yellow)" },
  info:    { bg: "rgba(59,130,246,0.12)", color: "var(--blue)" },
  default: { bg: "rgba(255,255,255,0.06)", color: "var(--text-sec)" },
};

export default function Badge({ label, variant = "default", style }) {
  const v = VARIANTS[variant] || VARIANTS.default;
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: 0.3,
      background: v.bg,
      color: v.color,
      whiteSpace: "nowrap",
      ...style,
    }}>
      {label}
    </span>
  );
}
