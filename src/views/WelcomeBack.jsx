import { T } from '../tokens.js'
import { useAppState } from '../state/useAppState.js'

export default function WelcomeBack({ onContinue, onRebuild, onScratch }) {
  const { tasteProfile, itinerary } = useAppState()

  const stopCount = itinerary ? itinerary.stops.flatMap((g) => g.stops).length : 0
  const galleryCount = itinerary ? itinerary.stops.length : 0
  const minutes = itinerary?.totalMinutes ?? 0
  const hasTour = itinerary && stopCount > 0

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: T.bg, padding: '48px 28px 36px' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontFamily: T.fontDisplay, fontSize: 13, fontWeight: 500, color: T.accent, letterSpacing: '0.04em', marginBottom: 40 }}>
          docent
        </div>
        <div style={{ fontFamily: T.fontDisplay, fontSize: 34, fontWeight: 500, lineHeight: 1.1, letterSpacing: '-0.02em', color: T.ink, marginBottom: 16 }}>
          Welcome back.
        </div>
        {hasTour && (
          <div style={{
            background: T.white, border: `0.5px solid ${T.border}`,
            borderRadius: T.rLg, padding: '14px 16px',
            borderLeft: `3px solid ${T.accent}`, marginBottom: 12,
          }}>
            <div style={{ fontFamily: T.fontBody, fontSize: 11, fontWeight: 500, color: T.ink4, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Your last tour</div>
            <p style={{ fontFamily: T.fontBody, fontSize: 13, lineHeight: 1.65, color: T.ink2 }}>
              {stopCount} {stopCount === 1 ? 'stop' : 'stops'} · {galleryCount} {galleryCount === 1 ? 'gallery' : 'galleries'} · {minutes} min
            </p>
          </div>
        )}
        {tasteProfile?.summary ? (
          <div style={{
            background: T.white, border: `0.5px solid ${T.border}`,
            borderRadius: T.rLg, padding: '14px 16px',
            borderLeft: `3px solid ${T.accent}`, marginBottom: 32,
          }}>
            <div style={{ fontFamily: T.fontBody, fontSize: 11, fontWeight: 500, color: T.ink4, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Your taste profile</div>
            <p style={{ fontFamily: T.fontBody, fontSize: 13, lineHeight: 1.65, color: T.ink2 }}>
              {tasteProfile.summary}
            </p>
          </div>
        ) : (
          <p style={{ fontFamily: T.fontBody, fontSize: 15, lineHeight: 1.7, color: T.ink3, marginBottom: 32, maxWidth: 280 }}>
            You've been here before. Pick up where you left off or start fresh.
          </p>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {hasTour && (
          <button
            onClick={onContinue}
            style={{ width: '100%', padding: '16px', borderRadius: T.rMd, background: T.accent, border: 'none', color: '#fff', fontFamily: T.fontBody, fontSize: 15, fontWeight: 500, cursor: 'pointer' }}
          >
            Continue my tour →
          </button>
        )}
        <button
          onClick={onRebuild}
          style={{
            width: '100%', padding: '16px', borderRadius: T.rMd,
            background: hasTour ? 'transparent' : T.accent,
            border: hasTour ? `0.5px solid ${T.border}` : 'none',
            color: hasTour ? T.ink2 : '#fff',
            fontFamily: T.fontBody, fontSize: 15, fontWeight: hasTour ? 400 : 500, cursor: 'pointer',
          }}
        >
          Build a new tour with my existing taste
        </button>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
          <button
            onClick={onScratch}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: T.fontBody, fontSize: 13, color: T.ink4 }}
          >
            Rebuild my preferences from scratch
          </button>
        </div>
      </div>
    </div>
  )
}
