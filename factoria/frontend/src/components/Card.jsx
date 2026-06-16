// Container visual padrão do design system
import React, { useState } from "react";

export default function Card({ children, style, onClick, glow, className }) {
  const [hovered, setHovered] = useState(false);

  const base = {
    background: "var(--bg-card)",
    border: `1px solid ${hovered && glow ? "var(--accent)" : "var(--border)"}`,
    borderRadius: "var(--radius-md)",
    padding: 20,
    boxShadow: hovered && glow
      ? "0 0 0 1px var(--accent-glow), 0 8px 32px rgba(0,0,0,0.5)"
      : "0 2px 12px rgba(0,0,0,0.4)",
    transition: "border-color .18s, box-shadow .18s",
    cursor: onClick ? "pointer" : "default",
    ...style,
  };

  return (
    <div
      className={className}
      style={base}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </div>
  );
}
