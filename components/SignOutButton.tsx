'use client'

import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase-browser'

export default function SignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createBrowserClient()
    await supabase.auth.signOut()
    router.push('/auth')
  }

  return (
    <button
      onClick={handleSignOut}
      style={{
        all: 'unset',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '10px 20px',
        borderRadius: 10,
        border: '1px solid var(--panel-border)',
        fontSize: 14,
        fontFamily: 'inherit',
        fontWeight: 500,
        color: 'var(--text-muted)',
        transition: 'color 0.15s cubic-bezier(0,0,0.2,1), border-color 0.15s cubic-bezier(0,0,0.2,1)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = 'var(--node-practical)'
        e.currentTarget.style.borderColor = 'rgba(255,45,85,0.4)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = 'var(--text-muted)'
        e.currentTarget.style.borderColor = 'var(--panel-border)'
      }}
    >
      Sign out
    </button>
  )
}
