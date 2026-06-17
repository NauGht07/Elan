'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase-browser'

const FACTUAL = '#7B9EFF'

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [theme, setTheme] = useState<'light' | 'dark' | null>(null)

  const supabase = createBrowserClient()

  useEffect(() => {
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light')
  }, [])

  useEffect(() => {
    if (!theme) return
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.cookie = `elan-theme=${theme}; max-age=31536000; path=/`
  }, [theme])

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
    background: 'rgba(255, 255, 255, 0.1)',
    border: `1px solid ${focusedField === field ? 'rgba(123,158,255,0.55)' : 'var(--panel-border)'}`,
    borderRadius: 11,
    color: 'var(--text)',
    fontSize: 14,
    fontFamily: 'inherit',
    padding: '11px 14px',
    outline: 'none',
    boxShadow: focusedField === field
      ? [
          'inset 0 2px 5px rgba(42,38,32,0.12)',
          'inset 0 2px 0 rgba(255,255,255,0.22)',
          '0 0 0 3px rgba(123,158,255,0.18)',
        ].join(', ')
      : [
          'inset 0 2px 5px rgba(42,38,32,0.16)',
          'inset 0 2px 0 rgba(255,255,255,0.28)',
        ].join(', '),
    transition: 'border-color 0.2s cubic-bezier(0,0,0.2,1), box-shadow 0.2s cubic-bezier(0,0,0.2,1), background 0.2s cubic-bezier(0,0,0.2,1)',
  })

  return (
    <main
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        backgroundImage: "url('/paper-texture.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Theme toggle */}
      {theme && (
        <button
          onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
          aria-label="Toggle theme"
          style={{
            position: 'fixed',
            top: 20,
            right: 20,
            cursor: 'pointer',
            padding: '6px 14px',
            borderRadius: 20,
            background: 'var(--panel-bg)',
            border: '1px solid var(--panel-border)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            color: 'var(--text)',
            fontSize: 12,
            fontFamily: 'inherit',
            fontWeight: 500,
            letterSpacing: '0.04em',
            boxShadow: 'var(--slab-shadow)',
            transition: 'color 0.3s cubic-bezier(0,0,0.2,1), background 0.3s cubic-bezier(0,0,0.2,1)',
          }}
        >
          {theme === 'light' ? 'Dark' : 'Light'}
        </button>
      )}

      {/* Overlay — light: warm cream, dark: warm charcoal */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: 'var(--auth-overlay)',
          transition: 'background 0.3s cubic-bezier(0,0,0.2,1)',
        }}
      />

      {/* Liquid Glass card */}
      <div
        className="gradient-border glass-card"
        style={{
          width: '100%',
          maxWidth: 360,
          padding: 40,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        <div aria-hidden className="glass-card-corner-tl" />
        <div aria-hidden className="glass-card-corner-br" />
        <div aria-hidden className="glass-card-bevel" />

        <div style={{ position: 'relative', zIndex: 3, display: 'flex', flexDirection: 'column', gap: 20, filter: 'saturate(1.5)' }}>
          <p
            style={{
              margin: 0,
              fontSize: 32,
              fontWeight: 300,
              letterSpacing: '0.12em',
              textAlign: 'center',
              color: FACTUAL,
              marginBottom: 10,
              userSelect: 'none',
            }}
          >
            elan
          </p>
          <h1
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 600,
              color: 'var(--text)',
              lineHeight: 1.3,
            }}
          >
            {mode === 'login' ? 'Welcome back' : 'Get started'}
          </h1>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label
                htmlFor="email"
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                }}
              >
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
              <label
                htmlFor="password"
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                }}
              >
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
              <p style={{ margin: 0, fontSize: 13, color: '#B5713A', lineHeight: 1.4 }}>
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
                borderRadius: 50,
                background: 'rgba(86, 128, 255, 0.69)',
                color: 'var(--text)',
                fontSize: 14,
                fontFamily: 'inherit',
                fontWeight: 600,
                textAlign: 'center',
                opacity: loading ? 0.7 : 1,
                boxShadow: [
                  '0 1px 16px rgba(0, 0, 0, 0.38)',
                  '0 1px 3px rgba(42,38,32,0.10)',
                  'inset 0 1px 0 rgba(255,255,255,0.52)',
                ].join(', '),
                transition: 'opacity 0.2s cubic-bezier(0,0,0.2,1)',
                marginTop: 4,
              }}
            >
              {loading ? 'On it...' : mode === 'login' ? 'Log in' : 'Sign up'}
            </button>
          </form>

          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: 'var(--text-muted)',
              textAlign: 'center',
            }}
          >
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login')
                setError(null)
              }}
              style={{
                all: 'unset',
                cursor: 'pointer',
                color: FACTUAL,
                fontWeight: 600,
              }}
            >
              {mode === 'login' ? 'Sign up' : 'Log in'}
            </button>
          </p>
        </div>
      </div>
    </main>
  )
}
