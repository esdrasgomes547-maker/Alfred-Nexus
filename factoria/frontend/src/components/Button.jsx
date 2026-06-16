// Botão com variantes primary / ghost / danger
import React, { useState } from "react";

const VARIANTS = {
  primary: {
    bg:    "var(--accent)",
    hover: "var(--accent-hover)",
    color: "#fff",
    border: "transparent",
  },
  ghost: {
    bg:    "transparent",
    hover: "var(--bg-hover)",
    color: "var(--text-sec)",
    border: "var(--border-hi)",
  },
  danger: {
    bg:    "var(--red-dim)",
    hover: "rgba(239,68,68,0.22)",
    color: "var(--red)",
    border: "transparent",
  },
  success: {
    bg:    "var(--green-dim)",
    hover: "rgba(34,197,94,0.22)",
    color: "var(--green)",
    border: "transparent",
  },
};

export default function Button({
  children,
  variant = "ghost",
  loading = false,
  disabled = false,
  style,
  ...props
}) {
  const [hovered, setHovered] = useState(false);
  const v = VARIANTS[variant] || VARIANTS.ghost;

  return (
    <button
      {...props}
      disabled={disabled || loading}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 16px",
        background: hovered ? v.hover : v.bg,
        color: v.color,
        border: `1px solid ${v.border}`,
        borderRadius: "var(--radius-sm)",
        fontSize: 13,
        fontWeight: 500,
        cursor: disabled || loading ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "background .15s, opacity .15s",
        whiteSpace: "nowrap",
        fontFamily: "var(--font)",
        ...style,
      }}
    >
      {loading ? "…" : children}
    </button>
  );
}
