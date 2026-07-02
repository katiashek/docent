import { useEffect, useRef, useState } from 'react'
import { T, iiif } from '../tokens.js'
import { searchArtworks } from '../services/aic.js'
import { generateDiscoveryNarration } from '../services/llm.js'
import { useAppState } from '../state/useAppState.js'

export default function DiscoverySheet({ onClose, onAddToTour }) {
  const { llmConfig, tasteProfile } = useAppState()
  const [query, setQuery] = useState('')
  const [webSearch, setWebSearch] = useState(false)
  const [results, setResults] = useState([])
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [playingId, setPlayingId] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 120)
  }, [])

  async function handleSearch() {
    if (!query.trim()) return
    setLoading(true)
    try {
      const data = await searchArtworks(query)
      setResults(data)
      setSearched(true)
    } catch {
      setSearched(true)
    } finally {
      setLoading(false)
    }
  }

  async function handlePlay(artwork) {
    setPlayingId(artwork.id)
    window.speechSynthesis?.cancel()
    try {
      let narration = `${artwork.title} by ${artwork.artist_display}, ${artwork.date_display}.`
      if (llmConfig?.apiKey) {
        narration = await generateDiscoveryNarration(llmConfig, artwork, tasteProfile)
      }
      const utter = new SpeechSynthesisUtterance(narration)
      utter.rate = 0.92
      utter.onend = () => setPlayingId(null)
      window.speechSynthesis?.speak(utter)
    } catch {
      setPlayingId(null)
    }
  }

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 50 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(10,8,6,0.45)', animation: 'fadeIn 0.2s ease' }} />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: T.white, borderRadius: '20px 20px 0 0',
        maxHeight: '75%', display: 'flex', flexDirection: 'column',
        overflow: 'hidden', animation: 'slideUp 0.28s ease',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
          <div style={{ width: 36, height: 4, borderRadius: T.rPill, background: 'rgba(28,23,19,0.12)' }} />
        </div>

        <div style={{ padding: '4px 20px 16px', flexShrink: 0 }}>
          <div style={{ fontFamily: T.fontDisplay, fontSize: 20, fontWeight: 500, letterSpacing: '-0.015em', color: T.ink, marginBottom: 14 }}>
            What are you looking at?
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 14px', background: T.bgSub,
              border: `0.5px solid ${T.border}`, borderRadius: T.rMd,
            }}>
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke={T.ink3} strokeWidth="1.4" strokeLinecap="round">
                <circle cx="6.5" cy="6.5" r="4.5"/>
                <path d="M10.5 10.5l3 3"/>
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Title, artist, keyword..."
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  fontFamily: T.fontBody, fontSize: 14, color: T.ink2,
                }}
              />
            </div>
            <button
              onClick={handleSearch}
              style={{
                width: 42, height: 42, borderRadius: T.rMd,
                background: T.accent, border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {loading
                ? <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                : <svg width="14" height="14" viewBox="0 0 14 14" fill="white"><polygon points="3,1 13,7 3,13"/></svg>
              }
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
            <span style={{ fontFamily: T.fontBody, fontSize: 12, color: T.ink3 }}>Search the web too</span>
            <div
              onClick={() => setWebSearch((w) => !w)}
              style={{
                width: 36, height: 20, borderRadius: T.rPill,
                background: webSearch ? T.accent : 'rgba(28,23,19,0.12)',
                position: 'relative', cursor: 'pointer', transition: 'background 0.2s ease',
              }}
            >
              <div style={{
                position: 'absolute', top: 2, left: webSearch ? 18 : 2,
                width: 16, height: 16, borderRadius: '50%', background: '#fff',
                transition: 'left 0.2s ease',
              }} />
            </div>
          </div>
        </div>

        {searched && results.length > 0 ? (
          <div style={{ flex: 1, overflowY: 'auto', borderTop: `0.5px solid ${T.border}` }}>
            {results.map((r) => (
              <div key={r.id} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 20px', borderBottom: `0.5px solid ${T.border}`,
              }}>
                <div style={{ width: 48, height: 48, borderRadius: T.rMd, overflow: 'hidden', flexShrink: 0, border: `0.5px solid ${T.border}`, background: T.bgSub }}>
                  <img src={iiif(r.image_id, '200,')} alt={r.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: T.fontBody, fontSize: 13, fontWeight: 500, color: T.ink, marginBottom: 2 }}>{r.title}</div>
                  <div style={{ fontFamily: T.fontBody, fontSize: 12, color: T.ink3 }}>{r.artist_display?.split('\n')[0]} · {r.date_display}</div>
                  {r.style_title && <div style={{ fontFamily: T.fontBody, fontSize: 11, color: T.accent, marginTop: 3 }}>{r.style_title}</div>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => playingId === r.id ? window.speechSynthesis?.cancel() || setPlayingId(null) : handlePlay(r)}
                    style={{
                      padding: '5px 12px', borderRadius: T.rPill,
                      background: T.accent, border: 'none',
                      fontFamily: T.fontBody, fontSize: 11, fontWeight: 500,
                      color: '#fff', cursor: 'pointer',
                    }}
                  >{playingId === r.id ? '■ Stop' : '▶ Play'}</button>
                  <button
                    onClick={() => { onAddToTour?.(r); onClose() }}
                    style={{
                      padding: '5px 12px', borderRadius: T.rPill,
                      background: 'transparent', border: `0.5px solid ${T.border}`,
                      fontFamily: T.fontBody, fontSize: 11, color: T.ink3, cursor: 'pointer',
                    }}
                  >+ Tour</button>
                </div>
              </div>
            ))}
          </div>
        ) : searched ? (
          <div style={{ padding: '8px 20px 28px', textAlign: 'center' }}>
            <p style={{ fontFamily: T.fontBody, fontSize: 13, color: T.ink4 }}>No results found. Try a different search.</p>
          </div>
        ) : (
          <div style={{ padding: '8px 20px 28px', textAlign: 'center' }}>
            <p style={{ fontFamily: T.fontBody, fontSize: 13, color: T.ink4, lineHeight: 1.6 }}>
              Search by title, artist, keyword, or describe what you're seeing.<br />
              <em>Works anywhere in the building.</em>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
