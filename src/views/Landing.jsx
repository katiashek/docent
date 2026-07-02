import { useState } from 'react'
import { T } from '../tokens.js'
import { supabase } from '../supabase.js'

export default function Landing({ onAuth }) {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      let result
      if (mode === 'signup') {
        result = await supabase.auth.signUp({ email, password })
      } else {
        result = await supabase.auth.signInWithPassword({ email, password })
      }
      if (result.error) throw result.error
      onAuth(result.data.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({ provider: 'google' })
  }

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      background: T.bg, padding: '48px 28px 40px',
    }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{
          fontFamily: T.fontDisplay, fontSize: 13, fontWeight: 500,
          color: T.accent, letterSpacing: '0.04em', marginBottom: 40,
        }}>docent</div>

        <div style={{
          fontFamily: T.fontDisplay, fontSize: 38, fontWeight: 500,
          lineHeight: 1.1, letterSpacing: '-0.02em', color: T.ink, marginBottom: 12,
        }}>
          Let's build<br />
          <em style={{ fontStyle: 'italic', color: T.accent }}>your eye.</em>
        </div>
        <p style={{ fontFamily: T.fontBody, fontSize: 15, lineHeight: 1.7, color: T.ink3, marginBottom: 40, maxWidth: 280 }}>
          A personalized audio guide for the Art Institute of Chicago.
        </p>

        {/* Tab toggle */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 20, border: `0.5px solid ${T.border}`, borderRadius: T.rMd, overflow: 'hidden' }}>
          {['login', 'signup'].map((m) => (
            <button key={m} onClick={() => setMode(m)} style={{
              flex: 1, padding: '10px', background: mode === m ? T.white : 'transparent',
              border: 'none', fontFamily: T.fontBody, fontSize: 14,
              fontWeight: mode === m ? 500 : 400,
              color: mode === m ? T.ink : T.ink3, cursor: 'pointer',
            }}>
              {m === 'login' ? 'Log in' : 'Sign up'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="email" placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)} required
            style={{
              width: '100%', padding: '12px 14px', borderRadius: T.rMd,
              border: `0.5px solid ${T.border}`, background: T.white,
              fontFamily: T.fontBody, fontSize: 14, color: T.ink2, outline: 'none',
            }}
          />
          <input
            type="password" placeholder="Password" value={password}
            onChange={(e) => setPassword(e.target.value)} required
            style={{
              width: '100%', padding: '12px 14px', borderRadius: T.rMd,
              border: `0.5px solid ${T.border}`, background: T.white,
              fontFamily: T.fontBody, fontSize: 14, color: T.ink2, outline: 'none',
            }}
          />
          {error && <p style={{ fontFamily: T.fontBody, fontSize: 13, color: T.pass }}>{error}</p>}
          <button type="submit" disabled={loading} style={{
            padding: '16px', borderRadius: T.rMd,
            background: T.accent, border: 'none', color: '#fff',
            fontFamily: T.fontBody, fontSize: 15, fontWeight: 500,
            cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1,
          }}>
            {loading ? 'Loading…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
          <div style={{ flex: 1, height: '0.5px', background: T.border }} />
          <span style={{ fontFamily: T.fontBody, fontSize: 12, color: T.ink4 }}>or</span>
          <div style={{ flex: 1, height: '0.5px', background: T.border }} />
        </div>

        <button onClick={handleGoogle} style={{
          padding: '14px', borderRadius: T.rMd,
          background: T.white, border: `0.5px solid ${T.border}`,
          fontFamily: T.fontBody, fontSize: 14, color: T.ink2, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Continue with Google
        </button>
      </div>
    </div>
  )
}
