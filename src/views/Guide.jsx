import { useEffect, useState } from 'react'
import { T, iiif } from '../tokens.js'
import { useAppState } from '../state/useAppState.js'
import { supabase } from '../supabase.js'
import { generateNarration, answerQuestion } from '../services/llm.js'
import NarrationPlayer from '../components/NarrationPlayer.jsx'
import JournalOverlay from '../components/JournalOverlay.jsx'
import ArtworkZoom from '../components/ArtworkZoom.jsx'

export default function Guide({ stop, allStops, onGoTo, onBack }) {
  const { llmConfig, elevenLabsConfig, toggleBookmark, bookmarks } = useAppState()
  const [narration, setNarration] = useState(stop.narration || '')
  const [loadingNarration, setLoadingNarration] = useState(false)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [asking, setAsking] = useState(false)
  const [progress, setProgress] = useState(0)
  const [showJournal, setShowJournal] = useState(false)
  const [showTourMenu, setShowTourMenu] = useState(false)
  const [showZoom, setShowZoom] = useState(false)

  const isBookmarked = bookmarks.has(String(stop.artworkId || stop.id))

  const artwork = {
    id: stop.artworkId || stop.id,
    title: stop.title,
    artist_display: stop.artist,
    date_display: stop.year,
    image_id: stop.imageId,
    gallery_title: stop.gallery,
    medium_display: '',
    ...stop,
  }

  useEffect(() => {
    if (stop.narration) setNarration(stop.narration)
    else loadNarration()
  }, [stop.id])

  async function loadNarration() {
    setLoadingNarration(true)
    const artworkId = String(stop.artworkId || stop.id)
    try {
      // 1. Check shared Supabase narration cache (generated once, reused across all users)
      const { data: cached } = await supabase
        .from('artwork_narrations')
        .select('narration')
        .eq('artwork_id', artworkId)
        .single()
      if (cached?.narration) {
        setNarration(cached.narration)
        stop.narration = cached.narration
        setLoadingNarration(false)
        return
      }
    } catch {}

    try {
      if (llmConfig?.apiKey) {
        // 2. Generate with LLM and cache (one narration per artwork, shared across all users)
        const text = await generateNarration(llmConfig, artwork)
        setNarration(text)
        stop.narration = text
        supabase.from('artwork_narrations').upsert({
          artwork_id: artworkId,
          narration: text,
          generated_at: new Date().toISOString(),
        }).then(() => {}, () => {})
      } else if (stop.description) {
        // 3. Fall back to AIC's own curatorial description (strip HTML)
        const text = stop.description.replace(/<[^>]+>/g, '').trim()
        if (text) { setNarration(text); stop.narration = text }
      } else if (stop.shortDescription) {
        const text = stop.shortDescription.replace(/<[^>]+>/g, '').trim()
        if (text) { setNarration(text); stop.narration = text }
      }
    } catch {}
    setLoadingNarration(false)
  }

  async function handleAsk() {
    if (!question.trim() || !llmConfig?.apiKey) return
    setAsking(true)
    try {
      const ans = await answerQuestion(llmConfig, artwork, question)
      setAnswer(ans)
    } catch {
      setAnswer("Sorry, I couldn\u2019t answer that right now.")
    } finally {
      setAsking(false)
    }
  }

  const words = narration.split(/\s+/)
  const heardCount = Math.floor(progress * words.length)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: T.bg, overflow: 'hidden', position: 'relative' }}>
      {/* Top nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: T.white, borderBottom: `0.5px solid ${T.border}`, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: T.fontBody, fontSize: 13, color: T.ink3 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={T.ink3} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3l-5 5 5 5"/></svg>
          Tour
        </button>
        <button onClick={() => setShowTourMenu((s) => !s)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontFamily: T.fontBody, fontSize: 12, color: T.ink3 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={T.ink3} strokeWidth="1.5" strokeLinecap="round"><circle cx="8" cy="4" r="1"/><circle cx="8" cy="8" r="1"/><circle cx="8" cy="12" r="1"/></svg>
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 20 }}>
        {/* Artwork image — tap to expand */}
        <div
          onClick={() => stop.imageId && setShowZoom(true)}
          style={{ position: 'relative', height: 220, background: stop.dominantColor || T.bgSub, flexShrink: 0, cursor: stop.imageId ? 'zoom-in' : 'default' }}
        >
          {stop.imageId && (
            <img src={iiif(stop.imageId, '843,')} alt={stop.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, background: 'linear-gradient(to top, rgba(250,250,249,1), transparent)' }} />
          {stop.imageId && (
            <div style={{
              position: 'absolute', top: 10, right: 10,
              width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(10,8,6,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="white" strokeWidth="1.3" strokeLinecap="round">
                <path d="M8 1h4v4M9 4l-4 4M5 12H1V8"/>
              </svg>
            </div>
          )}
        </div>

        {/* Title */}
        <div style={{ padding: '0 20px 16px', marginTop: -16, position: 'relative' }}>
          <div style={{ fontFamily: T.fontDisplay, fontSize: 18, fontWeight: 500, letterSpacing: '-0.012em', color: T.ink, lineHeight: 1.3, marginBottom: 4 }}>{stop.title}</div>
          <div style={{ fontFamily: T.fontBody, fontSize: 12, color: T.ink3 }}>{stop.artist} · {stop.year}</div>
        </div>

        {/* Action bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px 20px' }}>
          <button onClick={() => toggleBookmark(String(stop.artworkId || stop.id), artwork)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: T.rPill,
            background: isBookmarked ? T.accentBg : T.white,
            border: `0.5px solid ${isBookmarked ? T.accent : T.border}`,
            fontFamily: T.fontBody, fontSize: 12,
            color: isBookmarked ? T.accent : T.ink3, cursor: 'pointer',
          }}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill={isBookmarked ? T.accent : 'none'} stroke={isBookmarked ? T.accent : T.ink3} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 2h8a1 1 0 011 1v9l-5-3-5 3V3a1 1 0 011-1z"/>
            </svg>
            {isBookmarked ? 'Saved' : 'Save'}
          </button>
          <button onClick={() => setShowJournal(true)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: T.rPill,
            background: T.white, border: `0.5px solid ${T.border}`,
            fontFamily: T.fontBody, fontSize: 12, color: T.ink3, cursor: 'pointer',
          }}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke={T.ink3} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h10M2 2h10v7H2z"/></svg>
            Note
          </button>
        </div>

        {/* Narration text */}
        <div style={{ padding: '0 20px 24px' }}>
          <div style={{ fontFamily: T.fontBody, fontSize: 11, fontWeight: 500, color: T.ink4, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Narration</div>
          {loadingNarration ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 16, height: 16, border: `2px solid ${T.border}`, borderTopColor: T.accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ fontFamily: T.fontBody, fontSize: 13, color: T.ink4 }}>Generating narration…</span>
            </div>
          ) : narration ? (
            <div style={{ fontFamily: T.fontBody, fontSize: 15, lineHeight: 1.75, textWrap: 'pretty', color: T.ink2 }}>
              {words.map((word, i) => (
                <span key={i} style={{ color: i < heardCount ? T.ink : T.ink3, transition: 'color 0.5s ease' }}>
                  {word}{' '}
                </span>
              ))}
            </div>
          ) : (
            <p style={{ fontFamily: T.fontBody, fontSize: 14, color: T.ink4 }}>
              {llmConfig?.apiKey ? 'Failed to load narration.' : 'Add your API key in Settings to enable narration.'}
            </p>
          )}
        </div>

        {/* Ask field */}
        <div style={{ padding: '0 20px 24px' }}>
          <div style={{ fontFamily: T.fontBody, fontSize: 11, fontWeight: 500, color: T.ink4, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Ask about this work</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: answer ? 12 : 0 }}>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
              placeholder="Ask anything about this artwork…"
              style={{
                flex: 1, height: 40, padding: '0 14px', borderRadius: T.rMd,
                background: T.bgSub, border: `0.5px solid ${T.border}`,
                fontFamily: T.fontBody, fontSize: 13, color: T.ink2, outline: 'none',
              }}
            />
            <button
              onClick={handleAsk}
              disabled={asking || !question.trim()}
              style={{
                width: 40, height: 40, borderRadius: T.rMd,
                background: T.accent, border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: !question.trim() ? 0.5 : 1,
              }}
            >
              {asking
                ? <div style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                : <svg width="13" height="13" viewBox="0 0 14 14" fill="white"><polygon points="3,1 13,7 3,13"/></svg>
              }
            </button>
          </div>
          {answer && (
            <div style={{ padding: '12px 14px', background: T.accentBg, border: `0.5px solid rgba(12,136,139,0.2)`, borderRadius: T.rMd }}>
              <p style={{ fontFamily: T.fontBody, fontSize: 13, lineHeight: 1.65, color: T.ink2 }}>{answer}</p>
            </div>
          )}
        </div>
      </div>

      {/* Player */}
      {narration && (
        <div style={{ background: T.white, borderTop: `0.5px solid ${T.border}`, flexShrink: 0 }}>
          <NarrationPlayer
          text={narration}
          artworkId={String(stop.artworkId || stop.id)}
          elevenLabsConfig={elevenLabsConfig}
          onProgress={setProgress}
        />
        </div>
      )}

      {/* Tour menu overlay */}
      {showTourMenu && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 40 }}>
          <div onClick={() => setShowTourMenu(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(10,8,6,0.45)' }} />
          <div style={{ position: 'absolute', top: 60, right: 20, background: T.white, borderRadius: T.rLg, border: `0.5px solid ${T.border}`, overflow: 'hidden', minWidth: 220, maxHeight: '60vh', overflowY: 'auto', animation: 'fadeIn 0.15s ease' }}>
            {allStops.map((s, i) => (
              <div
                key={s.id}
                onClick={() => { onGoTo(s); setShowTourMenu(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                  borderBottom: `0.5px solid ${T.border}`, cursor: 'pointer',
                  background: s.id === stop.id ? T.accentBg : T.white,
                  opacity: s.completed ? 0.55 : 1,
                }}
              >
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  background: s.completed ? T.bgSub : T.accentBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {s.completed
                    ? <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke={T.ink4} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1.5 4.5l2 2 4-4"/></svg>
                    : <span style={{ fontFamily: T.fontBody, fontSize: 9, fontWeight: 500, color: T.accent }}>{i + 1}</span>
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: T.fontBody, fontSize: 12, fontWeight: 500, color: s.id === stop.id ? T.accent : T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                  <div style={{ fontFamily: T.fontBody, fontSize: 11, color: T.ink3 }}>{s.artist}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showJournal && <JournalOverlay artwork={artwork} onClose={() => setShowJournal(false)} />}

      {showZoom && stop.imageId && (
        <ArtworkZoom
          imageId={stop.imageId}
          title={stop.title}
          artist={stop.artist}
          onClose={() => setShowZoom(false)}
        />
      )}
    </div>
  )
}
