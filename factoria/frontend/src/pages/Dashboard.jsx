// Dashboard — visão geral de todos os agentes com status em tempo real
import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Card       from "../components/Card";
import StatusDot  from "../components/StatusDot";
import Badge      from "../components/Badge";
import Button     from "../components/Button";
import { useApi } from "../hooks/useApi";

function msgsHoje(logs) {
  if (!Array.isArray(logs)) return 0;
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  return logs.filter((l) => new Date(l.createdAt) >= hoje).length;
}

function sessionVariant(status) {
  if (!status || status === "STOPPED") return "default";
  if (status === "WORKING") return "ok";
  if (status === "SCAN_QR_CODE") return "warn";
  return "info";
}

function containerDot(s) {
  if (s === "running") return "running";
  if (s === "ausente") return "offline";
  return "stopped";
}

export default function Dashboard() {
  const [agentes, setAgentes]     = useState([]);
  const [statuses, setStatuses]   = useState({});
  const navigate  = useNavigate();
  const { call }  = useApi();

  const carregar = useCallback(async () => {
    const lista = await call("/api/bots");
    if (!lista) return;
    setAgentes(lista);

    // Busca status de cada agente em paralelo
    const st = {};
    await Promise.allSettled(
      lista.map(async (bot) => {
        const [statusData, logsData] = await Promise.all([
          call(`/api/bots/${bot.id}/status`).catch(() => null),
          call(`/api/bots/${bot.id}/logs?limit=200`).catch(() => []),
        ]);
        st[bot.id] = {
          container: statusData?.container || "ausente",
          session:   statusData?.session?.status || "STOPPED",
          msgsHoje:  msgsHoje(logsData),
        };
      })
    );
    setStatuses(st);
  }, [call]);

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 12_000);
    return () => clearInterval(t);
  }, [carregar]);

  return (
    <div className="fade-in" style={{ padding: "36px 32px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 2, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase" }}>
            Plataforma
          </div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: -0.5 }}>
            Agentes
          </h1>
        </div>
        <Button variant="primary" onClick={() => navigate("/novo")}>
          + Novo agente
        </Button>
      </div>

      {/* Sem agentes */}
      {agentes.length === 0 && (
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 320,
          color: "var(--text-muted)",
          gap: 12,
        }}>
          <div style={{ fontSize: 48 }}>◈</div>
          <div style={{ fontSize: 15, color: "var(--text-sec)" }}>Nenhum agente ainda</div>
          <Button variant="primary" onClick={() => navigate("/novo")}>Criar o primeiro agente</Button>
        </div>
      )}

      {/* Grid de cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        gap: 14,
      }}>
        {agentes.map((bot) => {
          const st = statuses[bot.id] || {};
          const sessLabel = st.session === "WORKING"
            ? "Conectado"
            : st.session === "SCAN_QR_CODE"
            ? "Aguardando QR"
            : st.session || "—";

          return (
            <Card
              key={bot.id}
              glow
              onClick={() => navigate(`/bot/${bot.id}`)}
              style={{ cursor: "pointer" }}
              className="fade-in"
            >
              {/* Top bar */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <StatusDot status={containerDot(st.container)} size={9} />
                  <span style={{ fontWeight: 600, fontSize: 15, color: "var(--text-pri)" }}>
                    {bot.name}
                  </span>
                </div>
                <Badge
                  label={bot.active ? "Ativo" : "Pausado"}
                  variant={bot.active ? "ok" : "default"}
                />
              </div>

              {/* Linha de status */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                <Badge label={sessLabel} variant={sessionVariant(st.session)} />
                <Badge label={`Porta ${bot.wahaPort}`} />
              </div>

              {/* Métricas */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                background: "var(--bg-surface)",
                borderRadius: "var(--radius-sm)",
                padding: "10px 12px",
                marginBottom: 14,
              }}>
                <div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2, textTransform: "uppercase", letterSpacing: 0.8 }}>Msgs hoje</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-pri)" }}>{st.msgsHoje ?? "—"}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2, textTransform: "uppercase", letterSpacing: 0.8 }}>Container</div>
                  <div style={{ fontSize: 13, color: st.container === "running" ? "var(--green)" : "var(--text-sec)" }}>
                    {st.container || "—"}
                  </div>
                </div>
              </div>

              {/* Comandos */}
              <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", gap: 12 }}>
                <span>⏻ <code style={{ color: "var(--text-sec)" }}>{bot.cmdOn}</code></span>
                <span>⏼ <code style={{ color: "var(--text-sec)" }}>{bot.cmdOff}</code></span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
