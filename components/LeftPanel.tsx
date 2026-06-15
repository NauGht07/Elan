'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useStore } from '@/lib/store'
import { createBrowserClient } from '@/lib/supabase-browser'
import type { Tree } from '@/types'

export default function LeftPanel() {
  const selectedTreeId = useStore((s) => s.selectedTreeId)
  const setSelectedTreeId = useStore((s) => s.setSelectedTreeId)
  const setActiveNodeId = useStore((s) => s.setActiveNodeId)
  const isCollapsed = useStore((s) => s.isLeftCollapsed)
  const setCollapsed = useStore((s) => s.setLeftCollapsed)
  const setIsModalOpen = useStore((s) => s.setIsModalOpen)

  const trees = useStore((s) => s.trees)
  const setTrees = useStore((s) => s.setTrees)
  const removeTree = useStore((s) => s.removeTree)
  const [loading, setLoading] = useState(true)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)

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

  useEffect(() => {
    if (!deleteTarget) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setDeleteTarget(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [deleteTarget])

  async function deleteTree(id: string) {
    try {
      const res = await fetch('/api/trees', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tree_id: id }),
      })
      if (res.ok) removeTree(id)
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <aside style={{
      width: isCollapsed ? 60 : 240,
      flexShrink: 0,
      margin: 14,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--panel-bg)',
      backdropFilter: 'blur(24px) saturate(180%)',
      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      border: '1px solid var(--panel-border)',
      borderRadius: 20,
      boxShadow: 'var(--slab-shadow), inset 0 1px 0 var(--edge-sheen)',
      overflow: 'hidden',
      transition: 'width 400ms cubic-bezier(0,0,0.2,1)',
    }}>

      {/* Top bar */}
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
            <div
              key={tree.id}
              onMouseEnter={() => setHoveredId(tree.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                height: 36,
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

              {/* Selection button — takes all remaining space, contains the label */}
              <button
                onClick={() => { setSelectedTreeId(tree.id); setActiveNodeId(null) }}
                title={tree.title}
                style={{
                  all: 'unset',
                  cursor: 'pointer',
                  flex: 1,
                  minWidth: 0,
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: 18,
                }}
              >
                <span style={{
                  fontSize: 13,
                  fontFamily: 'inherit',
                  fontWeight: isSelected ? 500 : 400,
                  color: isSelected ? 'var(--text)' : isHovered ? 'var(--text)' : 'var(--text-muted)',
                  opacity: isCollapsed ? 0 : 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  transition: 'opacity 250ms cubic-bezier(0,0,0.2,1), color 0.15s cubic-bezier(0,0,0.2,1)',
                }}>
                  {tree.title}
                </span>
              </button>

              {/* Delete button — fades in on hover, hidden when collapsed */}
              {!isCollapsed && (
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: tree.id, title: tree.title }) }}
                  style={{
                    all: 'unset',
                    cursor: 'pointer',
                    flexShrink: 0,
                    width: 36,
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                    lineHeight: 1,
                    color: 'var(--text-muted)',
                    opacity: isHovered ? 1 : 0,
                    transition: 'opacity 0.15s cubic-bezier(0,0,0.2,1), color 0.15s cubic-bezier(0,0,0.2,1)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--node-practical)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  ×
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Separator */}
      <div style={{ height: 1, flexShrink: 0, background: 'var(--panel-border)' }} />

      {/* New Tree */}
      {isCollapsed ? (
        <button
          onClick={() => setIsModalOpen(true)}
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
        <div style={{ padding: '12px 16px 16px', flexShrink: 0 }}>
          <button
            onClick={() => setIsModalOpen(true)}
            style={{
              all: 'unset',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              width: '100%',
              padding: '10px 0',
              borderRadius: 10,
              border: '1px solid var(--panel-border)',
              fontSize: 13,
              fontFamily: 'inherit',
              fontWeight: 500,
              color: 'var(--text-muted)',
              background: 'transparent',
              transition: 'color 0.15s cubic-bezier(0,0,0.2,1), border-color 0.15s cubic-bezier(0,0,0.2,1), background 0.15s cubic-bezier(0,0,0.2,1)',
              boxSizing: 'border-box',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--node-factual)'
              e.currentTarget.style.borderColor = 'var(--node-factual)'
              e.currentTarget.style.background = 'rgba(123,158,255,0.06)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-muted)'
              e.currentTarget.style.borderColor = 'var(--panel-border)'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 300, lineHeight: 1 }}>+</span>
            New Tree
          </button>
        </div>
      )}

      {/* Separator */}
      <div style={{ height: 1, flexShrink: 0, background: 'var(--panel-border)' }} />

      {/* Account */}
      {isCollapsed ? (
        <Link
          href="/account"
          title="Account"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: 48,
            flexShrink: 0,
            color: 'var(--text-muted)',
            textDecoration: 'none',
            transition: 'color 0.15s cubic-bezier(0,0,0.2,1)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--node-factual)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="7.5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M2 13c0-3 2.5-4.5 5.5-4.5S13 10 13 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </Link>
      ) : (
        <div style={{ padding: '10px 16px 14px', flexShrink: 0 }}>
          <Link
            href="/account"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 10px',
              borderRadius: 8,
              textDecoration: 'none',
              color: 'var(--text-muted)',
              fontSize: 13,
              fontFamily: 'inherit',
              fontWeight: 400,
              transition: 'color 0.15s cubic-bezier(0,0,0.2,1), background 0.15s cubic-bezier(0,0,0.2,1)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text)'
              e.currentTarget.style.background = 'var(--surface)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-muted)'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
              <circle cx="7.5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M2 13c0-3 2.5-4.5 5.5-4.5S13 10 13 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            Account
          </Link>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && createPortal(
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteTarget(null) }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            background: 'var(--scrim)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
        >
          <div
            className="glass"
            style={{
              width: '100%',
              maxWidth: 360,
              padding: 32,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>
              Delete this tree?
            </h3>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text)', lineHeight: 1.4 }}>
              {deleteTarget.title}
            </p>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              This can't be undone.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                onClick={() => setDeleteTarget(null)}
                style={{
                  all: 'unset',
                  cursor: 'pointer',
                  padding: '9px 16px',
                  borderRadius: 8,
                  border: '1px solid var(--panel-border)',
                  fontSize: 14,
                  fontFamily: 'inherit',
                  color: 'var(--text-muted)',
                  transition: 'color 0.15s ease-out',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteTree(deleteTarget.id)}
                style={{
                  all: 'unset',
                  cursor: 'pointer',
                  padding: '9px 16px',
                  borderRadius: 8,
                  background: 'rgba(244,185,122,0.12)',
                  border: '1px solid rgba(244,185,122,0.3)',
                  fontSize: 14,
                  fontFamily: 'inherit',
                  fontWeight: 600,
                  color: 'var(--node-practical)',
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </aside>
  )
}
