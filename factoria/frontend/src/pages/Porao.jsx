// Porão — cofre de chaves da plataforma.
// Chaves ficam encriptadas no keychain do OS via Electron safeStorage.
// A UI mostra •••••••• para chaves já salvas — só atualiza se o usuário digitar.
import React, { useEffect, useState } from "react";
import Card   from "../components/Card";
import Input  from "../components/Input";
import Button from "../components/Button";

const CAMPOS = [
  { group: "LLM (Cérebro dos agentes)",
    itens: [
      { key: "GROQ_API_KEY",      label: "Groq API Key",      ph: "gsk_…", type: "password", dica: "Primário — llama-3.3-70b-versatile" },
      { key: "ANTHROPIC_API_KEY", label: "Anthropic API Key", ph: "sk-ant-…", type: "password", dica: "Opcional — tem prioridade se preenchido" },
    ],
  },
  { group: "WhatsApp (WAHA)",
    itens: [
      { key: "WAHA_BASE_URL", label: "WAHA Base URL", ph: "http://waha:3000", type: "text", dica: "URL do container WAHA" },
      { key: "WAHA_API_KEY",  label: "WAHA API Key",  ph: "—",               type: "password", dica: "Deixe vazio se não usar autenticação" },
    ],
  },
  { group: "TTS / Voz",
    itens: [
      { key: "ELEVENLABS_API_KEY", label: "ElevenLabs API Key", ph: "—", type: "password", dica: "Opcional — geração de voz dinâmica" },
    ],
  },
  { group: "Notificações",
    itens: [
      { key: "ANDRE_WHATSAPP", label: "WhatsApp do Dono", ph: "5591999990000", type: "text", dica: "Número que recebe as notificações de reserva" },
    ],
  },
  { group: "Banco de Dados",
    itens: [
      { key: "DATABASE_URL", label: "Database URL", ph: "file:./factoria.db", type: "text", dica: "SQLite padrão — ou postgresql://… para externo" },
    ],
  },
];

const MASKED = "••••••••";

export default function Porao() {
  const [form, setForm]       = useState({});
  const [salvando, setSalv]   = useState(false);
  const [toast, setToast]     = useState(null);
  const [reiniciando, setRe]  = useState(false);

  useEffect(() => {
    // Carrega chaves mascaradas (UI sabe o que está preenchido, não o valor real)
    window.electronAPI?.poraoGet().then((dados) => {
      if (dados) setForm(dados);
    });
  }, []);

  function atualizar(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function mostrarToast(msg, cor = "var(--green)") {
    setToast({ msg, cor });
    setTimeout(() => setToast(null), 3500);
  }

  async function salvar(e) {
    e.preventDefault();
    setSalv(true);
    // Filtra campos que o usuário não tocou (manteve ••••••••)
    const enviar = {};
    for (const [k, v] of Object.entries(form)) {
      if (v !== MASKED && v !== undefined) enviar[k] = v;
    }
    const resp = await window.electronAPI?.poraoSet(enviar);
    setSalv(false);
    if (resp?.ok) mostrarToast("✓ Chaves salvas com segurança");
    else mostrarToast("✗ Erro ao salvar", "var(--red)");
  }

  async function reiniciar() {
    setRe(true);
    const resp = await window.electronAPI?.poraoRestart();
    setRe(false);
    if (resp?.ok) mostrarToast("✓ Backend reiniciado com as novas chaves");
    else mostrarToast(`✗ ${resp?.error || "Erro ao reiniciar"}`, "var(--red)");
  }

  return (
    <div className="fade-in" style={{ maxWidth: 600, margin: "0 auto", padding: "40px 28px" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, letterSpacing: 2, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase" }}>
          Configurações avançadas
        </div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--text-pri)" }}>
          🔐 Porão
        </h1>
        <p style={{ margin: "8px 0 0", color: "var(--text-sec)", fontSize: 13, lineHeight: 1.6 }}>
          Chaves encriptadas no keychain do sistema operacional.<br />
          Campos com <code style={{ color: "var(--accent)", fontSize: 12 }}>••••••••</code> já estão preenchidos — só edite para alterar.
        </p>
      </div>

      <form onSubmit={salvar}>
        {CAMPOS.map((grupo) => (
          <div key={grupo.group} style={{ marginBottom: 28 }}>
            <div style={{
              fontSize: 10,
              letterSpacing: 1.5,
              color: "var(--accent)",
              textTransform: "uppercase",
              fontWeight: 700,
              marginBottom: 12,
              paddingBottom: 6,
              borderBottom: "1px solid rgba(124,58,237,0.2)",
            }}>
              {grupo.group}
            </div>
            {grupo.itens.map(({ key, label, ph, type, dica }) => (
              <label key={key} style={{ display: "block", marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 13, color: "var(--text-pri)", fontWeight: 500 }}>{label}</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{dica}</span>
                </div>
                <Input
                  type={type}
                  value={form[key] ?? ""}
                  placeholder={ph}
                  onChange={(e) => atualizar(key, e.target.value)}
                  onFocus={(e) => {
                    // Limpa o •••• ao focar para o usuário digitar do zero
                    if (e.target.value === MASKED) atualizar(key, "");
                  }}
                />
              </label>
            ))}
          </div>
        ))}

        <div style={{ display: "flex", gap: 10, paddingTop: 8 }}>
          <Button type="submit" variant="primary" loading={salvando}>
            Salvar chaves
          </Button>
          <Button type="button" variant="ghost" loading={reiniciando} onClick={reiniciar}>
            Reiniciar backend
          </Button>
        </div>
      </form>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed",
          bottom: 28,
          right: 28,
          background: "var(--bg-card)",
          border: `1px solid ${toast.cor}`,
          borderRadius: "var(--radius-md)",
          padding: "12px 20px",
          color: toast.cor,
          fontSize: 13,
          fontWeight: 500,
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          animation: "fade-in .2s ease both",
          zIndex: 9999,
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
