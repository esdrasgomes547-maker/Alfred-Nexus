// Input / Textarea estilizado com o design system
import React, { useState } from "react";

export default function Input({ multiline, style, ...props }) {
  const [focused, setFocused] = useState(false);

  const base = {
    display: "block",
    width: "100%",
    padding: "9px 12px",
    background: "var(--bg-input)",
    border: `1px solid ${focused ? "var(--accent)" : "var(--border)"}`,
    borderRadius: "var(--radius-sm)",
    color: "var(--text-pri)",
    fontSize: 13,
    fontFamily: "var(--font)",
    outline: "none",
    transition: "border-color .15s",
    boxShadow: focused ? "0 0 0 3px var(--accent-dim)" : "none",
    resize: multiline ? "vertical" : undefined,
    minHeight: multiline ? 100 : undefined,
    ...style,
  };

  const Tag = multiline ? "textarea" : "input";
  return (
    <Tag
      {...props}
      style={base}
      onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
      onBlur={(e)  => { setFocused(false); props.onBlur?.(e); }}
    />
  );
}
