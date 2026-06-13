'use client'

import { useEffect, useState } from 'react'
import { useStore } from '@/lib/store'
import { createBrowserClient } from '@/lib/supabase-browser'
import type { Tree } from '@/types'

export default function LeftPanel() {
  const selectedTreeId = useStore((s) => s.selectedTreeId)
  const setSelectedTreeId = useStore((s) => s.setSelectedTreeId)
  const isCollapsed = useStore((s) => s.isLeftCollapsed)
  const setCollapsed = useStore((s) => s.setLeftCollapsed)

  const [trees, setTrees] = useState<Tree[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createBrowserClient()
    supabase
      .from('trees')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setTrees(data as Tree[])
        setLoading(false)
      })
  }, [])

  return (
    <aside style={{
      width: isCollapsed ? 60 : 240,
      flexShrink: 0,
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--panel-bg)',
      backdropFilter: 'blur(24px) saturate(180%)',
      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      borderRight: '1px solid var(--panel-border)',
      overflow: 'hidden',
      transition: 'width 400ms cubic-bezier(0,0,0.2,1)',
    }}>

      {/* Top bar — always rendered, contents fade */}
      <div style={{
        height: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px 0 24px',
        flexShrink: 0,
        position: 'relative',
      }}>
        <span style={{
          fontSize: 18,
          fontWeight: 300,
          letterSpacing: '0.14em',
          color: 'var(--node-factual)',
          userSelect: 'none',
          opacity: isCollapsed ? 0 : 1,
          transition: 'opacity 250ms cubic-bezier(0,0,0.2,1)',
          pointerEvents: isCollapsed ? 'none' : 'auto',
        }}>
          elan
        </span>
        <button
          onClick={() => setCollapsed(!isCollapsed)}
          style={{
            all: 'unset',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            fontSize: 18,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: isCollapsed ? '100%' : 28,
            height: isCollapsed ? 60 : 28,
            position: isCollapsed ? 'absolute' : 'relative',
            inset: isCollapsed ? 0 : 'auto',
            flexShrink: 0,
            transition: 'color 0.15s cubic-bezier(0,0,0.2,1)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          {isCollapsed ? '›' : '‹'}
        </button>
      </div>

      {/* Separator */}
      <div style={{ height: 1, flexShrink: 0, background: 'var(--panel-border)' }} />

      {/* Tree list */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px 0' }}>
        {loading && !isCollapsed && (
          <p style={{ margin: 0, padding: '6px 24px', fontSize: 13, color: 'var(--text-muted)' }}>
            Give me a sec...
          </p>
        )}

        {!loading && trees.length === 0 && !isCollapsed && (
          <p style={{ margin: 0, padding: '6px 24px', fontSize: 13, color: 'var(--text-muted)' }}>
            No trees yet.
          </p>
        )}

        {trees.map((tree) => {
          const isSelected = tree.id === selectedTreeId
          const isHovered = tree.id === hoveredId

          return (
            <button
              key={tree.id}
              onClick={() => setSelectedTreeId(tree.id)}
              onMouseEnter={() => setHoveredId(tree.id)}
              onMouseLeave={() => setHoveredId(null)}
              title={tree.title}
              style={{
                all: 'unset',
                cursor: 'pointer',
                position: 'relative',
                display: 'block',
                width: '100%',
                height: 36,
                boxSizing: 'border-box',
                flexShrink: 0,
                borderLeft: `3px solid ${isSelected && !isCollapsed ? 'var(--node-factual)' : 'transparent'}`,
                transition: 'border-color 0.2s cubic-bezier(0,0,0.2,1)',
              }}
            >
              {/* Dot — fades in when collapsed */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: isSelected ? 'var(--node-factual)' : 'var(--text-muted)',
                opacity: isCollapsed ? (isSelected ? 1 : 0.5) : 0,
                transition: 'opacity 250ms cubic-bezier(0,0,0.2,1), background 0.15s cubic-bezier(0,0,0.2,1)',
                pointerEvents: 'none',
              }} />

              {/* Text — fades out when collapsed */}
              <span style={{
                position: 'absolute',
                top: '50%',
                left: 21,
                right: 16,
                transform: 'translateY(-50%)',
                fontSize: 13,
                fontFamily: 'inherit',
                fontWeight: isSelected ? 500 : 400,
                color: isSelected ? 'var(--text)' : isHovered ? 'var(--text)' : 'var(--text-muted)',
                opacity: isCollapsed ? 0 : 1,
                transition: 'opacity 250ms cubic-bezier(0,0,0.2,1), color 0.15s cubic-bezier(0,0,0.2,1)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                pointerEvents: 'none',
              }}>
                {tree.title}
              </span>
            </button>
          )
        })}
      </div>

      {/* Separator */}
      <div style={{ height: 1, flexShrink: 0, background: 'var(--panel-border)' }} />

      {/* New Tree */}
      {isCollapsed ? (
        <button
          onClick={() => {}}
          title="New Tree"
          style={{
            all: 'unset',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: 56,
            flexShrink: 0,
            color: 'var(--text-muted)',
            fontSize: 22,
            fontWeight: 300,
            lineHeight: 1,
            transition: 'color 0.15s cubic-bezier(0,0,0.2,1)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--node-factual)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          +
        </button>
      ) : (
        <div style={{ padding: '14px 24px 24px', flexShrink: 0 }}>
          <button
            onClick={() => {}}
            style={{
              all: 'unset',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              fontFamily: 'inherit',
              color: 'var(--text-muted)',
              transition: 'color 0.15s cubic-bezier(0,0,0.2,1)',
              lineHeight: 1,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--node-factual)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <span style={{ fontSize: 18, fontWeight: 300 }}>+</span>
            New Tree
          </button>
        </div>
      )}
    </aside>
  )
}
