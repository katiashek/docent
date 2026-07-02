import { useState } from 'react'
import { T } from '../tokens.js'
import { useAppState } from '../state/useAppState.js'
import { generateTasteProfile } from '../services/llm.js'

export default function TasteProfile({ onBuildTour, onPushBack, onNavigate }) {
  const { tasteProfile, swipeHistory, onboardingData, llmConfig, setTasteProfile } = useAppState()
  const [showPushback, setShowPushback] = useState(false)
  const [pushbackText, setPushbackText] = useState('')
  const [recalibrating, setRecalibrating] = useState(false)

  const profile = tasteProfile || {
    movements: [
      { label: 'American Realism', weight: 0.88 },
      { label: 'Post-Impressionism', weight: 0.74 },
      { label: 'Modernism', weight: 0.61 },
      { label: 'Impressionism', weight: 0.55 },
      { label: 'Realism', weight: 0.42 },
    ],
    themes: ['Narrative', 'Solitude', 'Light', 'Domesticity', 'Memory'],
    summary: "You're drawn to narrative, human-scale work — art that quietly holds something difficult. Your eye favors moments of stillness and light.",
    patternStrength: 0.78,
  }

  async function handleRecalibrate() {
    if (!llmConfig?.apiKey || !pushbackText) return
    setRecalibrating(true)
    try {
      const history = swipeHistory.filter((s) => s.liked)
      const newProfile = await generateTasteProfile(llmConfig, swipeHistory, {
        ...onboardingData,
        freetext: pushbackText,
      })
      if (newProfile) setTasteProfile(newProfile)
    } catch {}
    setRecalibrating(false)
    setShowPushback(false)
  }

  const pct = Math.round((profile.patternStrength || 0) * 100)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: T.bg, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 20px 12px', background: T.white, borderBottom: `0.5px solid ${T.border}`, flexShrink: 0 }}>
        <div style={{ fontFamily: T.fontBody, fontSize: 11, fontWeight: 500, color: T.ink4, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Your taste</div>
        <div style={{ fontFamily: T.fontDisplay, fontSize: 24, fontWeight: 500, letterSpacing: '-0.018em', color: T.ink }}>Pattern analysis</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 120px' }}>
        {/* Pattern strength card */}
        <div style={{
          background: T.white, borderRadius: T.rLg, border: `0.5px solid ${T.border}`,
          display: 'flex', overflow: 'hidden', marginBottom: 20,
        }}>
          <div style={{ width: 3, background: T.accent, borderRadius: `${T.rLg} 0 0 ${T.rLg}`, flexShrink: 0 }} />
          <div style={{ flex: 1, padding: '16px 18px 16px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontFamily: T.fontBody, fontSize: 11, fontWeight: 500, color: T.ink4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Pattern strength · {pct}%</span>
            </div>
            <div style={{ height: 4, background: T.bgSub, borderRadius: T.rPill, marginBottom: 14 }}>
              <div style={{ height: '100%', width: `${pct}%`, background: T.accent, borderRadius: T.rPill }} />
            </div>
            <p style={{ fontFamily: T.fontBody, fontSize: 14, lineHeight: 1.65, color: T.ink2 }}>{profile.summary}</p>
          </div>
        </div>

        {/* Movement bars */}
        <div style={{ background: T.white, borderRadius: T.rLg, border: `0.5px solid ${T.border}`, padding: '16px 18px', marginBottom: 20 }}>
          <div style={{ fontFamily: T.fontBody, fontSize: 11, fontWeight: 500, color: T.ink4, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>Movements</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {(profile.movements || []).map((m) => (
              <div key={m.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontFamily: T.fontBody, fontSize: 13, fontWeight: m.weight > 0.7 ? 500 : 400, color: T.ink2 }}>{m.label}</span>
                  <span style={{ fontFamily: T.fontBody, fontSize: 11, color: T.ink4 }}>{Math.round(m.weight * 100)}%</span>
                </div>
                <div style={{ height: 3, background: T.bgSub, borderRadius: T.rPill }}>
                  <div style={{
                    height: '100%', width: `${m.weight * 100}%`, borderRadius: T.rPill,
                    background: m.weight > 0.7 ? T.accent : T.ink4,
                    opacity: 0.4 + m.weight * 0.6,
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Theme pills */}
        {profile.themes?.length > 0 && (
          <div style={{ background: T.white, borderRadius: T.rLg, border: `0.5px solid ${T.border}`, padding: '16px 18px', marginBottom: 20 }}>
            <div style={{ fontFamily: T.fontBody, fontSize: 11, fontWeight: 500, color: T.ink4, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Themes</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {profile.themes.map((theme, i) => (
                <span key={theme} style={{
                  padding: '6px 14px', borderRadius: T.rPill,
                  background: i === 0 ? T.accentBg : T.bgSub,
                  fontFamily: T.fontBody, fontSize: 12, fontWeight: i === 0 ? 500 : 400,
                  color: i === 0 ? T.accent : T.ink2,
                }}>{theme}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CTAs */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 20px 28px', background: T.bg, borderTop: `0.5px solid ${T.border}` }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={() => onNavigate('intent')} style={{ padding: '14px', borderRadius: T.rMd, background: T.accent, border: 'none', color: '#fff', fontFamily: T.fontBody, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
            Looks right — build my tour
          </button>
          <button onClick={() => setShowPushback((s) => !s)} style={{ padding: '14px', borderRadius: T.rMd, background: 'transparent', border: `0.5px solid ${T.border}`, color: T.ink2, fontFamily: T.fontBody, fontSize: 14, cursor: 'pointer' }}>
            Actually…
          </button>
        </div>

        {showPushback && (
          <div style={{ marginTop: 12, animation: 'slideUp 0.2s ease' }}>
            <textarea
              value={pushbackText}
              onChange={(e) => setPushbackText(e.target.value)}
              placeholder="Tell us what's off. We'll adjust."
              rows={3}
              style={{ width: '100%', padding: '12px 14px', fontFamily: T.fontBody, fontSize: 13, color: T.ink2, background: T.white, border: `0.5px solid ${T.border}`, borderRadius: T.rLg, outline: 'none', marginBottom: 10 }}
            />
            <button onClick={handleRecalibrate} disabled={recalibrating} style={{ padding: '12px 20px', borderRadius: T.rMd, background: T.ink, border: 'none', color: T.bg, fontFamily: T.fontBody, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              {recalibrating ? 'Recalibrating…' : 'Recalibrate'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
