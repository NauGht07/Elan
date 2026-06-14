'use client'

import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useStore } from '@/lib/store'
import { createBrowserClient } from '@/lib/supabase-browser'
import type { ElanNode, Suggestion, NodeType } from '@/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FACTUAL_HEX = '#7B9EFF'
const PRACTICAL_HEX = '#F4B97A'

function typeHex(type: NodeType) {
  return type === 'factual' ? FACTUAL_HEX : PRACTICAL_HEX
}

function typeLabel(type: NodeType) {
  return type === 'factual' ? 'Factual' : 'Practical'
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: NodeType }) {
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

function CustomLink({ href, children }: { href?: string; children?: React.ReactNode }) {
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

// ─── NodeDrawer ───────────────────────────────────────────────────────────────

export default function NodeDrawer() {
  const activeNodeId = useStore((s) => s.activeNodeId)
  const setActiveNodeId = useStore((s) => s.setActiveNodeId)
  const isDrawerOpen = useStore((s) => s.isDrawerOpen)
  const setDrawerOpen = useStore((s) => s.setDrawerOpen)
  const isDrawerExpanded = useStore((s) => s.isDrawerExpanded)
  const setDrawerExpanded = useStore((s) => s.setDrawerExpanded)
  const selectedTreeId = useStore((s) => s.selectedTreeId)
  const bumpGraphVersion = useStore((s) => s.bumpGraphVersion)

  const [node, setNode] = useState<ElanNode | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [fetchStatus, setFetchStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [generatingId, setGeneratingId] = useState<string | null>(null)

  useEffect(() => {
    if (!activeNodeId) {
      setNode(null)
      setSuggestions([])
      return
    }

    let cancelled = false
    const supabase = createBrowserClient()
    setFetchStatus('loading')

    Promise.all([
      supabase.from('nodes').select('*').eq('id', activeNodeId).single(),
      supabase.from('suggestions').select('*').eq('node_id', activeNodeId),
    ]).then(([nodeRes, suggestionsRes]) => {
      if (cancelled) return
      if (nodeRes.error || !nodeRes.data) { setFetchStatus('error'); return }
      setNode(nodeRes.data as ElanNode)
      setSuggestions((suggestionsRes.data ?? []) as Suggestion[])
      setFetchStatus('idle')
    }).catch(() => {
      if (!cancelled) setFetchStatus('error')
    })

    return () => { cancelled = true }
  }, [activeNodeId])

  async function handleSuggestion(s: Suggestion) {
    if (generatingId || !node || !selectedTreeId) return

    if (s.spawned_node_id) {
      setActiveNodeId(s.spawned_node_id)
      return
    }

    setGeneratingId(s.id)

    try {
      const ancestor_ids = [...node.ancestor_ids, node.id]

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: s.topic,
          tree_id: selectedTreeId,
          parent_id: activeNodeId,
          ancestor_ids,
          ancestors: [],
          query: s.topic,
          type: s.type,
        }),
      })

      if (!res.ok) return
      const { node: newNode } = await res.json()

      const supabase = createBrowserClient()
      await supabase
        .from('suggestions')
        .update({ spawned_node_id: newNode.id })
        .eq('id', s.id)

      setSuggestions((prev) =>
        prev.map((sug) => sug.id === s.id ? { ...sug, spawned_node_id: newNode.id } : sug)
      )

      bumpGraphVersion()
      setActiveNodeId(newNode.id)
    } finally {
      setGeneratingId(null)
    }
  }

  if (!isDrawerOpen) return null

  const expanded = isDrawerExpanded

  const panelStyle: React.CSSProperties = expanded
    ? {
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      }
    : {
        width: 360,
        flexShrink: 0,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--panel-bg)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        borderLeft: '1px solid var(--panel-border)',
      }

  return (
    <aside style={panelStyle}>

      {/* Header */}
      <div style={{
        height: 56,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        borderBottom: '1px solid var(--panel-border)',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {node && <TypeBadge type={node.type} />}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <button
            onClick={() => setDrawerExpanded(!expanded)}
            style={{
              all: 'unset',
              cursor: 'pointer',
              fontSize: 13,
              color: 'var(--text-muted)',
              fontFamily: 'inherit',
              padding: '6px 10px',
              borderRadius: 6,
              transition: 'color 0.15s ease-out',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            {expanded ? '↙ Collapse' : '↗ Expand'}
          </button>
          <button
            onClick={() => setDrawerOpen(false)}
            style={{
              all: 'unset',
              cursor: 'pointer',
              fontSize: 20,
              lineHeight: 1,
              color: 'var(--text-muted)',
              padding: '4px 8px',
              borderRadius: 6,
              transition: 'color 0.15s ease-out',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            ×
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '28px 28px 40px',
        display: 'flex',
        flexDirection: 'column',
        gap: 28,
        maxWidth: expanded ? 760 : undefined,
        marginLeft: expanded ? 'auto' : undefined,
        marginRight: expanded ? 'auto' : undefined,
        width: expanded ? '100%' : undefined,
        boxSizing: expanded ? 'border-box' : undefined,
      }}>

        {fetchStatus === 'loading' && (
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)' }}>
            Give me a sec...
          </p>
        )}

        {fetchStatus === 'error' && (
          <p style={{ margin: 0, fontSize: 14, color: 'var(--node-practical)' }}>
            Couldn't load this node.
          </p>
        )}

        {fetchStatus === 'idle' && node && (
          <>
            {/* Title */}
            <h2 style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 600,
              color: 'var(--text)',
              lineHeight: 1.3,
            }}>
              {node.original_query || typeLabel(node.type)}
            </h2>

            {/* Content */}
            <div style={{
              fontSize: 15,
              lineHeight: 1.75,
              color: 'var(--text)',
            }}>
              <ReactMarkdown
                components={{
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  a: CustomLink as any,
                  p: ({ children }) => (
                    <p style={{ margin: '0 0 1em', lineHeight: 1.75 }}>{children}</p>
                  ),
                  h1: ({ children }) => (
                    <h1 style={{ fontSize: 19, fontWeight: 600, margin: '1.4em 0 0.5em', color: 'var(--text)' }}>{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 style={{ fontSize: 17, fontWeight: 600, margin: '1.2em 0 0.4em', color: 'var(--text)' }}>{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 style={{ fontSize: 15, fontWeight: 600, margin: '1em 0 0.3em', color: 'var(--text)' }}>{children}</h3>
                  ),
                  ul: ({ children }) => (
                    <ul style={{ margin: '0 0 1em', paddingLeft: 20 }}>{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol style={{ margin: '0 0 1em', paddingLeft: 20 }}>{children}</ol>
                  ),
                  li: ({ children }) => (
                    <li style={{ marginBottom: '0.3em' }}>{children}</li>
                  ),
                  code: ({ children, className }) => {
                    const isBlock = className?.startsWith('language-')
                    return isBlock ? (
                      <code style={{
                        display: 'block',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid var(--panel-border)',
                        borderRadius: 8,
                        padding: '12px 16px',
                        fontSize: 13,
                        fontFamily: 'monospace',
                        overflowX: 'auto',
                        margin: '0.5em 0',
                      }}>{children}</code>
                    ) : (
                      <code style={{
                        background: 'rgba(255,255,255,0.08)',
                        borderRadius: 4,
                        padding: '1px 5px',
                        fontSize: '0.9em',
                        fontFamily: 'monospace',
                      }}>{children}</code>
                    )
                  },
                }}
              >
                {node.content}
              </ReactMarkdown>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: 'var(--panel-border)', flexShrink: 0 }} />

            {/* Suggestions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <h3 style={{
                margin: 0,
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
              }}>
                Explore further
              </h3>

              {suggestions.length === 0 && (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
                  No suggestions yet.
                </p>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {suggestions.map((s) => {
                  const hex = typeHex(s.type)
                  const isGenerating = generatingId === s.id
                  const isDisabled = !!generatingId && !isGenerating

                  return (
                    <button
                      key={s.id}
                      onClick={() => handleSuggestion(s)}
                      disabled={isDisabled || isGenerating}
                      style={{
                        all: 'unset',
                        cursor: isDisabled || isGenerating ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        padding: '13px 16px',
                        borderRadius: 12,
                        background: 'var(--panel-bg)',
                        border: `1px solid ${isGenerating ? hex : 'var(--panel-border)'}`,
                        opacity: isDisabled ? 0.45 : 1,
                        transition: 'border-color 0.15s ease-out, opacity 0.15s ease-out, background 0.15s ease-out',
                        boxSizing: 'border-box',
                      }}
                      onMouseEnter={(e) => {
                        if (isDisabled || isGenerating) return
                        e.currentTarget.style.borderColor = hex
                        e.currentTarget.style.background = `${hex}0d`
                      }}
                      onMouseLeave={(e) => {
                        if (isDisabled || isGenerating) return
                        e.currentTarget.style.borderColor = 'var(--panel-border)'
                        e.currentTarget.style.background = 'var(--panel-bg)'
                      }}
                    >
                      <span style={{
                        fontSize: 14,
                        color: 'var(--text)',
                        fontFamily: 'inherit',
                        lineHeight: 1.4,
                        flex: 1,
                        minWidth: 0,
                        textAlign: 'left',
                      }}>
                        {isGenerating ? 'On it...' : s.topic}
                      </span>
                      <TypeBadge type={s.type} />
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: 'var(--panel-border)', flexShrink: 0 }} />

            {/* Annotations */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h3 style={{
                margin: 0,
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
              }}>
                Annotations
              </h3>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Coming soon
              </p>
            </div>
          </>
        )}
      </div>
    </aside>
  )
}
