// Layout principal do console Alfred — painel de instrumento, não dashboard genérico.
// Esquerda: núcleo reativo + status. Direita: terminal de comunicação.

import React from 'react'
import AlfredCore from './components/AlfredCore'
import ChatInterface from './components/ChatInterface'
import StatusPanel from './components/StatusPanel'
import { useChat } from './hooks/useChat'
import { useStatus } from './hooks/useStatus'

export default function App() {
  const { messages, coreState, isStreaming, sendMessage, clearHistory } = useChat()
  const { status, online } = useStatus(12_000)

  return (
    <div style={styles.root}>
      {/* ── Painel esquerdo: instrumento + telemetria ── */}
      <aside style={styles.sidebar}>
        {/* Cabeçalho da barra lateral */}
        <div style={styles.sidebarHeader}>
          <span style={styles.sidebarTitle} className="label-engraved">SISTEMA</span>
          <span style={styles.sidebarVersion} className="mono">v1.0</span>
        </div>

        {/* Núcleo reativo */}
        <div style={styles.coreSection}>
          <AlfredCore state={coreState} />
        </div>

        {/* Painel de status */}
        <div style={styles.statusSection}>
          <StatusPanel status={status} online={online} />
        </div>

        {/* Rodapé da sidebar */}
        <div style={styles.sidebarFooter} className="label-engraved">
          ALFRED · NEXUS · 2024
        </div>
      </aside>

      {/* ── Terminal de comunicação ── */}
      <main style={styles.main}>
        <ChatInterface
          messages={messages}
          coreState={coreState}
          isStreaming={isStreaming}
          onSend={sendMessage}
          onClear={clearHistory}
        />
      </main>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    height: '100dvh',
    display: 'flex',
    background: 'var(--void)',
    overflow: 'hidden',
  },
  sidebar: {
    width: '320px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--surface)',
    borderRight: '1px solid var(--border)',
    overflow: 'hidden',
  },
  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 20px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--surface-raised)',
    flexShrink: 0,
  },
  sidebarTitle: {
    fontSize: '10px',
    letterSpacing: '0.20em',
    color: 'var(--text-muted)',
  },
  sidebarVersion: {
    fontSize: '10px',
    color: 'var(--text-muted)',
  },
  coreSection: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    position: 'relative',
    // Textura de metal brunido — grade muito sutil
    backgroundImage: `
      repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(255,255,255,0.008) 2px,
        rgba(255,255,255,0.008) 3px
      )
    `,
  },
  statusSection: {
    padding: '16px 20px',
    borderTop: '1px solid var(--border)',
    flexShrink: 0,
  },
  sidebarFooter: {
    padding: '10px 20px',
    borderTop: '1px solid var(--border)',
    color: 'var(--text-muted)',
    fontSize: '8px',
    letterSpacing: '0.16em',
    textAlign: 'center',
    flexShrink: 0,
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    minHeight: 0,
  },
}
