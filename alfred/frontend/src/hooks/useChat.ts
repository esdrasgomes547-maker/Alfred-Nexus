// Hook de chat: mantém histórico, faz streaming via SSE, gerencia estados do Alfred.

import { useState, useCallback, useRef } from 'react'

export type CoreState = 'idle' | 'listening' | 'pondering' | 'responding'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

const API_BASE = '/api'
const AUTH_TOKEN = import.meta.env.VITE_ALFRED_TOKEN || ''

function makeId() {
  return Math.random().toString(36).slice(2, 10)
}

function buildHeaders() {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (AUTH_TOKEN) headers['Authorization'] = `Bearer ${AUTH_TOKEN}`
  return headers
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [coreState, setCoreState] = useState<CoreState>('idle')
  const [isStreaming, setIsStreaming] = useState(false)
  const sessionId = useRef<string>(makeId())

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return

    const userMsg: ChatMessage = { id: makeId(), role: 'user', content: text }
    const assistantMsgId = makeId()

    setMessages(prev => [...prev, userMsg, { id: assistantMsgId, role: 'assistant', content: '', streaming: true }])
    setIsStreaming(true)
    setCoreState('listening')

    // Aguarda um frame antes de iniciar o stream para exibir "ouvindo"
    await new Promise(r => setTimeout(r, 300))
    setCoreState('pondering')

    try {
      const payload = {
        session_id: sessionId.current,
        messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
      }

      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify(payload),
      })

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`)
      }

      setCoreState('responding')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.token) {
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantMsgId
                    ? { ...m, content: m.content + data.token }
                    : m
                )
              )
            }
            if (data.done) {
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantMsgId ? { ...m, streaming: false } : m
                )
              )
            }
            if (data.error) {
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantMsgId
                    ? { ...m, content: `Erro: ${data.error}`, streaming: false }
                    : m
                )
              )
            }
          } catch {
            // linha SSE malformada — ignora
          }
        }
      }
    } catch (err) {
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantMsgId
            ? { ...m, content: 'Peço desculpas, senhor. Houve uma falha na comunicação.', streaming: false }
            : m
        )
      )
    } finally {
      setIsStreaming(false)
      setCoreState('idle')
    }
  }, [messages, isStreaming])

  const clearHistory = useCallback(() => {
    setMessages([])
    sessionId.current = makeId()
  }, [])

  return { messages, coreState, isStreaming, sendMessage, clearHistory }
}
