'use client'

import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import EmojiPicker, { EmojiStyle, Theme } from 'emoji-picker-react'
import { useStore } from '@/lib/store'
import { createBrowserClient } from '@/lib/supabase-browser'
import { typeHex, typeLabel, TypeBadge, CustomLink } from '@/lib/nodeUtils'
import ChatPanel from '@/components/ChatPanel'
import NodeAnnotation from '@/components/NodeAnnotation'
import CitationHoverCard from '@/components/CitationHoverCard'
import type { ElanNode, Suggestion, NodeType, NodeChat, Interpretation, AncestorContext } from '@/types'

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
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<NodeChat[]>([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [ancestorChain, setAncestorChain] = useState<AncestorContext[]>([])
  const [customInput, setCustomInput] = useState('')
  const [customStatus, setCustomStatus] = useState<'idle' | 'loading' | 'disambiguating' | 'error'>('idle')
  const [interpretations, setInterpretations] = useState<Interpretation[]>([])
  const [emojiRows, setEmojiRows] = useState<{ id: string; text: string }[]>([])
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number } | null>(null)
  const emojiBtnRef = useRef<HTMLButtonElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  function addChatMessage(msg: Pick<NodeChat, 'role' | 'message'>) {
    setChatMessages((prev) => [...prev, {
      id: crypto.randomUUID(),
      node_id: activeNodeId!,
      created_at: new Date().toISOString(),
      ...msg,
    }])
  }

  async function addEmoji(emoji: string) {
    if (!activeNodeId || emojiRows.length >= 3) return // enforce max 3 on insert
    setShowEmojiPicker(false)
    const supabase = createBrowserClient()
    const { data, error } = await supabase
      .from('annotations')
      .insert({ node_id: activeNodeId, anchor_type: 'emoji', anchor_start: null, anchor_end: null, text: emoji })
      .select('id')
      .single()
    if (error || !data) return
    setEmojiRows((prev) => [...prev, { id: (data as { id: string }).id, text: emoji }])
    bumpGraphVersion()
  }

  async function removeEmoji(rowId: string) {
    const supabase = createBrowserClient()
    const { error } = await supabase.from('annotations').delete().eq('id', rowId)
    if (error) return
    setEmojiRows((prev) => prev.filter((r) => r.id !== rowId))
    bumpGraphVersion()
  }

  function toggleEmojiPicker() {
    if (showEmojiPicker) { setShowEmojiPicker(false); return }
    const rect = emojiBtnRef.current?.getBoundingClientRect()
    if (rect) {
      const PICKER_W = 340
      const left = Math.min(Math.max(8, rect.right - PICKER_W), window.innerWidth - PICKER_W - 8)
      setPickerPos({ top: rect.bottom + 8, left })
    }
    setShowEmojiPicker(true)
  }

  useEffect(() => {
    if (!activeNodeId) {
      setNode(null)
      setSuggestions([])
      setChatMessages([])
      setAncestorChain([])
      setEmojiRows([])
      setShowEmojiPicker(false)
      return
    }

    let cancelled = false
    const supabase = createBrowserClient()
    setFetchStatus('loading')
    setChatMessages([])
    setShowEmojiPicker(false)

    Promise.all([
      supabase.from('nodes').select('*').eq('id', activeNodeId).single(),
      supabase.from('suggestions').select('*').eq('node_id', activeNodeId),
      supabase.from('node_chats').select('*').eq('node_id', activeNodeId).order('created_at', { ascending: true }),
      supabase.from('annotations').select('id, text').eq('node_id', activeNodeId).eq('anchor_type', 'emoji').order('created_at', { ascending: true }),
    ]).then(async ([nodeRes, suggestionsRes, chatRes, emojiRes]) => {
      if (cancelled) return
      if (nodeRes.error || !nodeRes.data) { setFetchStatus('error'); return }
      const fetchedNode = nodeRes.data as ElanNode

      let chain: AncestorContext[] = []
      if (fetchedNode.ancestor_ids.length > 0) {
        const { data: ancestorNodes } = await supabase
          .from('nodes')
          .select('original_query, type, content')
          .in('id', fetchedNode.ancestor_ids)
          .order('depth', { ascending: true })
        chain = (ancestorNodes ?? []).map((a) => ({
          topic: a.original_query as string,
          type: a.type as NodeType,
          content: a.content as string,
        }))
      }

      if (cancelled) return
      setNode(fetchedNode)
      setAncestorChain(chain)
      setSuggestions((suggestionsRes.data ?? []) as Suggestion[])
      setChatMessages((chatRes.data ?? []) as NodeChat[])
      setEmojiRows((emojiRes.data ?? []) as { id: string; text: string }[])
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
      const ancestors: AncestorContext[] = [
        ...ancestorChain,
        { topic: node.original_query, type: node.type, content: node.content },
      ]

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: s.topic,
          tree_id: selectedTreeId,
          parent_id: activeNodeId,
          ancestor_ids,
          ancestors,
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

  async function handleCustomSubmit() {
    const trimmed = customInput.trim()
    if (!trimmed || !node || customStatus === 'loading') return
    setCustomStatus('loading')
    const ancestors: AncestorContext[] = [
      ...ancestorChain,
      { topic: node.original_query, type: node.type, content: node.content },
    ]
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: trimmed,
          ancestor_ids: [...node.ancestor_ids, node.id],
          ancestors,
        }),
      })
      if (!res.ok) { setCustomStatus('error'); return }
      const data = await res.json()
      const interps: Interpretation[] = data.interpretations ?? []
      if (interps.length === 0) { setCustomStatus('error'); return }
      if (interps.length === 1) {
        await handleCustomPick(interps[0])
      } else {
        setInterpretations(interps)
        setCustomStatus('disambiguating')
      }
    } catch {
      setCustomStatus('error')
    }
  }

  async function handleCustomPick(interp: Interpretation) {
    if (!node || !selectedTreeId) return
    setCustomStatus('loading')
    try {
      const ancestor_ids = [...node.ancestor_ids, node.id]
      const ancestors: AncestorContext[] = [
        ...ancestorChain,
        { topic: node.original_query, type: node.type, content: node.content },
      ]
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: customInput.trim(),
          tree_id: selectedTreeId,
          parent_id: node.id,
          ancestor_ids,
          ancestors,
          query: interp.query,
          type: interp.type,
        }),
      })
      if (!res.ok) { setCustomStatus('error'); return }
      const { node: newNode } = await res.json()
      bumpGraphVersion()
      setActiveNodeId(newNode.id)
      setCustomInput('')
      setCustomStatus('idle')
    } catch {
      setCustomStatus('error')
    }
  }

  async function handleDelete() {
    if (!node || isDeleting) return
    setIsDeleting(true)
    try {
      const res = await fetch('/api/nodes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ node_id: node.id }),
      })
      if (!res.ok) return
      setDrawerOpen(false)
      setActiveNodeId(null)
      bumpGraphVersion()
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  if (!isDrawerOpen) return null

  const expanded = isDrawerExpanded
  const showChat = expanded || isChatOpen

  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    top: expanded ? 0 : 14,
    right: expanded ? 0 : 14,
    bottom: expanded ? 0 : 14,
    zIndex: 100,
    width: expanded ? '100vw' : (isChatOpen ? 720 : 360),
    transition: 'width 400ms cubic-bezier(0,0,0.2,1)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    ...(expanded ? {
      background: 'var(--panel-bg)',
      backdropFilter: 'blur(24px) saturate(180%)',
      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      borderRadius: 0,
    } : {
      boxShadow: 'var(--slab-shadow), inset 0 0 22px var(--glass-inset-shadow)',
    }),
  }

  return (
    <aside className={expanded ? undefined : 'gradient-border glass-card'} style={panelStyle}>
      {!expanded && <div aria-hidden className="glass-card-corner-tl" />}
      {!expanded && <div aria-hidden className="glass-card-corner-br" />}
      {!expanded && <div aria-hidden className="glass-card-bevel" />}

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
        {showDeleteConfirm ? (
          <>
            <span style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>
              Delete this node?
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  all: 'unset',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  color: 'var(--text-muted)',
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--panel-border)',
                  transition: 'color 0.15s ease-out',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                style={{
                  all: 'unset',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  fontWeight: 600,
                  color: 'var(--node-practical)',
                  padding: '6px 12px',
                  borderRadius: 6,
                  background: 'rgba(255,45,85,0.10)',
                  border: '1px solid rgba(255,45,85,0.28)',
                  opacity: isDeleting ? 0.6 : 1,
                  transition: 'opacity 0.15s ease-out',
                }}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              {node && <TypeBadge type={node.type} />}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              {/* Chat toggle — hidden in fullscreen */}
              {!expanded && node && (
                <button
                  onClick={() => setIsChatOpen((v) => !v)}
                  title="Chat about this node"
                  style={{
                    all: 'unset',
                    cursor: 'pointer',
                    padding: '6px 7px',
                    borderRadius: 6,
                    color: isChatOpen ? typeHex(node.type) : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'color 0.15s ease-out',
                  }}
                  onMouseEnter={(e) => {
                    if (!isChatOpen) e.currentTarget.style.color = 'var(--text)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = isChatOpen ? typeHex(node.type) : 'var(--text-muted)'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </button>
              )}

              {/* Delete — hidden for root nodes */}
              {node && node.depth > 0 && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  title="Delete node"
                  style={{
                    all: 'unset',
                    cursor: 'pointer',
                    padding: '6px 7px',
                    borderRadius: 6,
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'color 0.15s ease-out',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--node-practical)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14H6L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                    <path d="M9 6V4h6v2"/>
                  </svg>
                </button>
              )}

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
                {expanded ? '→ Collapse' : '← Expand'}
              </button>
              <button
                onClick={() => { setDrawerOpen(false); setActiveNodeId(null) }}
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
          </>
        )}
      </div>

      {/* Body — flex row: content + optional chat column */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Content column */}
        <div ref={contentRef} style={{
          flex: 1,
          minWidth: 0,
          overflowY: 'auto',
          padding: '28px 28px 40px',
          display: 'flex',
          flexDirection: 'column',
          gap: 28,
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
              {/* Title + emoji stickers */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <h2 style={{
                  margin: 0,
                  flex: 1,
                  minWidth: 0,
                  fontSize: 22,
                  fontWeight: 600,
                  color: 'var(--text)',
                  lineHeight: 1.3,
                }}>
                  {node.original_query || typeLabel(node.type)}
                </h2>

                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, paddingTop: 2 }}>
                  {emojiRows.map((row) => (
                    <span
                      key={row.id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 1,
                        fontSize: 18,
                        lineHeight: 1,
                        padding: '2px 2px 2px 4px',
                        borderRadius: 8,
                        background: 'var(--panel-border)',
                      }}
                    >
                      {row.text}
                      <button
                        onClick={() => removeEmoji(row.id)}
                        title="Remove emoji"
                        style={{
                          all: 'unset',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 14,
                          height: 14,
                          borderRadius: '50%',
                          color: 'var(--text-muted)',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--node-practical)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                      >
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                          <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}

                  <button
                    ref={emojiBtnRef}
                    onClick={toggleEmojiPicker}
                    disabled={emojiRows.length >= 3}
                    title={emojiRows.length >= 3 ? 'Up to 3 emoji' : 'Add emoji'}
                    style={{
                      all: 'unset',
                      cursor: emojiRows.length >= 3 ? 'not-allowed' : 'pointer',
                      padding: '5px 6px',
                      borderRadius: 6,
                      color: 'var(--text-muted)',
                      opacity: emojiRows.length >= 3 ? 0.4 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'color 0.15s ease-out',
                    }}
                    onMouseEnter={(e) => { if (emojiRows.length < 3) e.currentTarget.style.color = 'var(--text)' }}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                      <line x1="9" y1="9" x2="9.01" y2="9" />
                      <line x1="15" y1="9" x2="15.01" y2="9" />
                    </svg>
                  </button>
                </div>
              </div>

              {showEmojiPicker && pickerPos && (
                <>
                  <div
                    onClick={() => setShowEmojiPicker(false)}
                    style={{ position: 'fixed', inset: 0, zIndex: 1000 }}
                  />
                  <div style={{ position: 'fixed', top: pickerPos.top, left: pickerPos.left, zIndex: 1001 }}>
                    <EmojiPicker
                      onEmojiClick={(d) => addEmoji(d.emoji)}
                      theme={Theme.AUTO}
                      emojiStyle={EmojiStyle.NATIVE}
                      lazyLoadEmojis
                      width={340}
                      height={420}
                      previewConfig={{ showPreview: false }}
                    />
                  </div>
                </>
              )}

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
                          background: 'var(--surface)',
                          border: '1px solid var(--surface-border)',
                          borderRadius: 8,
                          padding: '12px 16px',
                          fontSize: 13,
                          fontFamily: 'monospace',
                          overflowX: 'auto',
                          margin: '0.5em 0',
                        }}>{children}</code>
                      ) : (
                        <code style={{
                          background: 'var(--surface)',
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
                          animation: isGenerating ? `suggestion-pulse-${s.type} 2s linear infinite` : undefined,
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

              {/* Custom node input */}
              {customStatus === 'disambiguating' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    A few directions — which one?
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {interpretations.map((interp, i) => (
                      <button
                        key={i}
                        onClick={() => handleCustomPick(interp)}
                        style={{
                          all: 'unset',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          padding: '13px 16px',
                          borderRadius: 12,
                          background: 'var(--panel-bg)',
                          border: '1px solid var(--panel-border)',
                          transition: 'border-color 0.15s ease-out, background 0.15s ease-out',
                          boxSizing: 'border-box',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--node-factual)'
                          e.currentTarget.style.background = 'rgba(76,217,100,0.08)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--panel-border)'
                          e.currentTarget.style.background = 'var(--panel-bg)'
                        }}
                      >
                        <span style={{ fontSize: 14, color: 'var(--text)', fontFamily: 'inherit', lineHeight: 1.4 }}>
                          {interp.label}
                        </span>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 600,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          color: interp.type === 'factual' ? 'var(--node-factual)' : 'var(--node-practical)',
                          flexShrink: 0,
                        }}>
                          {interp.type}
                        </span>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setCustomStatus('idle')}
                    style={{
                      all: 'unset',
                      cursor: 'pointer',
                      fontSize: 13,
                      color: 'var(--text-muted)',
                      fontFamily: 'inherit',
                      alignSelf: 'flex-start',
                      transition: 'color 0.15s ease-out',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                  >
                    ← Back
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      value={customInput}
                      onChange={(e) => { setCustomInput(e.target.value); if (customStatus === 'error') setCustomStatus('idle') }}
                      onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
                      placeholder="Or add your own custom subtopic"
                      disabled={customStatus === 'loading'}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        background: 'var(--panel-bg)',
                        border: '1px solid var(--panel-border)',
                        borderRadius: 10,
                        color: 'var(--text)',
                        fontSize: 14,
                        fontFamily: 'inherit',
                        padding: '10px 14px',
                        outline: 'none',
                        opacity: customStatus === 'loading' ? 0.6 : 1,
                        transition: 'opacity 0.15s ease-out, border-color 0.15s ease-out',
                        boxSizing: 'border-box',
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--node-factual)')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--panel-border)')}
                    />
                    <button
                      onClick={handleCustomSubmit}
                      disabled={customStatus === 'loading' || !customInput.trim()}
                      style={{
                        all: 'unset',
                        cursor: customStatus === 'loading' || !customInput.trim() ? 'not-allowed' : 'pointer',
                        flexShrink: 0,
                        padding: '10px 14px',
                        borderRadius: 10,
                        background: 'var(--node-factual)',
                        color: '#0D0D12',
                        fontSize: 16,
                        lineHeight: 1,
                        fontWeight: 600,
                        opacity: customStatus === 'loading' || !customInput.trim() ? 0.5 : 1,
                        transition: 'opacity 0.15s ease-out',
                      }}
                    >
                      →
                    </button>
                  </div>
                  {customStatus === 'error' && (
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--node-practical)', lineHeight: 1.4 }}>
                      Something went wrong, try again?
                    </p>
                  )}
                </div>
              )}

              {/* Divider */}
              <div style={{ height: 1, background: 'var(--panel-border)', flexShrink: 0 }} />

              {/* Annotation editor */}
              <NodeAnnotation key={node.id} nodeId={node.id} />

              <CitationHoverCard sources={node.sources} containerRef={contentRef} />
            </>
          )}
        </div>

        {/* Chat column */}
        {showChat && node && (
          <div style={{
            width: 360,
            flexShrink: 0,
            borderLeft: '1px solid var(--panel-border)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            <ChatPanel
              nodeId={node.id}
              nodeType={node.type}
              messages={chatMessages}
              onAddMessage={addChatMessage}
            />
          </div>
        )}
      </div>
    </aside>
  )
}

