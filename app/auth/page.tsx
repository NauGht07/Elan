'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase-browser'

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)

  const supabase = createBrowserClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/')
  }

  const inputStyle = (field: string): React.CSSProperties => ({
    width: '100%',
    boxSizing: 'border-box',
    background: 'var(--panel-bg)',
    border: `1px solid ${focusedField === field ? 'var(--node-factual)' : 'var(--panel-border)'}`,
    borderRadius: 10,
    color: 'var(--text)',
    fontSize: 14,
    fontFamily: 'inherit',
    padding: '10px 14px',
    outline: 'none',
    transition: 'border-color 0.2s cubic-bezier(0,0,0.2,1)',
  })

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      background: 'var(--bg)',
    }}>
      <p style={{
        fontSize: 32,
        fontWeight: 300,
        letterSpacing: '0.12em',
        color: 'var(--node-factual)',
        marginBottom: 32,
        userSelect: 'none',
      }}>
        elan
      </p>

      <div className="glass" style={{
        width: '100%',
        maxWidth: 360,
        padding: 40,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}>
        <h1 style={{
          margin: 0,
          fontSize: 20,
          fontWeight: 600,
          color: 'var(--text)',
          lineHeight: 1.3,
        }}>
          {mode === 'login' ? 'Welcome back' : 'Get started'}
        </h1>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label htmlFor="email" style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
            }}>
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
              required
              autoComplete="email"
              style={inputStyle('email')}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label htmlFor="password" style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
            }}>
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              style={inputStyle('password')}
            />
          </div>

          {error && (
            <p style={{
              margin: 0,
              fontSize: 13,
              color: 'var(--node-practical)',
              lineHeight: 1.4,
            }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              all: 'unset',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'block',
              width: '100%',
              boxSizing: 'border-box',
              padding: '11px 0',
              borderRadius: 10,
              background: 'var(--node-factual)',
              color: '#0D0D12',
              fontSize: 14,
              fontFamily: 'inherit',
              fontWeight: 600,
              textAlign: 'center',
              opacity: loading ? 0.7 : 1,
              transition: 'opacity 0.2s cubic-bezier(0,0,0.2,1)',
              marginTop: 4,
            }}
          >
            {loading ? 'On it...' : mode === 'login' ? 'Log in' : 'Sign up'}
          </button>
        </form>
      </div>

      <p style={{
        marginTop: 20,
        fontSize: 13,
        color: 'var(--text-muted)',
        textAlign: 'center',
      }}>
        {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
        <button
          type="button"
          onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null) }}
          style={{
            all: 'unset',
            cursor: 'pointer',
            color: 'var(--node-factual)',
            fontWeight: 500,
          }}
        >
          {mode === 'login' ? 'Sign up' : 'Log in'}
        </button>
      </p>
    </main>
  )
}
