import type { NodeType } from '@/types'

export const FACTUAL_HEX = '#009DDC'
export const PRACTICAL_HEX = '#F5821F'

export function typeHex(type: NodeType): string {
  return type === 'factual' ? FACTUAL_HEX : PRACTICAL_HEX
}

export function typeLabel(type: NodeType): string {
  return type === 'factual' ? 'Factual' : 'Practical'
}

export function TypeBadge({ type }: { type: NodeType }) {
  const hex = typeHex(type)
  return (
    <span style={{
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: hex,
      background: `${hex}1a`,
      border: `1px solid ${hex}40`,
      borderRadius: 6,
      padding: '3px 8px',
      lineHeight: 1,
      flexShrink: 0,
    }}>
      {typeLabel(type)}
    </span>
  )
}

export function CustomLink({ href, children }: { href?: string; children?: React.ReactNode }) {
  const text = typeof children === 'string' ? children : null
  const isCitation = text !== null && /^\[\d+\]$/.test(text)

  const anchor = (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        color: 'var(--node-factual)',
        textDecoration: 'none',
        fontWeight: isCitation ? 600 : undefined,
        borderBottom: isCitation ? 'none' : '1px solid rgba(76,217,100,0.35)',
        transition: 'border-color 0.15s ease-out',
      }}
      onMouseEnter={(e) => { if (!isCitation) e.currentTarget.style.borderBottomColor = 'var(--node-factual)' }}
      onMouseLeave={(e) => { if (!isCitation) e.currentTarget.style.borderBottomColor = 'rgba(76,217,100,0.35)' }}
    >
      {isCitation ? text.slice(1, -1) : children}
    </a>
  )

  return isCitation ? <sup>{anchor}</sup> : anchor
}
