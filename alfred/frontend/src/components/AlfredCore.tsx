// O núcleo reativo do Alfred — medalhão de latão que respira com o estado do sistema.
// É a assinatura visual do console: instrumento de precisão, não decoração.

import React, { useMemo } from 'react'
import type { CoreState } from '../hooks/useChat'

interface AlfredCoreProps {
  state: CoreState
}

const SIZE = 280
const CX = SIZE / 2
const CY = SIZE / 2

// Gera os traços do anel externo — 48 divisões, maiores nas cardeais
function buildTicks() {
  const count = 48
  return Array.from({ length: count }, (_, i) => {
    const angle = (i * 360) / count - 90
    const rad = (angle * Math.PI) / 180
    const isCardinal = i % 12 === 0
    const isMajor = i % 6 === 0
    const outerR = 132
    const innerR = isCardinal ? 117 : isMajor ? 121 : 124

    return {
      x1: CX + outerR * Math.cos(rad),
      y1: CY + outerR * Math.sin(rad),
      x2: CX + innerR * Math.cos(rad),
      y2: CY + innerR * Math.sin(rad),
      isCardinal,
      isMajor,
    }
  })
}

// Gera os pontos do anel interno de medição — 16 divisões
function buildInnerMarks() {
  const count = 16
  return Array.from({ length: count }, (_, i) => {
    const angle = (i * 360) / count - 90
    const rad = (angle * Math.PI) / 180
    const isMajor = i % 4 === 0
    const outerR = 90
    const innerR = isMajor ? 82 : 85

    return {
      x1: CX + outerR * Math.cos(rad),
      y1: CY + outerR * Math.sin(rad),
      x2: CX + innerR * Math.cos(rad),
      y2: CY + innerR * Math.sin(rad),
      isMajor,
    }
  })
}

// Estado → parâmetros de animação
const STATE_PARAMS: Record<CoreState, {
  coreOpacity: number
  glowRadius: number
  glowOpacity: number
  coreAnim: string
  outerRingAnim: string
  innerRingAnim: string
  ripple: boolean
}> = {
  idle: {
    coreOpacity: 0.75,
    glowRadius: 52,
    glowOpacity: 0.35,
    coreAnim: 'breathe 4s ease-in-out infinite',
    outerRingAnim: 'spin-slow 120s linear infinite',
    innerRingAnim: 'spin-reverse 80s linear infinite',
    ripple: false,
  },
  listening: {
    coreOpacity: 0.90,
    glowRadius: 60,
    glowOpacity: 0.50,
    coreAnim: 'breathe 2s ease-in-out infinite',
    outerRingAnim: 'spin-slow 40s linear infinite',
    innerRingAnim: 'spin-reverse 25s linear infinite',
    ripple: false,
  },
  pondering: {
    coreOpacity: 1.00,
    glowRadius: 68,
    glowOpacity: 0.65,
    coreAnim: 'pulse-fast 0.9s ease-in-out infinite',
    outerRingAnim: 'spin-slow 18s linear infinite',
    innerRingAnim: 'spin-reverse 10s linear infinite',
    ripple: false,
  },
  responding: {
    coreOpacity: 1.00,
    glowRadius: 72,
    glowOpacity: 0.70,
    coreAnim: 'pulse-fast 1.2s ease-in-out infinite',
    outerRingAnim: 'spin-slow 25s linear infinite',
    innerRingAnim: 'spin-reverse 14s linear infinite',
    ripple: true,
  },
}

const STATE_LABELS: Record<CoreState, string> = {
  idle:      'EM REPOUSO',
  listening: 'OUVINDO',
  pondering: 'PONDERANDO',
  responding: 'RESPONDENDO',
}

export default function AlfredCore({ state }: AlfredCoreProps) {
  const ticks = useMemo(buildTicks, [])
  const innerMarks = useMemo(buildInnerMarks, [])
  const params = STATE_PARAMS[state]

  return (
    <div style={styles.wrapper}>
      {/* Rótulo de estado — gravado acima do núcleo */}
      <div style={styles.stateLabel} className="label-engraved">
        {STATE_LABELS[state]}
      </div>

      <div style={styles.svgWrapper}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          aria-label={`Alfred: ${STATE_LABELS[state]}`}
          role="img"
        >
          <defs>
            {/* Gradiente radial do núcleo — latão luminoso */}
            <radialGradient id="core-grad" cx="50%" cy="45%" r="60%">
              <stop offset="0%"   stopColor="#E8C46A" stopOpacity="1" />
              <stop offset="40%"  stopColor="#C09A3C" stopOpacity="1" />
              <stop offset="100%" stopColor="#6B4F1A" stopOpacity="1" />
            </radialGradient>

            {/* Halo difuso */}
            <radialGradient id="glow-grad" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="#C09A3C" stopOpacity={params.glowOpacity} />
              <stop offset="100%" stopColor="#C09A3C" stopOpacity="0" />
            </radialGradient>

            {/* Brilho do anel externo */}
            <filter id="ring-glow">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Brilho suave do núcleo */}
            <filter id="core-glow">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* ── Plano de fundo circular ── */}
          <circle cx={CX} cy={CY} r={134} fill="#0A0A0E" />

          {/* ── Halo de glow ── */}
          <circle
            cx={CX} cy={CY}
            r={params.glowRadius}
            fill="url(#glow-grad)"
            style={{ transition: 'r 0.6s var(--ease-out), opacity 0.6s var(--ease-out)' }}
          />

          {/* ── Anel externo com traços — gira devagar ── */}
          <g style={{ animation: params.outerRingAnim, transformOrigin: `${CX}px ${CY}px` }}>
            {ticks.map((t, i) => (
              <line
                key={i}
                x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
                stroke={t.isCardinal ? '#C09A3C' : t.isMajor ? '#8A6E28' : '#3A3428'}
                strokeWidth={t.isCardinal ? 2 : t.isMajor ? 1.5 : 1}
                strokeLinecap="round"
                filter={t.isCardinal ? 'url(#ring-glow)' : undefined}
              />
            ))}
            {/* Círculo do anel externo */}
            <circle cx={CX} cy={CY} r={133} fill="none" stroke="#2A2420" strokeWidth="1" />
          </g>

          {/* ── Segundo anel — gira no sentido contrário ── */}
          <g style={{ animation: params.outerRingAnim.replace('spin-slow', 'spin-reverse'), transformOrigin: `${CX}px ${CY}px` }}>
            <circle cx={CX} cy={CY} r={108} fill="none" stroke="#C09A3C" strokeWidth="0.5" strokeOpacity="0.3" />
            <circle cx={CX} cy={CY} r={106} fill="none" stroke="#6B4F1A" strokeWidth="0.5" strokeOpacity="0.2" />
          </g>

          {/* ── Anel interno de medição ── */}
          <g style={{ animation: params.innerRingAnim, transformOrigin: `${CX}px ${CY}px` }}>
            {innerMarks.map((m, i) => (
              <line
                key={i}
                x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2}
                stroke={m.isMajor ? '#8A6E28' : '#3A3020'}
                strokeWidth={m.isMajor ? 1.5 : 1}
                strokeLinecap="round"
              />
            ))}
            <circle cx={CX} cy={CY} r={91} fill="none" stroke="#4A3A18" strokeWidth="1" strokeOpacity="0.6" />
          </g>

          {/* ── Núcleo principal — respira ── */}
          <g
            style={{
              animation: params.coreAnim,
              transformOrigin: `${CX}px ${CY}px`,
            }}
            filter="url(#core-glow)"
          >
            <circle cx={CX} cy={CY} r={68} fill="url(#core-grad)" opacity={params.coreOpacity} />

            {/* Reflexo no núcleo — superfície de metal brunido */}
            <ellipse
              cx={CX} cy={CY - 18}
              rx={28} ry={16}
              fill="white"
              opacity={0.07}
            />

            {/* Anel de acabamento do núcleo */}
            <circle cx={CX} cy={CY} r={68} fill="none" stroke="#E8C46A" strokeWidth="1" strokeOpacity="0.4" />
            <circle cx={CX} cy={CY} r={66} fill="none" stroke="#6B4F1A" strokeWidth="1" strokeOpacity="0.3" />
          </g>

          {/* ── Orbe central ── */}
          <circle cx={CX} cy={CY} r={8} fill="#F0D080" opacity={0.9} filter="url(#core-glow)" />
          <circle cx={CX} cy={CY} r={4} fill="#FFFBE8" opacity={0.95} />

          {/* ── Ripple de transmissão — só no estado responding ── */}
          {params.ripple && (
            <>
              <circle
                cx={CX} cy={CY} r={72}
                fill="none" stroke="#C09A3C" strokeWidth="1.5"
                style={{ animation: 'ripple-out 2s ease-out infinite' }}
                strokeOpacity={0.6}
              />
              <circle
                cx={CX} cy={CY} r={72}
                fill="none" stroke="#C09A3C" strokeWidth="1"
                style={{ animation: 'ripple-out 2s ease-out 0.7s infinite' }}
                strokeOpacity={0.4}
              />
            </>
          )}

          {/* ── Borda externa chanfrada ── */}
          <circle cx={CX} cy={CY} r={135} fill="none" stroke="#C09A3C" strokeWidth="0.5" strokeOpacity="0.2" />
          <circle cx={CX} cy={CY} r={137} fill="none" stroke="#2A2420" strokeWidth="2" />
        </svg>
      </div>

      {/* Rótulo de identidade */}
      <div style={styles.identity}>
        <span style={styles.identityName}>ALFRED</span>
        <span style={styles.identitySub} className="label-engraved">SISTEMA ATIVO</span>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  stateLabel: {
    letterSpacing: '0.22em',
    fontSize: '9px',
    color: 'var(--brass-dim)',
    transition: 'color 0.4s ease',
  },
  svgWrapper: {
    position: 'relative',
    filter: 'drop-shadow(0 0 24px rgba(192, 154, 60, 0.15))',
  },
  identity: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  identityName: {
    fontFamily: 'var(--font-display)',
    fontSize: '22px',
    fontWeight: 600,
    letterSpacing: '0.35em',
    color: 'var(--brass)',
    textShadow: '0 0 20px rgba(192, 154, 60, 0.4)',
  },
  identitySub: {
    fontSize: '9px',
    letterSpacing: '0.20em',
  },
}
