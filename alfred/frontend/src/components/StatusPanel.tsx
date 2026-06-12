// Painel de status — indicadores reais lidos do backend, nunca estáticos.
// Estilo de instrumento: rótulos gravados, valores monoespaçados.

import React from 'react'
import type { AlfredStatus } from '../hooks/useStatus'

interface StatusPanelProps {
  status: AlfredStatus
  online: boolean
}

function Indicator({ label, value, highlight = false, dot = false, dotColor = '' }: {
  label: string
  value: string
  highlight?: boolean
  dot?: boolean
  dotColor?: string
}) {
  return (
    <div style={styles.indicator}>
      <span style={styles.indicatorLabel} className="label-engraved">{label}</span>
      <div style={styles.indicatorValue}>
        {dot && (
          <span style={{ ...styles.dot, background: dotColor || 'var(--text-muted)' }} />
        )}
        <span
          style={{
            ...styles.indicatorText,
            color: highlight ? 'var(--brass)' : 'var(--text-secondary)',
          }}
          className="mono"
        >
          {value}
        </span>
      </div>
    </div>
  )
}

export default function StatusPanel({ status, online }: StatusPanelProps) {
  const brainColor = status.brain === 'groq'
    ? '#5A8A5A'
    : status.brain === 'ollama'
      ? '#8A7A3A'
      : '#5A3A3A'

  const brainLabel = status.brain === 'groq'
    ? 'GROQ'
    : status.brain === 'ollama'
      ? 'OLLAMA'
      : 'OFFLINE'

  return (
    <div style={styles.panel}>
      {/* Linha separadora superior */}
      <div style={styles.divider} />

      {/* Status de conexão */}
      <div style={styles.connectionRow}>
        <span
          style={{
            ...styles.dot,
            background: online ? '#4A8A5A' : '#5A3A3A',
            boxShadow: online ? '0 0 6px rgba(74, 138, 90, 0.6)' : 'none',
          }}
        />
        <span style={{ ...styles.connectionLabel, color: online ? '#4A8A5A' : '#5A3A3A' }} className="label-engraved">
          {online ? 'ONLINE' : 'OFFLINE'}
        </span>
      </div>

      {/* Grade de indicadores */}
      <div style={styles.grid}>
        <Indicator
          label="CÉREBRO"
          value={brainLabel}
          dot
          dotColor={brainColor}
          highlight={status.brain !== 'offline'}
        />
        <Indicator
          label="QUOTA"
          value={status.quota || '—'}
        />
        <Indicator
          label="ESCOPO"
          value={status.scope_locked ? 'TRAVADO' : 'ABERTO'}
          highlight={status.scope_locked}
          dot
          dotColor={status.scope_locked ? '#8A6E28' : '#5A3A3A'}
        />
        <Indicator
          label="EVAL"
          value={status.eval || '—'}
        />
        <Indicator
          label="CHAMADAS"
          value={String(status.calls_today ?? 0)}
        />
        <Indicator
          label="LATÊNCIA"
          value={status.avg_latency_ms ? `${status.avg_latency_ms}ms` : '—'}
        />
      </div>

      {/* Última latência em destaque */}
      {status.last_latency_ms > 0 && (
        <div style={styles.lastPing}>
          <span className="label-engraved" style={{ color: 'var(--text-muted)' }}>ÚLTIMO PING</span>
          <span className="mono" style={{ color: 'var(--brass-dim)', fontSize: '11px' }}>
            {status.last_latency_ms}ms
          </span>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  divider: {
    height: '1px',
    background: 'linear-gradient(90deg, transparent, var(--border-bright) 30%, var(--border-bright) 70%, transparent)',
  },
  connectionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    justifyContent: 'center',
  },
  connectionLabel: {
    fontSize: '9px',
    letterSpacing: '0.18em',
  },
  dot: {
    display: 'inline-block',
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px 16px',
  },
  indicator: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  indicatorLabel: {
    fontSize: '8.5px',
    letterSpacing: '0.14em',
    color: 'var(--text-muted)',
  },
  indicatorValue: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
  },
  indicatorText: {
    fontSize: '11px',
    fontWeight: 500,
  },
  lastPing: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '5px 8px',
    background: 'var(--surface-raised)',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)',
  },
}
