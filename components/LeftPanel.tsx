'use client'

import { useEffect, useRef, useState } from 'react'
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
  const renameTree = useStore((s) => s.renameTree)
  const [loading, setLoading] = useState(true)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [theme, setTheme] = useState<'light' | 'dark' | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const renameInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light')
  }, [])

  useEffect(() => {
    if (!theme) return
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.cookie = `elan-theme=${theme}; max-age=31536000; path=/`
  }, [theme])

  function toggleTheme() { setTheme(t => t === 'light' ? 'dark' : 'light') }

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

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpenId) return
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [menuOpenId])

  // Focus rename input when it appears
  useEffect(() => {
    if (renameTargetId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renameTargetId])

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

  function openMenu(e: React.MouseEvent, tree: Tree) {
    e.stopPropagation()
    setMenuOpenId((prev) => prev === tree.id ? null : tree.id)
  }

  function startRename(tree: Tree) {
    setMenuOpenId(null)
    setRenameTargetId(tree.id)
    setRenameValue(tree.title)
  }

  function cancelRename() {
    setRenameTargetId(null)
    setRenameValue('')
  }

  async function commitRename(id: string) {
    const trimmed = renameValue.trim()
    if (!trimmed) { cancelRename(); return }
    const tree = trees.find((t) => t.id === id)
    if (!tree || trimmed === tree.title) { cancelRename(); return }
    renameTree(id, trimmed)
    cancelRename()
    await fetch('/api/trees', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tree_id: id, title: trimmed }),
    })
  }

  return (
    <aside
      className="gradient-border glass-card"
      style={{
        position: 'fixed',
        top: 14,
        left: 14,
        bottom: 14,
        width: isCollapsed ? 60 : 240,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'var(--slab-shadow), inset 0 0 22px var(--glass-inset-shadow)',
        transition: 'width 400ms cubic-bezier(0,0,0.2,1)',
      }}
    >
      <div aria-hidden className="glass-card-corner-tl" />
      <div aria-hidden className="glass-card-corner-br" />
      <div aria-hidden className="glass-card-bevel" />

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
          const isRenaming = tree.id === renameTargetId
          const isMenuOpen = tree.id === menuOpenId

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

              {/* Selection button */}
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
                {isRenaming ? (
                  <input
                    ref={renameInputRef}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); commitRename(tree.id) }
                      if (e.key === 'Escape') cancelRename()
                    }}
                    onBlur={() => commitRename(tree.id)}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      all: 'unset',
                      fontSize: 13,
                      fontFamily: 'inherit',
                      fontWeight: 500,
                      color: 'var(--text)',
                      width: '100%',
                      minWidth: 0,
                      borderBottom: '1px solid var(--node-factual)',
                      paddingBottom: 1,
                      caretColor: 'var(--node-factual)',
                    }}
                  />
                ) : (
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
                )}
              </button>

              {/* Three-dot menu button — fades in on hover, hidden when collapsed or renaming */}
              {!isCollapsed && !isRenaming && (
                <div style={{ position: 'relative', flexShrink: 0 }} ref={isMenuOpen ? menuRef : null}>
                  <button
                    onClick={(e) => openMenu(e, tree)}
                    style={{
                      all: 'unset',
                      cursor: 'pointer',
                      width: 36,
                      height: 36,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                      letterSpacing: '0.05em',
                      color: isMenuOpen ? 'var(--text)' : 'var(--text-muted)',
                      opacity: isHovered || isMenuOpen ? 1 : 0,
                      transition: 'opacity 0.15s cubic-bezier(0,0,0.2,1), color 0.15s cubic-bezier(0,0,0.2,1)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
                    onMouseLeave={(e) => {
                      if (!isMenuOpen) e.currentTarget.style.color = 'var(--text-muted)'
                    }}
                  >
                    ⋮
                  </button>

                  {/* Dropdown */}
                  {isMenuOpen && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      zIndex: 200,
                      minWidth: 120,
                      background: 'var(--panel-bg)',
                      backdropFilter: 'blur(24px) saturate(180%)',
                      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                      border: '1px solid var(--panel-border)',
                      borderRadius: 10,
                      boxShadow: 'var(--slab-shadow)',
                      overflow: 'hidden',
                      padding: '4px 0',
                    }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          startRename(tree)
                        }}
                        style={{
                          all: 'unset',
                          cursor: 'pointer',
                          display: 'block',
                          width: '100%',
                          padding: '8px 14px',
                          fontSize: 13,
                          fontFamily: 'inherit',
                          color: 'var(--text)',
                          boxSizing: 'border-box',
                          transition: 'background 0.1s ease-out',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        Rename
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setMenuOpenId(null)
                          setDeleteTarget({ id: tree.id, title: tree.title })
                        }}
                        style={{
                          all: 'unset',
                          cursor: 'pointer',
                          display: 'block',
                          width: '100%',
                          padding: '8px 14px',
                          fontSize: 13,
                          fontFamily: 'inherit',
                          color: 'var(--node-practical)',
                          boxSizing: 'border-box',
                          transition: 'background 0.1s ease-out',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,45,85,0.08)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
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
              e.currentTarget.style.background = 'rgba(76,217,100,0.06)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-muted)'
              e.currentTarget.style.borderColor = 'var(--panel-border)'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 300, lineHeight: 1 }}>+</span>
            New Topic
          </button>
        </div>
      )}

      {/* Separator */}
      <div style={{ height: 1, flexShrink: 0, background: 'var(--panel-border)' }} />

      {/* Account + theme toggle */}
      {isCollapsed ? (
        <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <Link
            href="/account"
            title="Account"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: 44,
              color: 'var(--text-muted)',
              textDecoration: 'none',
              transition: 'color 0.15s cubic-bezier(0,0,0.2,1)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--node-factual)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <circle cx="7.5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M2 13c0-3 2.5-4.5 5.5-4.5S13 10 13 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </Link>
          {theme && (
            <button
              onClick={toggleTheme}
              title={theme === 'light' ? 'Switch to dark' : 'Switch to light'}
              style={{
                all: 'unset',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: 40,
                color: 'var(--text-muted)',
                transition: 'color 0.15s cubic-bezier(0,0,0.2,1)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              {theme === 'light' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              )}
            </button>
          )}
        </div>
      ) : (
        <div style={{ padding: '10px 16px 14px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Link
              href="/account"
              style={{
                flex: 1,
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
              <svg width="14" height="14" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="7.5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M2 13c0-3 2.5-4.5 5.5-4.5S13 10 13 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              Account
            </Link>
            {theme && (
              <button
                onClick={toggleTheme}
                title={theme === 'light' ? 'Switch to dark' : 'Switch to light'}
                style={{
                  all: 'unset',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  color: 'var(--text-muted)',
                  flexShrink: 0,
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
                {theme === 'light' ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                  </svg>
                )}
              </button>
            )}
          </div>
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
          }}
        >
          <div
            className="gradient-border glass-card"
            style={{
              width: '100%',
              maxWidth: 360,
              padding: 32,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div aria-hidden className="glass-card-corner-tl" />
            <div aria-hidden className="glass-card-corner-br" />
            <div aria-hidden className="glass-card-bevel" />
            <div style={{ position: 'relative', zIndex: 3, display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                  background: 'rgba(255,45,85,0.10)',
                  border: '1px solid rgba(255,45,85,0.28)',
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
          </div>
        </div>,
        document.body
      )}
    </aside>
  )
}
