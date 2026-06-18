// Polling do endpoint /api/status — alimenta os indicadores reais do console.

import { useState, useEffect } from 'react'

export interface AlfredStatus {
  brain: 'groq' | 'ollama' | 'offline'
  quota: string
  scope_locked: boolean
  eval: string
  calls_today: number
  avg_latency_ms: number
  last_latency_ms: number
}

const DEFAULT_STATUS: AlfredStatus = {
  brain: 'groq',
  quota: '—',
  scope_locked: true,
  eval: '—',
  calls_today: 0,
  avg_latency_ms: 0,
  last_latency_ms: 0,
}

const AUTH_TOKEN = import.meta.env.VITE_ALFRED_TOKEN || ''

function buildHeaders() {
  const h: Record<string, string> = {}
  if (AUTH_TOKEN) h['Authorization'] = `Bearer ${AUTH_TOKEN}`
  return h
}

export function useStatus(intervalMs = 10_000) {
  const [status, setStatus] = useState<AlfredStatus>(DEFAULT_STATUS)
  const [online, setOnline] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const res = await fetch('/api/status', { headers: buildHeaders() })
        if (!res.ok) throw new Error('offline')
        const data = await res.json()
        if (!cancelled) {
          setStatus(data)
          setOnline(true)
        }
      } catch {
        if (!cancelled) setOnline(false)
      }
    }

    poll()
    const id = setInterval(poll, intervalMs)
    return () => { cancelled = true; clearInterval(id) }
  }, [intervalMs])

  return { status, online }
}
