import { useState } from 'react'
import { T } from '../tokens.js'
import { useAppState } from '../state/useAppState.js'
import { supabase, isSupabaseConfigured } from '../supabase.js'
import { buildItinerary } from '../services/planner.js'

const DURATION_PILLS = [
  { id: '30min', label: '30 min', minutes: 30 },
  { id: '1hr',   label: '1 hr',   minutes: 60 },
  { id: '2hr',   label: '2 hrs',  minutes: 120 },
  { id: '3hr+',  label: '3 hrs+', minutes: 180 },
  { id: 'custom',label: 'Custom', minutes: null },
]

export default function TourIntent({ onBuild }) {
  const { tasteProfile, onboardingData, setTourIntent, setItinerary, user, llmConfig } = useAppState()
  const [duration, setDuration] = useState('1hr')
  const [customMin, setCustomMin] = useState(90)
  const [mode, setMode] = useState('taste')
  const [focusText, setFocusText] = useState('')
  const [avoid, setAvoid] = useState('')
  const [building, setBuilding] = useState(false)
  const [buildError, setBuildError] = useState('')

  const selectedPill = DURATION_PILLS.find((d) => d.id === duration)
  const minutes = duration === 'custom' ? customMin : selectedPill?.minutes || 60

  const fmtCustom = (m) => m >= 60 ? `${Math.floor(m / 60)}h${m % 60 > 0 ? ` ${m % 60}m` : ''}` : `${m}m`

  async function handleBuild() {
    setBuilding(true)
    setBuildError('')
    const intent = { minutes, mode, focusText, avoidText: avoid }
    setTourIntent(intent)
    try {
      const itinerary = await buildItinerary(tasteProfile, onboardingData, intent, llmConfig)
      if (!itinerary.stops?.length) {
        setBuildError('No matching artworks found. Try a longer duration or adjust your preferences.')
        return
      }
      setItinerary(itinerary)
      // Persist so the returning-user flow can recall this tour on reload
      if (user?.id && isSupabaseConfigured) {
        supabase.from('profiles').upsert({
          id: user.id,
          itinerary,
          updated_at: new Date().toISOString(),
        }).then(() => {}, () => {})
      }
      onBuild()
    } catch (err) {
      console.error(err)
      setBuildError('Couldn\'t build your tour. Check your connection and try again.')
    } finally {
      setBuilding(false)
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: T.bg, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px 14px', background: T.white, borderBottom: `0.5px solid ${T.border}`, flexShrink: 0 }}>
        <div style={{ fontFamily: T.fontBody, fontSize: 11, fontWeight: 500, color: T.ink4, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Build your tour</div>
        <div style={{ fontFamily: T.fontDisplay, fontSize: 24, fontWeight: 500, letterSpacing: '-0.018em', color: T.ink }}>How do you want to spend it?</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Duration */}
        <div>
          <div style={{ fontFamily: T.fontBody, fontSize: 12, fontWeight: 500, color: T.ink4, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>How long do you have?</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {DURATION_PILLS.map((d) => {
              const sel = duration === d.id
              return (
                <button key={d.id} onClick={() => setDuration(d.id)} style={{
                  flex: 1, padding: '12px 0', borderRadius: T.rMd,
                  background: sel ? T.accentBg : T.white,
                  border: `${sel ? 1.5 : 0.5}px solid ${sel ? T.accent : T.border}`,
                  fontFamily: T.fontBody, fontSize: 12, fontWeight: sel ? 500 : 400,
                  color: sel ? T.accent : T.ink2, cursor: 'pointer', transition: 'all 0.15s ease',
                }}>{d.label}</button>
              )
            })}
          </div>

          {duration === 'custom' && (
            <div style={{ marginTop: 16, padding: '14px 16px', background: T.white, border: `0.5px solid ${T.border}`, borderRadius: T.rLg }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontFamily: T.fontBody, fontSize: 13, color: T.ink2 }}>Custom duration</span>
                <span style={{ fontFamily: T.fontBody, fontSize: 13, fontWeight: 500, color: T.accent }}>{fmtCustom(customMin)}</span>
              </div>
              <input type="range" min={15} max={240} step={15} value={customMin} onChange={(e) => setCustomMin(+e.target.value)} style={{ width: '100%', accentColor: T.accent }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontFamily: T.fontBody, fontSize: 10, color: T.ink4 }}>15 min</span>
                <span style={{ fontFamily: T.fontBody, fontSize: 10, color: T.ink4 }}>4 hrs</span>
              </div>
            </div>
          )}
        </div>

        {/* Tour mode */}
        <div>
          <div style={{ fontFamily: T.fontBody, fontSize: 12, fontWeight: 500, color: T.ink4, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Tour mode</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { id: 'taste',   icon: '♥', title: 'Follow my taste',           sub: 'Built entirely around your profile. No surprises.' },
              { id: 'explore', icon: '↗', title: 'Explore something different', sub: "We'll use your taste as a starting point, then go wider." },
            ].map((m) => {
              const sel = mode === m.id
              return (
                <button key={m.id} onClick={() => setMode(m.id)} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 18px',
                  borderRadius: T.rLg, border: 'none', textAlign: 'left',
                  background: sel ? T.accentBg : T.white,
                  outline: `${sel ? 1.5 : 0.5}px solid ${sel ? T.accent : T.border}`,
                  cursor: 'pointer', transition: 'all 0.15s ease',
                }}>
                  <span style={{ fontSize: 18, color: sel ? T.accent : T.ink3, flexShrink: 0, paddingTop: 1 }}>{m.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: T.fontBody, fontSize: 14, fontWeight: 500, color: sel ? T.accent : T.ink, marginBottom: 3 }}>{m.title}</div>
                    <div style={{ fontFamily: T.fontBody, fontSize: 12, color: T.ink3, lineHeight: 1.5 }}>{m.sub}</div>
                    {sel && m.id === 'explore' && (
                      <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 12 }}>
                        <input
                          type="text"
                          value={focusText}
                          onChange={(e) => setFocusText(e.target.value)}
                          maxLength={200}
                          placeholder="Contemporary art, only sculpture, outside my comfort zone..."
                          style={{
                            width: '100%', padding: '10px 12px', borderRadius: T.rMd,
                            fontFamily: T.fontBody, fontSize: 13, color: T.ink2,
                            background: T.white, border: `0.5px solid ${T.borderMid}`, outline: 'none',
                          }}
                        />
                        <p style={{ fontFamily: T.fontBody, fontSize: 11, color: T.ink4, marginTop: 6, lineHeight: 1.5 }}>
                          We'll still use what we know about you to find the best entry points.
                        </p>
                      </div>
                    )}
                  </div>
                  {sel && (
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 5l2 2 4-4"/></svg>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Avoid */}
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
            <span style={{ fontFamily: T.fontBody, fontSize: 12, fontWeight: 500, color: T.ink4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Anything to avoid?</span>
            <span style={{ fontFamily: T.fontBody, fontSize: 11, color: T.ink4 }}>optional</span>
          </div>
          <input
            type="text"
            value={avoid}
            onChange={(e) => setAvoid(e.target.value)}
            maxLength={200}
            placeholder="e.g. graphic content, portraits, very large crowds..."
            style={{
              width: '100%', padding: '12px 14px', borderRadius: T.rMd,
              fontFamily: T.fontBody, fontSize: 13, color: T.ink2,
              background: T.white, border: `0.5px solid ${T.border}`, outline: 'none',
            }}
          />
        </div>

        {buildError && (
          <p style={{ fontFamily: T.fontBody, fontSize: 13, color: T.pass, lineHeight: 1.5, marginBottom: 4 }}>
            {buildError}
          </p>
        )}
        <button
          onClick={handleBuild}
          disabled={building}
          style={{
            width: '100%', padding: '16px', borderRadius: T.rMd,
            background: T.accent, border: 'none', color: '#fff',
            fontFamily: T.fontBody, fontSize: 15, fontWeight: 500,
            cursor: building ? 'default' : 'pointer',
            opacity: building ? 0.7 : 1,
            letterSpacing: '-0.01em',
          }}
        >
          {building ? (llmConfig?.apiKey ? 'Curating your tour…' : 'Building your tour…') : 'Build my tour'}
        </button>
      </div>
    </div>
  )
}
