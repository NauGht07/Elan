'use client'

import { useEffect, useRef, useState } from 'react'
import type { Tree, ElanNode, Interpretation, NodeType } from '@/types'

interface Props {
  isOpen: boolean
  onClose: () => void
  onComplete: (tree: Tree, rootNode: ElanNode) => void
}

export default function NewTreeModal({ isOpen, onClose, onComplete }: Props) {
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'disambiguating' | 'error'>('idle')
  const [visible, setVisible] = useState(false)
  const [interpretations, setInterpretations] = useState<Interpretation[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setVisible(true)
      setInput('')
      setStatus('idle')
      setInterpretations([])
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setVisible(false)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && status !== 'loading') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose, status])

  async function handleSubmit() {
    const trimmed = input.trim()
    if (!trimmed || status === 'loading') return

    setStatus('loading')

    try {
      const checkRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: trimmed, ancestor_ids: [], ancestors: [] }),
      })
      if (!checkRes.ok) { setStatus('error'); return }
      const data = await checkRes.json()

      setInterpretations(data.interpretations)
      setStatus('disambiguating')
    } catch {
      setStatus('error')
    }
  }

  async function handlePickInterpretation(chosen: Interpretation) {
    setStatus('loading')
    await createAndGenerate(input.trim(), chosen.query, chosen.type, chosen.label)
  }

  async function createAndGenerate(originalInput: string, query: string, type: NodeType, title: string) {
    try {
      const treeRes = await fetch('/api/trees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      if (!treeRes.ok) { setStatus('error'); return }
      const { tree } = await treeRes.json()

      const genRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: originalInput,
          tree_id: tree.id,
          parent_id: null,
          ancestor_ids: [],
          ancestors: [],
          query,
          type,
        }),
      })
      if (!genRes.ok) { setStatus('error'); return }
      const { node } = await genRes.json()

      onComplete(tree, node)
      setStatus('idle')
    } catch {
      setStatus('error')
    }
  }

  if (!isOpen) return null

  const loading = status === 'loading'
  const disambiguating = status === 'disambiguating'

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose() }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'var(--scrim)',
        opacity: visible ? 1 : 0,
        transition: 'opacity 200ms cubic-bezier(0,0,0.2,1)',
      }}
    >
      <div
        className="glass"
        style={{
          width: '100%',
          maxWidth: 480,
          padding: 40,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          transform: visible ? 'scale(1)' : 'scale(0.96)',
          transition: 'transform 200ms cubic-bezier(0,0,0.2,1)',
        }}
      >
        {disambiguating ? (
          <>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>
              I found a few directions
            </h2>

            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Which one did you mean?
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {interpretations.map((interp, i) => (
                <button
                  key={i}
                  onClick={() => handlePickInterpretation(interp)}
                  style={{
                    all: 'unset',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    borderRadius: 10,
                    border: '1px solid var(--panel-border)',
                    background: 'var(--panel-bg)',
                    color: 'var(--text)',
                    fontSize: 14,
                    fontFamily: 'inherit',
                    transition: 'border-color 0.15s ease-out, background 0.15s ease-out',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--node-factual)'
                    e.currentTarget.style.background = 'rgba(123,158,255,0.08)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--panel-border)'
                    e.currentTarget.style.background = 'var(--panel-bg)'
                  }}
                >
                  <span>{interp.label}</span>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: interp.type === 'factual' ? 'var(--node-factual)' : 'var(--node-practical)',
                    flexShrink: 0,
                    marginLeft: 12,
                  }}>
                    {interp.type}
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setStatus('idle')}
              style={{
                all: 'unset',
                cursor: 'pointer',
                fontSize: 13,
                color: 'var(--text-muted)',
                fontFamily: 'inherit',
                transition: 'color 0.15s ease-out',
                alignSelf: 'flex-start',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              ← Back
            </button>
          </>
        ) : (
          <>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>
              What are you curious about?
            </h2>

            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => { setInput(e.target.value); if (status === 'error') setStatus('idle') }}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="anything, really"
              disabled={loading}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'var(--panel-bg)',
                border: '1px solid var(--panel-border)',
                borderRadius: 10,
                color: 'var(--text)',
                fontSize: 15,
                fontFamily: 'inherit',
                padding: '12px 16px',
                outline: 'none',
                opacity: loading ? 0.6 : 1,
                transition: 'opacity 0.15s ease-out, border-color 0.15s ease-out',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--node-factual)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--panel-border)')}
            />

            {status === 'error' && (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--node-practical)', lineHeight: 1.5 }}>
                Something went wrong on my end, try again?
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                all: 'unset',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'block',
                width: '100%',
                boxSizing: 'border-box',
                padding: '13px 0',
                borderRadius: 10,
                background: 'var(--node-factual)',
                color: '#0D0D12',
                fontSize: 15,
                fontFamily: 'inherit',
                fontWeight: 600,
                textAlign: 'center',
                opacity: loading ? 0.7 : 1,
                transition: 'opacity 0.2s cubic-bezier(0,0,0.2,1)',
              }}
            >
              {loading ? 'On it...' : "Let's go"}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
