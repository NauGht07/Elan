import type { NodeType } from '@/types'

export const FACTUAL_HEX = '#7B9EFF'
export const PRACTICAL_HEX = '#F4B97A'

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
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        color: 'var(--node-factual)',
        textDecoration: 'none',
        borderBottom: '1px solid rgba(123,158,255,0.35)',
        transition: 'border-color 0.15s ease-out',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderBottomColor = 'var(--node-factual)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderBottomColor = 'rgba(123,158,255,0.35)')}
    >
      {children}
    </a>
  )
}
