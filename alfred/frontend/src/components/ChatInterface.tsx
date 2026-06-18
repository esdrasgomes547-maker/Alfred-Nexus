// Interface de chat — terminal de comunicação com Alfred.
// Sem bolhas genéricas: mensagens lidas como registro de um instrumento de precisão.

import React, { useEffect, useRef, useState, KeyboardEvent } from 'react'
import type { ChatMessage, CoreState } from '../hooks/useChat'

interface ChatInterfaceProps {
  messages: ChatMessage[]
  coreState: CoreState
  isStreaming: boolean
  onSend: (text: string) => void
  onClear: () => void
}

const GREETING = 'Boa noite, senhor. Alfred ao seu inteiro dispor. Tudo nos conformes por aqui — em que posso servi-lo?'

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isAlfred = msg.role === 'assistant'

  return (
    <div style={{ ...styles.msgWrapper, justifyContent: isAlfred ? 'flex-start' : 'flex-end' }}>
      {isAlfred && (
        <div style={styles.alfredBadge} aria-hidden="true">◆</div>
      )}
      <div
        style={{
          ...styles.msgBubble,
          ...(isAlfred ? styles.msgAlfred : styles.msgUser),
          maxWidth: isAlfred ? '85%' : '75%',
        }}
      >
        {isAlfred && (
          <div style={styles.msgSender} className="label-engraved">ALFRED</div>
        )}
        <div style={styles.msgContent}>
          {msg.content}
          {msg.streaming && <span style={styles.cursor} aria-hidden="true" />}
        </div>
      </div>
    </div>
  )
}

export default function ChatInterface({
  messages,
  coreState,
  isStreaming,
  onSend,
  onClear,
}: ChatInterfaceProps) {
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Rola para a última mensagem automaticamente
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  function submit() {
    const text = input.trim()
    if (!text || isStreaming) return
    setInput('')
    onSend(text)
  }

  const stateLabel: Record<typeof coreState, string> = {
    idle:       'Aguardando transmissão...',
    listening:  'Ouvindo o senhor...',
    pondering:  'Ponderando...',
    responding: 'Transmitindo resposta...',
  }

  return (
    <div style={styles.container}>
      {/* Cabeçalho do terminal */}
      <div style={styles.terminalHeader}>
        <div style={styles.terminalTitle} className="label-engraved">TERMINAL DE COMUNICAÇÃO</div>
        <button
          style={styles.clearBtn}
          onClick={onClear}
          title="Limpar histórico"
          aria-label="Limpar histórico de conversa"
        >
          ↺ LIMPAR
        </button>
      </div>

      {/* Área de mensagens */}
      <div style={styles.messagesArea} ref={scrollRef}>
        {messages.length === 0 ? (
          <div style={styles.greeting}>
            <div style={styles.greetingBadge} aria-hidden="true">◆</div>
            <div style={styles.greetingBody}>
              <div style={styles.msgSender} className="label-engraved">ALFRED</div>
              <div style={styles.greetingText}>{GREETING}</div>
            </div>
          </div>
        ) : (
          messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)
        )}
      </div>

      {/* Separador e área de entrada */}
      <div style={styles.inputSection}>
        <div style={styles.inputDivider} />

        {/* Rótulo de estado do sistema */}
        <div style={styles.stateRow}>
          <span
            style={{
              ...styles.stateDot,
              background: isStreaming ? 'var(--brass)' : 'var(--text-muted)',
              boxShadow: isStreaming ? '0 0 8px rgba(192,154,60,0.7)' : 'none',
            }}
          />
          <span style={styles.stateText} className="label-engraved mono">
            {stateLabel[coreState]}
          </span>
        </div>

        {/* Campo de transmissão */}
        <div style={styles.inputWrapper}>
          <div style={styles.inputLabel} className="label-engraved">TRANSMISSÃO</div>
          <textarea
            ref={inputRef}
            style={{
              ...styles.textarea,
              opacity: isStreaming ? 0.5 : 1,
            }}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            placeholder="Digite sua mensagem... (Enter envia, Shift+Enter quebra linha)"
            rows={3}
            aria-label="Campo de mensagem"
          />
          <button
            style={{
              ...styles.sendBtn,
              opacity: isStreaming || !input.trim() ? 0.4 : 1,
              cursor: isStreaming || !input.trim() ? 'not-allowed' : 'pointer',
            }}
            onClick={submit}
            disabled={isStreaming || !input.trim()}
            aria-label="Enviar mensagem"
          >
            <span style={styles.sendIcon}>▶</span>
            <span className="label-engraved" style={{ fontSize: '9px', letterSpacing: '0.12em' }}>
              {isStreaming ? 'AGUARDE' : 'ENVIAR'}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    background: 'var(--surface)',
    borderLeft: '1px solid var(--border)',
  },
  terminalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 20px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--surface-raised)',
    flexShrink: 0,
  },
  terminalTitle: {
    fontSize: '10px',
    letterSpacing: '0.18em',
    color: 'var(--text-muted)',
  },
  clearBtn: {
    background: 'none',
    border: '1px solid var(--border)',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
    fontSize: '9px',
    letterSpacing: '0.12em',
    padding: '4px 10px',
    cursor: 'pointer',
    borderRadius: 'var(--radius-sm)',
    transition: 'border-color 0.2s, color 0.2s',
  },
  messagesArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    minHeight: 0,
  },
  greeting: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    animation: 'fade-in-up 0.5s var(--ease-out)',
  },
  greetingBadge: {
    color: 'var(--brass)',
    fontSize: '12px',
    marginTop: '18px',
    flexShrink: 0,
  },
  greetingBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '16px 18px',
    background: 'var(--surface-raised)',
    borderLeft: '2px solid var(--brass-dim)',
    borderRadius: '0 var(--radius-md) var(--radius-md) 0',
  },
  greetingText: {
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-body)',
    fontSize: '14px',
    lineHeight: 1.65,
    fontStyle: 'italic',
  },
  msgWrapper: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    animation: 'fade-in-up 0.3s var(--ease-out)',
  },
  alfredBadge: {
    color: 'var(--brass)',
    fontSize: '10px',
    marginTop: '20px',
    flexShrink: 0,
  },
  msgBubble: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    padding: '12px 16px',
    borderRadius: 'var(--radius-md)',
  },
  msgAlfred: {
    background: 'var(--surface-raised)',
    borderLeft: '2px solid var(--brass-dim)',
    borderRadius: '0 var(--radius-md) var(--radius-md) 0',
  },
  msgUser: {
    background: 'var(--surface-high)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md) 0 var(--radius-md) var(--radius-md)',
    alignItems: 'flex-end',
  },
  msgSender: {
    fontSize: '8.5px',
    letterSpacing: '0.16em',
    color: 'var(--brass-dim)',
  },
  msgContent: {
    color: 'var(--text-primary)',
    fontSize: '14px',
    lineHeight: 1.65,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  cursor: {
    display: 'inline-block',
    width: '8px',
    height: '14px',
    background: 'var(--brass)',
    marginLeft: '2px',
    verticalAlign: 'text-bottom',
    borderRadius: '1px',
    animation: 'cursor-blink 1s step-end infinite',
  },
  inputSection: {
    flexShrink: 0,
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    background: 'var(--surface-raised)',
  },
  inputDivider: {
    height: '1px',
    background: 'linear-gradient(90deg, transparent, var(--border-bright) 20%, var(--border-bright) 80%, transparent)',
  },
  stateRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  stateDot: {
    display: 'inline-block',
    width: '5px',
    height: '5px',
    borderRadius: '50%',
    transition: 'background 0.3s, box-shadow 0.3s',
  },
  stateText: {
    fontSize: '9px',
    letterSpacing: '0.14em',
    color: 'var(--text-muted)',
  },
  inputWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    position: 'relative',
  },
  inputLabel: {
    fontSize: '8.5px',
    letterSpacing: '0.18em',
    color: 'var(--text-muted)',
  },
  textarea: {
    width: '100%',
    padding: '10px 14px',
    background: 'var(--void)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-body)',
    fontSize: '14px',
    lineHeight: 1.6,
    resize: 'none',
    outline: 'none',
    transition: 'border-color 0.2s, opacity 0.2s',
    caretColor: 'var(--brass)',
  },
  sendBtn: {
    alignSelf: 'flex-end',
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    padding: '8px 18px',
    background: 'var(--surface-high)',
    border: '1px solid var(--brass-muted)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--brass)',
    fontFamily: 'var(--font-display)',
    fontWeight: 500,
    transition: 'background 0.2s, border-color 0.2s, opacity 0.2s',
  },
  sendIcon: {
    fontSize: '11px',
  },
}
