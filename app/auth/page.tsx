'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase-browser'

/* ── Auth page palette ── */
const INK = '#2A2620'
const INK_MUTED = 'rgba(42, 38, 32, 0.52)'
const FACTUAL = '#7B9EFF'


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
    background: focusedField === field ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.06)',
    border: `1px solid ${focusedField === field ? 'rgba(123,158,255,0.7)' : 'rgba(255,255,255,0.22)'}`,
    borderRadius: 11,
    color: INK,
    fontSize: 14,
    fontFamily: 'inherit',
    padding: '11px 14px',
    outline: 'none',
    boxShadow:
      focusedField === field
        ? `0 0 0 3px rgba(123, 158, 255, 0.18)`
        : 'inset 0 1px 2px rgba(0,0,0,0.04)',
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
        backgroundColor: '#F0E0C8',
        backgroundImage: "url('/paper-texture.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Warm cream overlay — lets texture show through subtly */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: 'rgba(240, 224, 200, 0.82)',
        }}
      />

      {/* Liquid Glass card — Apple-style material: blur + specular, not fill */}
      <div
        className="gradient-border"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 360,
          padding: 40,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          background: 'rgba(255, 250, 240, 0.10)',
          backdropFilter: 'blur(0) saturate(120%)',
          WebkitBackdropFilter: 'blur(0) saturate(120%)',
          borderRadius: 22,
          overflow: 'hidden',
          boxShadow: `inset 0 0 22px rgba(0,0,0,0.12)`,
        }}
      >
        {/* Top-left corner sheen — primary catch light */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 130,
            height: 130,
            background: 'radial-gradient(circle at 0% 0%, rgba(255,255,255,0.22) 0%, transparent 65%)',
            pointerEvents: 'none',
            zIndex: 2,
          }}
        />

        {/* Bottom-right corner sheen — secondary reflection */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 130,
            height: 130,
            background: 'radial-gradient(circle at 100% 100%, rgba(255,255,255,0.13) 0%, transparent 65%)',
            pointerEvents: 'none',
            zIndex: 2,
          }}
        />

        {/* Inner bevel — second refraction angle where thick glass turns darker */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 1,
            borderRadius: 21,
            border: '1px solid rgba(90, 60, 25, 0.12)',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />

      <p
        style={{
          position: 'relative',
          fontSize: 32,
          fontWeight: 300,
          letterSpacing: '0.12em',
          textAlign: 'center',
          color: FACTUAL,
          marginBottom: 30,
          userSelect: 'none',
        }}
      >
        elan
      </p>

        <div style={{ position: 'relative', zIndex: 3, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 600,
              color: INK,
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
                  color: INK_MUTED,
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
                  color: INK_MUTED,
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
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: '#B5713A',
                  lineHeight: 1.4,
                }}
              >
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
                borderRadius: 11,
                background: FACTUAL,
                color: '#15182B',
                fontSize: 14,
                fontFamily: 'inherit',
                fontWeight: 600,
                textAlign: 'center',
                opacity: loading ? 0.7 : 1,
                boxShadow: '0 2px 6px rgba(123, 158, 255, 0.35)',
                transition: 'opacity 0.2s cubic-bezier(0,0,0.2,1)',
                marginTop: 4,
              }}
            >
              {loading ? 'On it...' : mode === 'login' ? 'Log in' : 'Sign up'}
            </button>
          </form>
      <p
        style={{
          position: 'relative',
          marginTop: 20,
          fontSize: 13,
          color: INK_MUTED,
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
