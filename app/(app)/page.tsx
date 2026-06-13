'use client'

import { useStore } from '@/lib/store'
import LeftPanel from '@/components/LeftPanel'

export default function AppPage() {
  const isDrawerOpen = useStore((s) => s.isDrawerOpen)
  const isDrawerExpanded = useStore((s) => s.isDrawerExpanded)
  const setDrawerExpanded = useStore((s) => s.setDrawerExpanded)

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      background: 'var(--bg)',
    }}>
      <LeftPanel />

      <main style={{
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}>
        <p style={{
          margin: 0,
          fontSize: 14,
          color: 'var(--text-muted)',
          letterSpacing: '0.02em',
          userSelect: 'none',
          pointerEvents: 'none',
        }}>
          Pick a tree to explore
        </p>
      </main>

      {isDrawerOpen && (
        <aside
          className={isDrawerExpanded ? '' : 'glass'}
          style={isDrawerExpanded
            ? {
                position: 'fixed',
                inset: 0,
                zIndex: 100,
                background: 'var(--bg)',
                backdropFilter: 'blur(24px) saturate(180%)',
                WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                display: 'flex',
                flexDirection: 'column',
                borderLeft: '1px solid var(--panel-border)',
                borderRadius: 0,
              }
            : {
                width: 320,
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 0,
                borderLeft: '1px solid var(--panel-border)',
              }
          }
        >
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--panel-border)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}>
            <button
              onClick={() => setDrawerExpanded(!isDrawerExpanded)}
              style={{
                all: 'unset',
                cursor: 'pointer',
                fontSize: 13,
                color: 'var(--text-muted)',
                fontFamily: 'inherit',
              }}
            >
              {isDrawerExpanded ? '↙ Collapse' : '↗ Expand'}
            </button>
          </div>
        </aside>
      )}
    </div>
  )
}
