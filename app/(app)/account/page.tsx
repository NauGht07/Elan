import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import SignOutButton from '@/components/SignOutButton'

export default async function AccountPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth')

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
      <div className="glass" style={{
        width: '100%',
        maxWidth: 420,
        padding: 40,
        display: 'flex',
        flexDirection: 'column',
        gap: 32,
      }}>

        {/* Header */}
        <div>
          <h1 style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 600,
            color: 'var(--text)',
            lineHeight: 1.3,
          }}>
            Account
          </h1>
        </div>

        {/* Profile */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
          }}>
            Email
          </span>
          <span style={{
            fontSize: 15,
            color: 'var(--text)',
            lineHeight: 1.4,
          }}>
            {user.email}
          </span>
        </section>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--panel-border)' }} />

        {/* Sign out */}
        <section>
          <SignOutButton />
        </section>

      </div>
    </main>
  )
}
