import { useState, useRef } from 'react'
import { T, iiif } from '../tokens.js'
import ProgressDots from '../components/ProgressDots.jsx'
import { useAppState } from '../state/useAppState.js'
import { supabase } from '../supabase.js'
import { generateOnboardingSummary, generateInitialProfile } from '../services/llm.js'

// Hardcoded AIC image IDs for movement tiles — specific artworks chosen for each movement
const STYLE_TILES = [
  { label: 'Impressionism',          imageId: 'f8fd76e9-c396-5678-36ed-6a348c904d27' }, // Paris Street; Rainy Day
  { label: 'Post-Impressionism',     imageId: '6644829f-f292-c5c4-a73c-0356a6fdbf0d' }, // The Bedroom
  { label: 'Pointillism',            imageId: '2d484387-2509-5e8e-2c43-22f9981972eb' }, // A Sunday on La Grande Jatte
  { label: 'Renaissance',            imageId: '108f44fc-d93b-abf0-c33c-2920d57844c3' }, // Rogier van der Weyden
  { label: 'Baroque',                imageId: 'a49c5ada-f461-d7d1-0f1b-468ac577a872' }, // The Resurrection
  { label: 'Neoclassicism',          imageId: '72227c9e-413c-8930-477d-5a90e0a2123c' }, // Madame de Pastoret — David
  { label: 'Romanticism',            imageId: '1299b0e5-6a3d-8039-087b-35bf03caea1a' }, // Lion Hunt
  { label: 'Art Nouveau',            imageId: '5e01af7c-033a-f1be-4d16-335c51283670' }, // Guimard Balustrade
  { label: 'Fauvism',                imageId: '6983bf9e-3cd8-c42d-4c91-cd646c97399c' }, // Collioure — Matisse
  { label: 'Expressionism',          imageId: '6829aab0-8d0e-9438-aebf-a1a379572951' }, // Bewitched Mill
  { label: 'Cubism',                 imageId: '4f7ccf9f-a8ce-2bd8-2d15-a38b2e6caa7a' }, // Portrait of Picasso — Gris
  { label: 'Dada',                   imageId: '49f33a38-6c65-3f45-620f-c0bc857166e5' }, // Marcel Duchamp, New York
  { label: 'Surrealism',             imageId: '91e4c46b-9ef3-ca78-148c-86845e457d88' }, // Time Transfixed
  { label: 'American Realism',       imageId: '831a05de-d3f6-f4fa-a460-23008dd58dda' }, // Nighthawks
  { label: 'Art Deco',               imageId: '40724c6b-da7a-056f-210b-8d9ddff252e7' }, // 1930s room
  { label: 'Abstract Expressionism', imageId: '33d04b6a-3ebe-f577-444c-969cb208ad8d' }, // City Landscape — Mitchell
  { label: 'Pop Art',                imageId: '97cb5c4b-cce5-c4d8-f303-613ce92832c7' }, // Mao — Warhol
  { label: 'Minimalism',             imageId: '5d202fb8-0167-a998-6abc-3804dece25ce' }, // Untitled — Donald Judd
  { label: 'Modernism',              imageId: '419ddce3-c90b-3d0c-43b3-73683a87bf98' }, // Bathers by a River — Matisse
  { label: 'Contemporary',           imageId: 'd94d0e3d-5d89-ce07-ee0f-7fa6d8def8ab' }, // Many Mansions — Marshall
  { label: 'Japanese Prints',        imageId: 'b3974542-b9b4-7568-fc4b-966738f61d78' }, // The Great Wave — Hokusai
  { label: 'African Art',            imageId: 'fec5d023-0b46-45df-eb57-cbf64e24121d' }, // Veranda Post — Olowe
]

const FAMILIARITY_OPTIONS = [
  { id: 'love',    icon: '♥', label: 'I know what I love',   sub: 'Show me more of it' },
  { id: 'explore', icon: '◎', label: "I'm still exploring",  sub: 'Help me find my eye' },
  { id: 'casual',  icon: '◌', label: 'Just passing through', sub: 'Keep it light' },
]

const THINK_ABOUT_GROUPS = [
  {
    label: 'The Individual & The Interior',
    themes: ['Identity', 'The Body', 'Memory', 'Nostalgia', 'Childhood', 'Dreams', 'Solitude', 'Desire'],
  },
  {
    label: 'Society, Power & Conflict',
    themes: ['Politics', 'Power', 'Rebellion', 'Social Justice', 'Human Rights', 'War', 'Exile', 'Labor'],
  },
  {
    label: 'The Collective & Connection',
    themes: ['Love', 'Belonging', 'City', 'Daily Life'],
  },
  {
    label: 'Existential & Philosophical',
    themes: ['Nature', 'Mortality', 'Grief', 'Spirituality', 'The Future', 'Chaos', 'Beauty'],
  },
]

const REGIONS  = ['Europe', 'East Asia', 'Americas', 'Africa', 'Middle East', 'South Asia', 'Oceania']
const MEDIUMS  = ['Painting', 'Sculpture', 'Photography', 'Textile', 'Works on paper', 'Video & digital', 'Drawing']

// ── Shared navigation buttons ────────────────────────────────────────────────
function BackButton({ onBack }) {
  return (
    <button onClick={onBack} style={{
      background: 'none', border: 'none', cursor: 'pointer',
      fontFamily: T.fontBody, fontSize: 13, color: T.ink4,
      padding: '6px 0', display: 'flex', alignItems: 'center', gap: 5,
    }}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={T.ink4} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 3L5 7l4 4"/>
      </svg>
      Back
    </button>
  )
}

function SkipAllLink({ onSkip }) {
  return (
    <button onClick={onSkip} style={{
      background: 'none', border: 'none', cursor: 'pointer',
      fontFamily: T.fontBody, fontSize: 13, color: T.ink4, padding: '6px 0',
    }}>skip all →</button>
  )
}

// ── Multi-range era timeline ─────────────────────────────────────────────────
function fmtYear(y) {
  if (y < 0) return `${Math.abs(y)} BCE`
  return String(y)
}

function EraTimeline({ eras, onChange }) {
  const MIN = -3000, MAX = 2026
  const SPLIT = 1000
  const PRE_FRACTION = 0.25
  const POST_FRACTION = 0.75
  const PRE_RANGE = SPLIT - MIN   // 4000 years
  const POST_RANGE = MAX - SPLIT  // 1026 years
  const trackRef = useRef()
  const [action, setAction] = useState(null)
  const MARKERS = [-3000, 1000, 1200, 1400, 1600, 1700, 1800, 1900, 2026]

  function pct(y) {
    if (y <= SPLIT) return (PRE_FRACTION * (y - MIN) / PRE_RANGE) * 100
    return (PRE_FRACTION + POST_FRACTION * (y - SPLIT) / POST_RANGE) * 100
  }
  function xPxFromYear(y) {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return 0
    return pct(y) / 100 * rect.width + rect.left
  }
  function yearFromX(x) {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return MIN
    const p = Math.max(0, Math.min(1, (x - rect.left) / rect.width))
    let year
    if (p <= PRE_FRACTION) {
      year = MIN + (p / PRE_FRACTION) * PRE_RANGE
    } else {
      year = SPLIT + ((p - PRE_FRACTION) / POST_FRACTION) * POST_RANGE
    }
    return Math.round(year / 10) * 10
  }

  function hasOverlap(candidate, excludeIdx = -1) {
    return eras.some((e, i) => i !== excludeIdx && candidate.from < e.to && candidate.to > e.from)
  }

  function onDown(e) {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const y = yearFromX(e.clientX)
    const SNAP_PX = 16

    for (let i = 0; i < eras.length; i++) {
      if (Math.abs(e.clientX - xPxFromYear(eras[i].from)) <= SNAP_PX) {
        setAction({ kind: 'resize', idx: i, edge: 'left', live: { ...eras[i] } })
        return
      }
      if (Math.abs(e.clientX - xPxFromYear(eras[i].to)) <= SNAP_PX) {
        setAction({ kind: 'resize', idx: i, edge: 'right', live: { ...eras[i] } })
        return
      }
    }
    // Don't start a new range inside an existing one
    if (eras.some(e => y > e.from && y < e.to)) return
    setAction({ kind: 'create', from: y, to: y })
  }

  function onMove(e) {
    if (!action) return
    const y = yearFromX(e.clientX)
    if (action.kind === 'create') {
      setAction(a => ({ ...a, to: y }))
    } else if (action.kind === 'resize') {
      const live = { ...action.live }
      if (action.edge === 'left') live.from = Math.max(MIN, Math.min(y, live.to - 20))
      else live.to = Math.min(MAX, Math.max(y, live.from + 20))
      setAction(a => ({ ...a, live }))
    }
  }

  function onUp() {
    if (!action) return
    if (action.kind === 'create') {
      const era = { from: Math.min(action.from, action.to), to: Math.max(action.from, action.to) }
      if (era.to - era.from >= 20 && !hasOverlap(era)) onChange([...eras, era])
    } else if (action.kind === 'resize') {
      if (!hasOverlap(action.live, action.idx)) {
        const next = [...eras]
        next[action.idx] = action.live
        onChange(next)
      }
    }
    setAction(null)
  }

  // Visual eras: apply live resize to the target segment
  const displayEras = eras.map((e, i) =>
    action?.kind === 'resize' && action.idx === i ? action.live : e
  )
  const liveCreate = action?.kind === 'create'
    ? { from: Math.min(action.from, action.to), to: Math.max(action.from, action.to) }
    : null
  const createConflict = liveCreate ? hasOverlap(liveCreate) : false

  return (
    <div>
      {/* Range chips */}
      {eras.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {eras.map((e, i) => {
            const live = action?.kind === 'resize' && action.idx === i ? action.live : e
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 10px', borderRadius: T.rPill,
                background: T.accentBg, border: `0.5px solid ${T.accent}`,
              }}>
                <span style={{ fontFamily: T.fontBody, fontSize: 12, color: T.accent, fontWeight: 500 }}>
                  {fmtYear(live.from)}–{fmtYear(live.to)}
                </span>
                <button onClick={() => onChange(eras.filter((_, j) => j !== i))} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: T.accent, fontSize: 15, padding: 0, lineHeight: 1, display: 'flex',
                }}>×</button>
              </div>
            )
          })}
        </div>
      )}

      {/* Track */}
      <div
        ref={trackRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        style={{
          position: 'relative', height: 28,
          background: T.bgSub, borderRadius: T.rPill,
          cursor: 'crosshair', touchAction: 'none', userSelect: 'none',
          overflow: 'hidden',
        }}
      >
        {displayEras.map((e, i) => (
          <div key={i} style={{
            position: 'absolute', top: 0, height: '100%',
            left: `${pct(e.from)}%`,
            width: `${Math.max(0.5, pct(e.to) - pct(e.from))}%`,
            background: T.accent,
            opacity: action?.kind === 'resize' && action.idx === i ? 1 : 0.85,
            borderRadius: T.rPill,
          }}>
            {/* Visual edge handles */}
            <div style={{ position: 'absolute', left: 5, top: '50%', transform: 'translateY(-50%)', width: 2, height: 12, background: 'rgba(255,255,255,0.55)', borderRadius: 1, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)', width: 2, height: 12, background: 'rgba(255,255,255,0.55)', borderRadius: 1, pointerEvents: 'none' }} />
          </div>
        ))}

        {/* Live create preview */}
        {liveCreate && (
          <div style={{
            position: 'absolute', top: 0, height: '100%',
            left: `${pct(liveCreate.from)}%`,
            width: `${Math.max(0.5, pct(liveCreate.to) - pct(liveCreate.from))}%`,
            background: createConflict ? T.pass : T.accent,
            opacity: 0.45, borderRadius: T.rPill, pointerEvents: 'none',
          }} />
        )}
        {liveCreate && !createConflict && liveCreate.to > liveCreate.from && (
          <div style={{
            position: 'absolute', top: '50%', transform: 'translateY(-50%)',
            left: `${pct(liveCreate.to)}%`,
            fontFamily: T.fontBody, fontSize: 9, color: T.white,
            fontWeight: 600, pointerEvents: 'none', whiteSpace: 'nowrap', paddingLeft: 4,
          }}>
            {fmtYear(liveCreate.from)}–{fmtYear(liveCreate.to)}
          </div>
        )}
      </div>

      {/* Proportionally-positioned year labels — first left-aligned, last right-aligned */}
      <div style={{ position: 'relative', height: 16, marginTop: 5 }}>
        {MARKERS.map((y, idx) => (
          <span key={y} style={{
            position: 'absolute',
            left: `${pct(y)}%`,
            transform: idx === 0 ? 'none' : idx === MARKERS.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
            fontFamily: T.fontBody, fontSize: 9, color: T.ink4,
            whiteSpace: 'nowrap', pointerEvents: 'none',
          }}>{fmtYear(y)}</span>
        ))}
      </div>

      {eras.length === 0 && !action && (
        <p style={{ fontFamily: T.fontBody, fontSize: 12, color: T.ink4, marginTop: 6, lineHeight: 1.5 }}>
          Drag on the bar to select an era (3000 BCE – 2026). Drag near an edge to resize a selection.
        </p>
      )}
    </div>
  )
}

// ── Step 0.5: API Key (step 9) ───────────────────────────────────────────────
function StepApiKey({ onNext, onBack, existingKey, onSave }) {
  const [keyInput, setKeyInput] = useState(existingKey || '')

  function handleContinue() {
    onSave(keyInput.trim())
    onNext()
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '32px 24px 28px' }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: T.fontDisplay, fontSize: 26, fontWeight: 500, lineHeight: 1.15, letterSpacing: '-0.018em', color: T.ink, marginBottom: 8 }}>
          Unlock your personal guide
        </div>
        <p style={{ fontFamily: T.fontBody, fontSize: 14, color: T.ink3, lineHeight: 1.65 }}>
          Docent uses AI to generate personalized narrations and build your taste profile. Add your Anthropic API key to get the full experience.
        </p>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: T.fontBody, fontSize: 12, color: T.ink3, marginBottom: 8 }}>Anthropic API Key</div>
        <input
          type="password"
          value={keyInput}
          onChange={e => setKeyInput(e.target.value)}
          placeholder="sk-ant-..."
          autoComplete="off"
          style={{
            width: '100%', padding: '12px 14px', borderRadius: T.rMd,
            border: `0.5px solid ${T.border}`, background: T.bgSub,
            fontFamily: T.fontBody, fontSize: 14, color: T.ink2, outline: 'none',
            marginBottom: 8, boxSizing: 'border-box',
          }}
        />
        <p style={{ fontFamily: T.fontBody, fontSize: 11, color: T.ink4, lineHeight: 1.5 }}>
          Get yours at console.anthropic.com · Stored securely in your profile and never shared.
        </p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 20 }}>
        <BackButton onBack={onBack} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => onNext()} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: T.fontBody, fontSize: 13, color: T.ink4, padding: '6px 0',
          }}>Skip for now</button>
          <button onClick={handleContinue} style={{
            padding: '12px 24px', borderRadius: T.rMd, background: T.accent, border: 'none',
            color: '#fff', fontFamily: T.fontBody, fontSize: 14, fontWeight: 500, cursor: 'pointer',
          }}>Continue →</button>
        </div>
      </div>
    </div>
  )
}

// ── Step 0: Welcome ──────────────────────────────────────────────────────────
function StepWelcome({ onNext, onFastTrack, onSkip }) {
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '48px 28px 32px' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontFamily: T.fontDisplay, fontSize: 13, fontWeight: 500, color: T.accent, letterSpacing: '0.04em', marginBottom: 40 }}>
          docent
        </div>
        <div style={{ fontFamily: T.fontDisplay, fontSize: 38, fontWeight: 500, lineHeight: 1.1, letterSpacing: '-0.02em', color: T.ink, marginBottom: 20 }}>
          Let's build<br /><em style={{ color: T.accent }}>your eye.</em>
        </div>
        <p style={{ fontFamily: T.fontBody, fontSize: 15, lineHeight: 1.7, color: T.ink3, maxWidth: 280 }}>
          A few quick questions so we can build a tour that actually matches how you see.
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button onClick={onNext} style={{ width: '100%', padding: '16px', borderRadius: T.rMd, background: T.accent, border: 'none', color: '#fff', fontFamily: T.fontBody, fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>
          Let's go
        </button>
        <button onClick={onFastTrack} style={{ width: '100%', padding: '16px', borderRadius: T.rMd, background: 'transparent', border: `0.5px solid ${T.border}`, color: T.ink2, fontFamily: T.fontBody, fontSize: 15, cursor: 'pointer' }}>
          I know exactly what I want
        </button>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
          <button onClick={onSkip} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: T.fontBody, fontSize: 13, color: T.ink4 }}>skip setup →</button>
        </div>
      </div>
    </div>
  )
}

// ── Step 1: Familiarity ──────────────────────────────────────────────────────
function StepFamiliarity({ onNext, onBack, value, onChange }) {
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '32px 24px 28px' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontFamily: T.fontDisplay, fontSize: 26, fontWeight: 500, lineHeight: 1.15, letterSpacing: '-0.018em', color: T.ink, marginBottom: 8 }}>
          How do you usually experience art?
        </div>
        <p style={{ fontFamily: T.fontBody, fontSize: 14, color: T.ink3, lineHeight: 1.5 }}>No wrong answers. This shapes how we guide you.</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        {FAMILIARITY_OPTIONS.map((opt) => {
          const sel = value === opt.id
          return (
            <button key={opt.id} onClick={() => onChange(opt.id)} style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '16px 18px', borderRadius: T.rLg,
              border: `${sel ? 1.5 : 0.5}px solid ${sel ? T.accent : T.border}`,
              background: sel ? T.accentBg : T.white,
              cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s ease',
            }}>
              <span style={{ fontSize: 22, width: 32, textAlign: 'center', flexShrink: 0, color: sel ? T.accent : T.ink3 }}>{opt.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: T.fontBody, fontSize: 14, fontWeight: 500, color: sel ? T.accent : T.ink, marginBottom: 2 }}>{opt.label}</div>
                <div style={{ fontFamily: T.fontBody, fontSize: 12, color: T.ink4 }}>{opt.sub}</div>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 20 }}>
        <BackButton onBack={onBack} />
        <button onClick={onNext} disabled={!value} style={{
          padding: '12px 24px', borderRadius: T.rMd,
          background: value ? T.accent : T.bgSub,
          border: 'none', color: value ? '#fff' : T.ink4,
          fontFamily: T.fontBody, fontSize: 14, fontWeight: 500,
          cursor: value ? 'pointer' : 'default', transition: 'all 0.15s ease',
        }}>Continue →</button>
      </div>
    </div>
  )
}

// ── Step 2: Styles (movements) ───────────────────────────────────────────────
function StepStyles({ onNext, onBack, selected, onToggle }) {

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '28px 20px 24px' }}>
      <div style={{ marginBottom: 20, flexShrink: 0 }}>
        <div style={{ fontFamily: T.fontDisplay, fontSize: 26, fontWeight: 500, lineHeight: 1.15, letterSpacing: '-0.018em', color: T.ink, marginBottom: 6 }}>Any movements that speak to you?</div>
        <p style={{ fontFamily: T.fontBody, fontSize: 13, color: T.ink3 }}>Tap any that feel right. Or skip.</p>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingBottom: 4 }}>
          {STYLE_TILES.map((tile) => {
            const sel = selected.includes(tile.label)
            return (
              <button key={tile.label} onClick={() => onToggle(tile.label)} style={{
                position: 'relative', borderRadius: T.rLg, overflow: 'hidden',
                border: `${sel ? 2 : 0.5}px solid ${sel ? T.accent : T.border}`,
                background: T.bgSub, cursor: 'pointer', aspectRatio: '1 / 1',
                transition: 'all 0.15s ease', padding: 0,
              }}>
                <img
                  src={iiif(tile.imageId, '600,')}
                  alt={tile.label}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                <div style={{
                  position: 'absolute', inset: 0,
                  background: sel ? 'rgba(12,136,139,0.55)' : 'linear-gradient(to top, rgba(10,8,6,0.72) 0%, transparent 55%)',
                  transition: 'all 0.15s ease',
                }} />
                {sel && (
                  <div style={{ position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: '50%', background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 5.5l2.5 2.5 4.5-4.5"/></svg>
                  </div>
                )}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '8px 10px' }}>
                  <div style={{ fontFamily: T.fontBody, fontSize: 11, fontWeight: 500, color: '#fff', lineHeight: 1.2 }}>{tile.label}</div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, flexShrink: 0 }}>
        <BackButton onBack={onBack} />
        <button onClick={onNext} style={{
          padding: '12px 24px', borderRadius: T.rMd, background: T.accent, border: 'none',
          color: '#fff', fontFamily: T.fontBody, fontSize: 14, fontWeight: 500, cursor: 'pointer',
        }}>{selected.length > 0 ? `${selected.length} selected →` : 'Continue →'}</button>
      </div>
    </div>
  )
}

// ── Step 3: Artists ──────────────────────────────────────────────────────────
function StepArtists({ onNext, onBack, value, onChange }) {
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '32px 24px 28px' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontFamily: T.fontDisplay, fontSize: 26, fontWeight: 500, lineHeight: 1.15, letterSpacing: '-0.018em', color: T.ink, marginBottom: 8 }}>
          Any artists or works on your mind?
        </div>
        <p style={{ fontFamily: T.fontBody, fontSize: 14, color: T.ink3, lineHeight: 1.6 }}>Even half-remembered names are fine. We'll figure it out.</p>
      </div>
      <div style={{ flex: 1 }}>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={600}
          placeholder={"Hopper, that painting with the diner at night...\nThe one with the sad couple from the 1930s\nAnything by a woman from Japan"}
          style={{
            width: '100%', minHeight: 160, padding: '14px 16px',
            fontFamily: T.fontBody, fontSize: 14, lineHeight: 1.65, color: T.ink2,
            background: T.white, border: `0.5px solid ${T.border}`,
            borderRadius: T.rLg, outline: 'none', resize: 'none',
          }}
        />
        <p style={{ fontFamily: T.fontBody, fontSize: 12, color: T.ink4, marginTop: 8, lineHeight: 1.5 }}>
          Vague descriptions, feelings, half-remembered images — all welcome.
        </p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 20 }}>
        <BackButton onBack={onBack} />
        <button onClick={onNext} style={{ padding: '12px 24px', borderRadius: T.rMd, background: T.accent, border: 'none', color: '#fff', fontFamily: T.fontBody, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>Continue →</button>
      </div>
    </div>
  )
}

// ── Step 4: Think About (themes) ─────────────────────────────────────────────
function StepThinkAbout({ onNext, onBack, selected, onToggle, freeText, onFreeText }) {
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '28px 24px 28px' }}>
      <div style={{ marginBottom: 20, flexShrink: 0 }}>
        <div style={{ fontFamily: T.fontDisplay, fontSize: 26, fontWeight: 500, lineHeight: 1.15, letterSpacing: '-0.018em', color: T.ink, marginBottom: 8 }}>
          What do you want art to make you think about?
        </div>
        <p style={{ fontFamily: T.fontBody, fontSize: 14, color: T.ink3 }}>Pick any that resonate.</p>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {THINK_ABOUT_GROUPS.map((group) => (
          <div key={group.label} style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: T.fontBody, fontSize: 11, fontWeight: 500, color: T.ink4, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
              {group.label}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {group.themes.map((theme) => {
                const sel = selected.includes(theme)
                return (
                  <button key={theme} onClick={() => onToggle(theme)} style={{
                    padding: '8px 14px', borderRadius: T.rPill,
                    border: `${sel ? 1.5 : 0.5}px solid ${sel ? T.accent : T.border}`,
                    background: sel ? T.accentBg : T.white,
                    fontFamily: T.fontBody, fontSize: 13, fontWeight: sel ? 500 : 400,
                    color: sel ? T.accent : T.ink2, cursor: 'pointer', transition: 'all 0.15s ease',
                  }}>{theme}</button>
                )
              })}
            </div>
          </div>
        ))}

        {/* Free text */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontFamily: T.fontBody, fontSize: 11, fontWeight: 500, color: T.ink4, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
            Something else?
          </div>
          <input
            type="text"
            value={freeText}
            onChange={e => onFreeText(e.target.value)}
            placeholder="Type anything on your mind…"
            style={{
              width: '100%', padding: '11px 14px', borderRadius: T.rMd,
              border: `0.5px solid ${T.border}`, background: T.white,
              fontFamily: T.fontBody, fontSize: 13, color: T.ink2, outline: 'none',
            }}
          />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, flexShrink: 0 }}>
        <BackButton onBack={onBack} />
        <button onClick={onNext} style={{ padding: '12px 24px', borderRadius: T.rMd, background: T.accent, border: 'none', color: '#fff', fontFamily: T.fontBody, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
          {selected.length > 0 ? `${selected.length} picked →` : 'Continue →'}
        </button>
      </div>
    </div>
  )
}

// ── Step 5: Deeper ───────────────────────────────────────────────────────────
function StepDeeper({ onNext, onBack, state, onUpdate }) {
  const [expanded, setExpanded] = useState(false)
  const pill = (label, sel, onClick) => (
    <button key={label} onClick={onClick} style={{
      padding: '7px 13px', borderRadius: T.rPill,
      border: `${sel ? 1.5 : 0.5}px solid ${sel ? T.accent : T.border}`,
      background: sel ? T.accentBg : T.white,
      fontFamily: T.fontBody, fontSize: 12, fontWeight: sel ? 500 : 400,
      color: sel ? T.accent : T.ink2, cursor: 'pointer',
    }}>{label}</button>
  )

  if (!expanded) {
    return (
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '48px 28px 32px', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ fontFamily: T.fontDisplay, fontSize: 26, fontWeight: 500, letterSpacing: '-0.018em', color: T.ink, marginBottom: 12 }}>Optional: go deeper</div>
        <p style={{ fontFamily: T.fontBody, fontSize: 14, color: T.ink3, lineHeight: 1.65, marginBottom: 40, maxWidth: 260 }}>
          Era, geography, medium. Skip if you don't care — we'll figure it out from your taste.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
          <button onClick={() => setExpanded(true)} style={{ padding: '14px', borderRadius: T.rMd, background: T.white, border: `0.5px solid ${T.border}`, fontFamily: T.fontBody, fontSize: 14, fontWeight: 500, color: T.ink2, cursor: 'pointer' }}>
            Yes, let me refine →
          </button>
          <button onClick={onNext} style={{ padding: '14px', borderRadius: T.rMd, background: T.accent, border: 'none', color: '#fff', fontFamily: T.fontBody, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
            Skip this section
          </button>
        </div>
        <div style={{ paddingTop: 20 }}>
          <BackButton onBack={onBack} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '28px 24px 24px' }}>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {/* Era multi-range */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: T.fontBody, fontSize: 12, fontWeight: 500, color: T.ink4, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Era</div>
          <EraTimeline
            eras={state.eras}
            onChange={(eras) => onUpdate('eras', eras)}
          />
        </div>

        {/* Regions */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: T.fontBody, fontSize: 12, fontWeight: 500, color: T.ink4, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Geography</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {REGIONS.map((r) => pill(r, state.regions.includes(r), () => onUpdate('regions', state.regions.includes(r) ? state.regions.filter((x) => x !== r) : [...state.regions, r])))}
          </div>
        </div>

        {/* Mediums */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: T.fontBody, fontSize: 12, fontWeight: 500, color: T.ink4, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Medium</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {MEDIUMS.map((m) => pill(m, state.mediums.includes(m), () => onUpdate('mediums', state.mediums.includes(m) ? state.mediums.filter((x) => x !== m) : [...state.mediums, m])))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4, flexShrink: 0 }}>
        <BackButton onBack={onBack} />
        <button onClick={onNext} style={{ padding: '12px 24px', borderRadius: T.rMd, background: T.accent, border: 'none', color: '#fff', fontFamily: T.fontBody, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>Continue →</button>
      </div>
    </div>
  )
}

// ── Step 6: Wildcard ─────────────────────────────────────────────────────────
function StepWildcard({ onNext, onBack, value, onChange }) {
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '32px 24px 28px' }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: T.fontDisplay, fontSize: 26, fontWeight: 500, lineHeight: 1.15, letterSpacing: '-0.018em', color: T.ink, marginBottom: 8 }}>Anything else?</div>
        <p style={{ fontFamily: T.fontBody, fontSize: 14, color: T.ink3, lineHeight: 1.65 }}>
          Describe the experience you're hoping for. Or the mood you're in. Or nothing at all.
        </p>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={600}
        placeholder={"I want to feel something I can't name.\nI'm here with my daughter and we want to be moved.\nI've been thinking about loss a lot lately."}
        style={{
          flex: 1, padding: '14px 16px', fontFamily: T.fontBody, fontSize: 14,
          lineHeight: 1.7, color: T.ink2, background: T.white,
          border: `0.5px solid ${T.border}`, borderRadius: T.rLg, outline: 'none', resize: 'none',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 20 }}>
        <BackButton onBack={onBack} />
        <button onClick={onNext} style={{ padding: '12px 24px', borderRadius: T.rMd, background: T.accent, border: 'none', color: '#fff', fontFamily: T.fontBody, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>Done →</button>
      </div>
    </div>
  )
}

// ── Step 7: Fast-track ───────────────────────────────────────────────────────
function StepFastTrack({ onNext, onBack, value, onChange }) {
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '32px 24px 28px' }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: T.fontDisplay, fontSize: 26, fontWeight: 500, lineHeight: 1.15, letterSpacing: '-0.018em', color: T.ink, marginBottom: 8 }}>What are you here for?</div>
        <p style={{ fontFamily: T.fontBody, fontSize: 14, color: T.ink3, lineHeight: 1.65 }}>Tell us exactly what you want. We'll build around it.</p>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={800}
        placeholder={"I want to see the Seurat and then whatever's near it that I'd regret missing.\nI only have 45 minutes and I want something that'll stay with me."}
        style={{
          flex: 1, padding: '14px 16px', fontFamily: T.fontBody, fontSize: 14,
          lineHeight: 1.7, color: T.ink2, background: T.white,
          border: `0.5px solid ${T.border}`, borderRadius: T.rLg, outline: 'none', resize: 'none',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 20 }}>
        <BackButton onBack={onBack} />
        <button onClick={onNext} style={{ padding: '12px 24px', borderRadius: T.rMd, background: T.accent, border: 'none', color: '#fff', fontFamily: T.fontBody, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>Build my tour →</button>
      </div>
    </div>
  )
}

// ── Step 8: Complete ─────────────────────────────────────────────────────────
function StepComplete({ onDiscover, onTour, summary }) {
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '48px 28px 36px' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%', background: T.accentBg,
          border: `0.5px solid rgba(12,136,139,0.2)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 28,
        }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="9"/>
            <path d="M7 11l3 3 5-5"/>
          </svg>
        </div>
        <div style={{ fontFamily: T.fontDisplay, fontSize: 32, fontWeight: 500, lineHeight: 1.1, letterSpacing: '-0.02em', color: T.ink, marginBottom: 20 }}>
          We're ready.
        </div>
        <div style={{ background: T.white, border: `0.5px solid ${T.border}`, borderRadius: T.rLg, padding: '18px 20px', borderLeft: `3px solid ${T.accent}`, marginBottom: 32 }}>
          <div style={{ fontFamily: T.fontBody, fontSize: 11, fontWeight: 500, color: T.ink4, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>What we heard</div>
          <p style={{ fontFamily: T.fontBody, fontSize: 14, lineHeight: 1.7, color: T.ink2 }}>{summary || "You're drawn to art that moves quietly and holds something real. We've got a strong read on what to show you."}</p>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button onClick={onTour} style={{ width: '100%', padding: '15px', borderRadius: T.rMd, background: T.accent, border: 'none', color: '#fff', fontFamily: T.fontBody, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
          Go straight to my tour
        </button>
        <button onClick={onDiscover} style={{ width: '100%', padding: '15px', borderRadius: T.rMd, background: 'transparent', border: `0.5px solid ${T.border}`, color: T.ink2, fontFamily: T.fontBody, fontSize: 14, cursor: 'pointer' }}>
          Start swiping first
        </button>
      </div>
    </div>
  )
}

// ── Main container ────────────────────────────────────────────────────────────
export default function OnboardingFlow({ onComplete }) {
  const { setOnboardingData, setTasteProfile, tasteProfile, llmConfig, setLlmConfig, user } = useAppState()
  const TOTAL_DOTS = 7

  const [step, setStep] = useState(0)
  const [stepHistory, setStepHistory] = useState([])
  const [fastTrack, setFastTrack] = useState(false)
  const [familiarity, setFamiliarity] = useState(null)
  const [styles, setStyles] = useState([])
  const [artists, setArtists] = useState('')
  const [themes, setThemes] = useState([])
  const [themeText, setThemeText] = useState('')
  const [deeper, setDeeper] = useState({ eras: [], regions: [], mediums: [] })
  const [wildcard, setWildcard] = useState('')
  const [fastText, setFastText] = useState('')
  const [summary, setSummary] = useState('')

  function goTo(nextStep) {
    setStepHistory(prev => [...prev, step])
    setStep(nextStep)
  }
  function goBack() {
    if (stepHistory.length === 0) return
    const prev = stepHistory[stepHistory.length - 1]
    setStepHistory(h => h.slice(0, -1))
    setStep(prev)
  }

  const toggleStyle = (s) => setStyles((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s])
  const toggleTheme = (t) => setThemes((p) => p.includes(t) ? p.filter((x) => x !== t) : [...p, t])
  const updateDeeper = (key, val) => setDeeper((p) => ({ ...p, [key]: val }))

  function buildOnboardingData() {
    return {
      styles, artists, themes, themeText,
      decadeRange: deeper.eras.length > 0
        ? [Math.min(...deeper.eras.map(e => e.from)), Math.max(...deeper.eras.map(e => e.to))]
        : [-3000, 2026],
      eras: deeper.eras,
      regions: deeper.regions,
      mediums: deeper.mediums,
      freetext: wildcard,
      familiarity,
    }
  }

  async function handleComplete(destination) {
    const data = buildOnboardingData()
    setOnboardingData(data)
    try {
      if (llmConfig?.apiKey) {
        const s = await generateOnboardingSummary(llmConfig, data)
        setSummary(s)
      }
    } catch {}
    setStep(8)
    return destination
  }

  async function handleFastTrackComplete() {
    const data = { freetext: fastText, fastTrack: true }
    setOnboardingData(data)
    if (llmConfig?.apiKey && fastText) {
      try {
        const profileText = await generateInitialProfile(llmConfig, data, fastText)
        setTasteProfile(typeof profileText === 'string' ? JSON.parse(profileText.match(/\{[\s\S]*\}/)?.[0] || '{}') : profileText)
      } catch {}
    }
    // Ensure tasteProfile is always set so the returning-user flow works on next login
    if (!tasteProfile) {
      setTasteProfile({ summary: fastText?.slice(0, 300) || 'General art interest', movements: [], themes: [], patternStrength: 0 })
    }
    setStep(8)
  }

  const skip = () => {
    const data = buildOnboardingData()
    setOnboardingData(data)
    try {
      if (user) {
        supabase.from('profiles').upsert({
          id: user.id,
          onboarding_data: data,
          taste_profile: tasteProfile || { onboardingSkipped: true },
          updated_at: new Date().toISOString(),
        }).then(() => {}, () => {})
      }
    } catch {}
    onComplete('tour')
  }

  function handleApiKeySave(apiKey) {
    if (!apiKey) return
    const config = { provider: 'anthropic', apiKey }
    setLlmConfig(config)
    if (user) {
      supabase.from('profiles').upsert({
        id: user.id,
        llm_config: config,
        updated_at: new Date().toISOString(),
      }).then(() => {}, () => {})
    }
  }

  const showHeader = step > 0 && step < 8

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: T.bg, overflow: 'hidden' }}>
      {showHeader && (
        <div style={{ padding: '16px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <ProgressDots total={TOTAL_DOTS} current={Math.min(step - 1, TOTAL_DOTS - 1)} />
          {!fastTrack && <SkipAllLink onSkip={skip} />}
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {step === 0  && <StepWelcome onNext={() => goTo(llmConfig?.apiKey ? 1 : 9)} onFastTrack={() => { setFastTrack(true); goTo(10) }} onSkip={skip} />}
        {step === 9  && <StepApiKey onNext={() => goTo(1)} onBack={goBack} existingKey={llmConfig?.apiKey} onSave={handleApiKeySave} />}
        {step === 1  && <StepFamiliarity onNext={() => goTo(2)} onBack={goBack} value={familiarity} onChange={setFamiliarity} />}
        {step === 2  && <StepStyles onNext={() => goTo(3)} onBack={goBack} selected={styles} onToggle={toggleStyle} />}
        {step === 3  && <StepArtists onNext={() => goTo(4)} onBack={goBack} value={artists} onChange={setArtists} />}
        {step === 4  && <StepThinkAbout onNext={() => goTo(5)} onBack={goBack} selected={themes} onToggle={toggleTheme} freeText={themeText} onFreeText={setThemeText} />}
        {step === 5  && <StepDeeper onNext={() => handleComplete('discover')} onBack={goBack} state={deeper} onUpdate={updateDeeper} />}
        {step === 6  && <StepWildcard onNext={() => handleComplete('discover')} onBack={goBack} value={wildcard} onChange={setWildcard} />}
        {step === 8  && <StepComplete summary={summary} onDiscover={() => onComplete('discover')} onTour={() => onComplete('tour')} />}
        {step === 10 && <StepFastTrack onNext={handleFastTrackComplete} onBack={goBack} value={fastText} onChange={setFastText} />}
      </div>
    </div>
  )
}
