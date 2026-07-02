import { useState, useRef } from 'react'
import { T, iiif } from '../tokens.js'
import { useAppState } from '../state/useAppState.js'
import DiscoverySheet from '../components/DiscoverySheet.jsx'
import { searchArtworks } from '../services/aic.js'
import { answerQuestion } from '../services/llm.js'

function fmtDate(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function artworkToStop(artwork) {
  return {
    id: artwork.id,
    artworkId: artwork.id,
    title: artwork.title,
    artist: artwork.artist_display?.split('\n')[0] || '',
    year: artwork.date_display || '',
    imageId: artwork.image_id,
    dominantColor: artwork.color ? `hsl(${artwork.color.h},${artwork.color.s}%,${artwork.color.l}%)` : T.ink4,
    gallery: artwork.gallery_title || '',
    floor: 1,
    estimatedMinutes: 2,
    completed: false,
    narration: null,
  }
}

// ── AI Add popup ─────────────────────────────────────────────────────────────
function AiAddPopup({ onClose, onAdd, llmConfig }) {
  const [prompt, setPrompt] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')

  async function handleSearch() {
    if (!prompt.trim()) return
    setSearching(true)
    setError('')
    setResults(null)
    try {
      let keywords = prompt
      if (llmConfig?.apiKey) {
        try {
          const suggestion = await answerQuestion(
            llmConfig,
            { title: 'AIC Collection', artist_display: '', medium_display: '' },
            `The user wants to find artwork matching: "${prompt}". Reply with only 3-5 AIC-searchable keywords (style, medium, artist name, era, subject) as a comma-separated list. Nothing else.`
          )
          keywords = suggestion.trim()
        } catch {}
      }
      const artworks = await searchArtworks(keywords, 6)
      setResults(artworks)
    } catch {
      setError('Search failed. Try different keywords.')
    } finally {
      setSearching(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(10,8,6,0.5)' }} />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: T.white, borderRadius: `${T.rXl} ${T.rXl} 0 0`,
        padding: '24px 20px 40px', maxHeight: '80vh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ fontFamily: T.fontDisplay, fontSize: 20, fontWeight: 500, color: T.ink, marginBottom: 6 }}>
          Ask Docent to add a work
        </div>
        <p style={{ fontFamily: T.fontBody, fontSize: 13, color: T.ink3, marginBottom: 16, lineHeight: 1.5 }}>
          Describe what you're hoping to see — a feeling, style, artist, or subject. Docent will find it in the collection.
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexShrink: 0 }}>
          <input
            type="text"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="e.g. something melancholy with muted colors, 1900s…"
            autoFocus
            style={{
              flex: 1, padding: '11px 14px', borderRadius: T.rMd,
              border: `0.5px solid ${T.border}`, background: T.bgSub,
              fontFamily: T.fontBody, fontSize: 13, color: T.ink2, outline: 'none',
            }}
          />
          <button
            onClick={handleSearch}
            disabled={searching || !prompt.trim()}
            style={{
              padding: '11px 18px', borderRadius: T.rMd,
              background: T.accent, border: 'none', color: '#fff',
              fontFamily: T.fontBody, fontSize: 13, fontWeight: 500,
              cursor: searching ? 'default' : 'pointer', opacity: !prompt.trim() ? 0.5 : 1,
              flexShrink: 0,
            }}
          >
            {searching ? '…' : 'Find'}
          </button>
        </div>

        {error && <p style={{ fontFamily: T.fontBody, fontSize: 13, color: T.pass, marginBottom: 12 }}>{error}</p>}

        {results !== null && (
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {results.length === 0 ? (
              <p style={{ fontFamily: T.fontBody, fontSize: 13, color: T.ink4, textAlign: 'center', padding: '20px 0' }}>No matches. Try different words.</p>
            ) : (
              results.map(artwork => (
                <div key={artwork.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 0', borderBottom: `0.5px solid ${T.border}`,
                }}>
                  <div style={{ width: 52, height: 52, borderRadius: T.rMd, overflow: 'hidden', flexShrink: 0, background: T.bgSub }}>
                    {artwork.image_id && <img src={iiif(artwork.image_id, '200,')} alt={artwork.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: T.fontBody, fontSize: 13, fontWeight: 500, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{artwork.title}</div>
                    <div style={{ fontFamily: T.fontBody, fontSize: 12, color: T.ink3 }}>{artwork.artist_display?.split('\n')[0]}</div>
                    {artwork.style_title && <div style={{ fontFamily: T.fontBody, fontSize: 11, color: T.ink4 }}>{artwork.style_title}</div>}
                  </div>
                  <button
                    onClick={() => { onAdd(artworkToStop(artwork)); onClose() }}
                    style={{
                      padding: '8px 14px', borderRadius: T.rMd,
                      background: T.accentBg, border: `0.5px solid ${T.accent}`,
                      fontFamily: T.fontBody, fontSize: 12, fontWeight: 500,
                      color: T.accent, cursor: 'pointer', flexShrink: 0,
                    }}
                  >+ Add</button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Search Add sheet ─────────────────────────────────────────────────────────
function SearchAddSheet({ onClose, onAdd }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef()

  function handleChange(val) {
    setQuery(val)
    clearTimeout(debounceRef.current)
    if (!val.trim()) { setResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await searchArtworks(val, 8)
        setResults(res)
      } catch {}
      setLoading(false)
    }, 400)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(10,8,6,0.5)' }} />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: T.white, borderRadius: `${T.rXl} ${T.rXl} 0 0`,
        padding: '20px 20px 40px', maxHeight: '80vh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ fontFamily: T.fontDisplay, fontSize: 20, fontWeight: 500, color: T.ink, marginBottom: 14 }}>Search collection</div>
        <div style={{ position: 'relative', marginBottom: 16, flexShrink: 0 }}>
          <input
            type="text"
            value={query}
            onChange={e => handleChange(e.target.value)}
            placeholder="Artist, title, style, subject…"
            autoFocus
            style={{
              width: '100%', padding: '11px 14px', borderRadius: T.rMd,
              border: `0.5px solid ${T.border}`, background: T.bgSub,
              fontFamily: T.fontBody, fontSize: 13, color: T.ink2, outline: 'none',
            }}
          />
          {loading && (
            <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, border: `2px solid ${T.border}`, borderTopColor: T.accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          )}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {results.map(artwork => (
            <div key={artwork.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 0', borderBottom: `0.5px solid ${T.border}`,
            }}>
              <div style={{ width: 52, height: 52, borderRadius: T.rMd, overflow: 'hidden', flexShrink: 0, background: T.bgSub }}>
                {artwork.image_id && <img src={iiif(artwork.image_id, '200,')} alt={artwork.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: T.fontBody, fontSize: 13, fontWeight: 500, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{artwork.title}</div>
                <div style={{ fontFamily: T.fontBody, fontSize: 12, color: T.ink3 }}>{artwork.artist_display?.split('\n')[0]}</div>
              </div>
              <button
                onClick={() => { onAdd(artworkToStop(artwork)); onClose() }}
                style={{
                  padding: '8px 14px', borderRadius: T.rMd,
                  background: T.accentBg, border: `0.5px solid ${T.accent}`,
                  fontFamily: T.fontBody, fontSize: 12, fontWeight: 500,
                  color: T.accent, cursor: 'pointer', flexShrink: 0,
                }}
              >+ Add</button>
            </div>
          ))}
          {!loading && query && results.length === 0 && (
            <p style={{ fontFamily: T.fontBody, fontSize: 13, color: T.ink4, textAlign: 'center', padding: '24px 0' }}>No results. Try a different search.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Planner ─────────────────────────────────────────────────────────────
export default function Planner({ onSelectStop, onNavigate }) {
  const { itinerary, deleteStop, addStopToItinerary, saveTour, savedTours, llmConfig } = useAppState()
  const [briefOpen, setBriefOpen] = useState(true)
  const [searchOpen, setSearchOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)

  if (!itinerary) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: T.bg, padding: 40 }}>
        <p style={{ fontFamily: T.fontBody, fontSize: 15, color: T.ink3, textAlign: 'center' }}>No tour yet. Build one to get started.</p>
        <button onClick={() => onNavigate('intent')} style={{ padding: '14px 28px', borderRadius: T.rMd, background: T.accent, border: 'none', color: '#fff', fontFamily: T.fontBody, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
          Build my tour
        </button>
      </div>
    )
  }

  const allStops = itinerary.stops.flatMap((g) => g.stops)
  const completed = allStops.filter((s) => s.completed).length
  const total = allStops.length
  const totalMin = allStops.reduce((sum, s) => sum + s.estimatedMinutes, 0)
  const progress = total > 0 ? completed / total : 0
  const isSaved = savedTours?.some((t) => t.builtAt === itinerary.builtAt)

  let stopCounter = 0

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: T.bg, overflow: 'hidden', position: 'relative' }}>
      {/* Sticky header */}
      <div style={{ flexShrink: 0, background: T.white, borderBottom: `0.5px solid ${T.border}` }}>
        <div style={{ padding: '12px 20px 14px', paddingRight: 64 }}>
          {/* Title + save */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 500, letterSpacing: '-0.015em', color: T.ink }}>Your tour</div>
            <button
              onClick={() => saveTour()}
              disabled={isSaved}
              style={{
                padding: '7px 14px', borderRadius: T.rPill,
                background: isSaved ? T.bgSub : T.ink,
                border: `0.5px solid ${isSaved ? T.border : 'transparent'}`,
                fontFamily: T.fontBody, fontSize: 12, fontWeight: 500,
                color: isSaved ? T.ink4 : '#fff',
                cursor: isSaved ? 'default' : 'pointer',
              }}
            >
              {isSaved ? '✓ Saved' : 'Save tour'}
            </button>
          </div>

          {/* Date + stats row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10, flexWrap: 'wrap' }}>
            {itinerary.builtAt && (
              <span style={{ fontFamily: T.fontBody, fontSize: 11, color: T.ink4 }}>
                {fmtDate(itinerary.builtAt)}
              </span>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke={T.ink3} strokeWidth="1.3" strokeLinecap="round"><circle cx="7" cy="7" r="5.5"/><path d="M7 4v3l2 1.5"/></svg>
              <span style={{ fontFamily: T.fontBody, fontSize: 12, color: T.ink3 }}>{totalMin} min</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke={T.ink3} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><rect x="1.5" y="1.5" width="11" height="11" rx="2"/><path d="M4 7l2 2 4-4"/></svg>
              <span style={{ fontFamily: T.fontBody, fontSize: 12, color: T.ink3 }}>{completed}/{total} stops</span>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ height: 3, background: T.bgSub, borderRadius: T.rPill, overflow: 'hidden', marginBottom: itinerary.brief ? 10 : 0 }}>
            <div style={{ height: '100%', width: `${progress * 100}%`, background: T.accent, borderRadius: T.rPill, transition: 'width 0.4s ease' }} />
          </div>

          {/* Collapsible brief */}
          {itinerary.brief && (
            <div>
              <button
                onClick={() => setBriefOpen(o => !o)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 5, padding: 0,
                  fontFamily: T.fontBody, fontSize: 11, color: T.ink4,
                }}
              >
                <svg
                  width="10" height="10" viewBox="0 0 12 12" fill="none"
                  stroke={T.ink4} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transform: briefOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                >
                  <path d="M4 2l4 4-4 4"/>
                </svg>
                {briefOpen ? 'Hide summary' : 'About this tour'}
              </button>
              {briefOpen && (
                <p style={{ fontFamily: T.fontBody, fontSize: 12, color: T.ink3, lineHeight: 1.65, marginTop: 8, paddingLeft: 15 }}>
                  {itinerary.brief}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Scrollable stop list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0 110px' }}>
        {itinerary.stops.map((group, gi) => {
          return (
            <div key={gi} style={{ marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px 8px' }}>
                <div style={{ fontFamily: T.fontBody, fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.ink4 }}>Floor {group.floor}</div>
                <div style={{ flex: 1, height: '0.5px', background: T.border }} />
                <div style={{ fontFamily: T.fontBody, fontSize: 11, color: T.ink3 }}>{group.gallery}</div>
              </div>
              {group.stops.map((stop) => {
                stopCounter++
                const num = stopCounter
                return (
                  <div
                    key={stop.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px',
                      background: stop.completed ? 'transparent' : T.white,
                      borderBottom: `0.5px solid ${T.border}`,
                      opacity: stop.completed ? 0.55 : 1,
                    }}
                  >
                    {/* Number bubble */}
                    <div onClick={() => onSelectStop(stop)} style={{
                      width: 24, height: 24, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
                      background: stop.completed ? T.bgSub : T.accentBg,
                      border: `0.5px solid ${stop.completed ? T.border : 'rgba(12,136,139,0.2)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {stop.completed
                        ? <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke={T.ink4} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 5l2 2 4-4"/></svg>
                        : <span style={{ fontFamily: T.fontBody, fontSize: 10, fontWeight: 500, color: T.accent }}>{num}</span>
                      }
                    </div>

                    {/* Thumb */}
                    <div onClick={() => onSelectStop(stop)} style={{ width: 52, height: 52, borderRadius: T.rMd, overflow: 'hidden', flexShrink: 0, background: (stop.dominantColor || T.ink4) + '33', border: `0.5px solid ${T.border}`, cursor: 'pointer' }}>
                      {stop.imageId && <img src={iiif(stop.imageId, '200,')} alt={stop.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>

                    {/* Info */}
                    <div onClick={() => onSelectStop(stop)} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
                      <div style={{ fontFamily: T.fontBody, fontSize: 13, fontWeight: 500, color: T.ink, lineHeight: 1.3, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stop.title}</div>
                      <div style={{ fontFamily: T.fontBody, fontSize: 12, color: T.ink3, marginBottom: 4 }}>{stop.artist} · {stop.year}</div>
                      <span style={{ fontFamily: T.fontBody, fontSize: 11, color: T.ink4 }}>{stop.estimatedMinutes} min</span>
                    </div>

                    {/* Delete × */}
                    <button
                      onClick={() => deleteStop(stop.id)}
                      style={{
                        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                        background: 'none', border: `0.5px solid ${T.border}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke={T.ink4} strokeWidth="1.5" strokeLinecap="round"><path d="M2 2l6 6M8 2L2 8"/></svg>
                    </button>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Bottom add bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '12px 20px 28px',
        background: `linear-gradient(to top, ${T.bg} 65%, transparent)`,
        display: 'flex', gap: 10, zIndex: 20,
      }}>
        <button
          onClick={() => setSearchOpen(true)}
          style={{
            flex: 1, padding: '12px', borderRadius: T.rMd,
            background: T.white, border: `0.5px solid ${T.border}`,
            fontFamily: T.fontBody, fontSize: 13, fontWeight: 500,
            color: T.ink2, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={T.ink3} strokeWidth="1.4" strokeLinecap="round"><circle cx="6" cy="6" r="4.5"/><path d="M10.5 10.5l2.5 2.5"/></svg>
          Search
        </button>
        <button
          onClick={() => setAiOpen(true)}
          style={{
            flex: 1, padding: '12px', borderRadius: T.rMd,
            background: T.ink, border: 'none',
            fontFamily: T.fontBody, fontSize: 13, fontWeight: 500,
            color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="white"><polygon points="2,1 12,7 2,13"/></svg>
          Ask Docent
        </button>
      </div>

      {searchOpen && <SearchAddSheet onClose={() => setSearchOpen(false)} onAdd={(stop) => { addStopToItinerary(stop) }} />}
      {aiOpen && <AiAddPopup onClose={() => setAiOpen(false)} onAdd={(stop) => { addStopToItinerary(stop) }} llmConfig={llmConfig} />}
    </div>
  )
}
