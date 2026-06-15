'use client'

import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { NodeChat, NodeType } from '@/types'
import { CustomLink, typeHex } from '@/lib/nodeUtils'

interface ChatPanelProps {
  nodeId: string
  nodeType: NodeType
  messages: NodeChat[]
  onAddMessage: (msg: Pick<NodeChat, 'role' | 'message'>) => void
}

export default function ChatPanel({ nodeId, nodeType, messages, onAddMessage }: ChatPanelProps) {
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const accent = typeHex(nodeType)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatLoading])

  // Reset input height when nodeId changes
  useEffect(() => {
    setChatInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }, [nodeId])

  async function handleSend() {
    const message = chatInput.trim()
    if (!message || chatLoading) return

    onAddMessage({ role: 'user', message })
    setChatInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setChatLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ node_id: nodeId, message }),
      })

      if (!res.ok) throw new Error()
      const { response } = await res.json()
      onAddMessage({ role: 'assistant', message: response })
    } catch {
      onAddMessage({
        role: 'assistant',
        message: "Couldn't reach my brain there — try again?",
      })
    } finally {
      setChatLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setChatInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px'
  }

  const canSend = !!chatInput.trim() && !chatLoading

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Message list */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}>
        {messages.length === 0 && !chatLoading && (
          <p style={{
            margin: '40px 0 0',
            fontSize: 13,
            color: 'var(--text-muted)',
            textAlign: 'center',
            fontStyle: 'italic',
          }}>
            Ask me anything about this.
          </p>
        )}

        {messages.map((msg) => (
          <div key={msg.id} style={{
            display: 'flex',
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
          }}>
            {msg.role === 'user' ? (
              <div style={{
                maxWidth: '86%',
                padding: '9px 13px',
                borderRadius: '12px 12px 3px 12px',
                background: 'var(--surface)',
                border: '1px solid var(--surface-border)',
                fontSize: 14,
                lineHeight: 1.55,
                color: 'var(--text-muted)',
                wordBreak: 'break-word',
              }}>
                {msg.message}
              </div>
            ) : (
              <div style={{
                maxWidth: '93%',
                padding: '11px 13px',
                borderRadius: '3px 12px 12px 12px',
                background: 'var(--surface)',
                border: '1px solid var(--surface-border)',
                borderLeft: `3px solid ${accent}`,
                fontSize: 14,
                lineHeight: 1.65,
                color: 'var(--text)',
                wordBreak: 'break-word',
              }}>
                <ReactMarkdown
                  components={{
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    a: CustomLink as any,
                    p: ({ children }) => (
                      <p style={{ margin: '0 0 0.6em', lineHeight: 1.65 }}>{children}</p>
                    ),
                    code: ({ children, className }) => {
                      const isBlock = className?.startsWith('language-')
                      return isBlock ? (
                        <code style={{
                          display: 'block',
                          background: 'var(--surface)',
                          border: '1px solid var(--panel-border)',
                          borderRadius: 6,
                          padding: '8px 12px',
                          fontSize: 12,
                          fontFamily: 'monospace',
                          overflowX: 'auto',
                          margin: '0.4em 0',
                        }}>{children}</code>
                      ) : (
                        <code style={{
                          background: 'var(--surface)',
                          borderRadius: 4,
                          padding: '1px 4px',
                          fontSize: '0.88em',
                          fontFamily: 'monospace',
                        }}>{children}</code>
                      )
                    },
                  }}
                >
                  {msg.message}
                </ReactMarkdown>
              </div>
            )}
          </div>
        ))}

        {chatLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '10px 14px',
              borderRadius: '3px 12px 12px 12px',
              background: 'var(--surface)',
              border: '1px solid var(--surface-border)',
              borderLeft: `3px solid ${accent}`,
              fontSize: 13,
              color: 'var(--text-muted)',
              fontStyle: 'italic',
              animation: 'elan-pulse 1.4s ease-in-out infinite',
            }}>
              Give me a sec...
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        flexShrink: 0,
        padding: '12px 14px',
        borderTop: '1px solid var(--panel-border)',
        display: 'flex',
        gap: 8,
        alignItems: 'flex-end',
      }}>
        <textarea
          ref={textareaRef}
          value={chatInput}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything..."
          rows={1}
          style={{
            flex: 1,
            background: 'var(--surface)',
            border: '1px solid var(--panel-border)',
            borderRadius: 10,
            padding: '9px 12px',
            fontSize: 14,
            color: 'var(--text)',
            fontFamily: 'inherit',
            resize: 'none',
            outline: 'none',
            lineHeight: 1.5,
            overflowY: 'auto',
          }}
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          style={{
            all: 'unset',
            cursor: canSend ? 'pointer' : 'not-allowed',
            width: 34,
            height: 34,
            borderRadius: 8,
            background: canSend ? `${accent}22` : 'var(--surface)',
            border: `1px solid ${canSend ? `${accent}60` : 'var(--panel-border)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'background 0.2s ease-out, border-color 0.2s ease-out, color 0.2s ease-out',
            color: canSend ? accent : 'var(--text-muted)',
            fontSize: 16,
            lineHeight: 1,
          }}
        >
          ↑
        </button>
      </div>
    </div>
  )
}
