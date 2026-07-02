import { useEffect, useRef, useState } from 'react'
import { T, iiif } from '../tokens.js'
import SwipeCard from '../components/SwipeCard.jsx'
import ArtworkZoom from '../components/ArtworkZoom.jsx'
import { useAppState, PHASE_II_THRESHOLD, TASTE_PROFILE_THRESHOLD, PROFILE_REFRESH_INTERVAL } from '../state/useAppState.js'
import { fetchBoostedArtworks, fetchArtworksPage, fetchByStylePage } from '../services/aic.js'
import { generateTasteProfile } from '../services/llm.js'

const BATCH_REFILL_THRESHOLD = 5

export default function Swipe({ onProfileReady, onNavigate }) {
  const { swipeHistory, swipePhase, addSwipe, removeLastSwipe, tasteProfile, setTasteProfile, llmConfig, onboardingData } = useAppState()
  const [deck, setDeck] = useState([])
  const [loading, setLoading] = useState(true)
  const [undoStack, setUndoStack] = useState([]) // { artwork, liked }
  const [zoomedArtwork, setZoomedArtwork] = useState(null)
  const sinceLastRefreshRef = useRef(0)
  const skippedRef = useRef(new Set())
  const loadingRef = useRef(false)

  useEffect(() => { loadCards() }, [])

  async function loadCards() {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const excluded = new Set([
        ...swipeHistory.map((s) => String(s.id)),
        ...skippedRef.current,
      ])

      const results = []

      // 60% taste-aligned: pick a style the user has liked or selected in onboarding
      const likedStyles = [...new Set(
        swipeHistory.filter((s) => s.liked).map((s) => s.artwork?.style_title).filter(Boolean)
      )]
      const seedStyles = likedStyles.length > 0 ? likedStyles : (onboardingData.styles || [])

      if (seedStyles.length > 0) {
        const style = seedStyles[Math.floor(Math.random() * seedStyles.length)]
        const page = Math.floor(Math.random() * 30) + 1
        const taste = await fetchByStylePage(style, page, 24)
        taste.filter((a) => !excluded.has(String(a.id))).forEach((a) => {
          excluded.add(String(a.id))
          results.push(a)
        })
      }

      // 40% exploration: random page from the full on-view catalog
      const explorePage = Math.floor(Math.random() * 400) + 1
      const explore = await fetchArtworksPage(explorePage, 16)
      explore.filter((a) => !excluded.has(String(a.id))).forEach((a) => {
        excluded.add(String(a.id))
        results.push(a)
      })

      // Fallback: boosted artworks if nothing loaded
      if (results.length === 0) {
        const fallback = await fetchBoostedArtworks(20)
        fallback.filter((a) => !excluded.has(String(a.id))).forEach((a) => results.push(a))
      }

      // Shuffle and append to existing deck
      const shuffled = results.sort(() => Math.random() - 0.5)
      setDeck((prev) => {
        const existing = new Set(prev.map((a) => String(a.id)))
        return [...prev, ...shuffled.filter((a) => !existing.has(String(a.id)))]
      })
    } catch {}
    loadingRef.current = false
    setLoading(false)
  }

  function handleSkip() {
    if (!deck[0]) return
    skippedRef.current.add(deck[0].id)
    setDeck(prev => prev.filter(a => a.id !== deck[0].id))
  }

  function handleUndo() {
    if (undoStack.length === 0) return
    const last = undoStack[undoStack.length - 1]
    setUndoStack((prev) => prev.slice(0, -1))
    setDeck((prev) => [last.artwork, ...prev])
    removeLastSwipe()
  }

  async function handleSwipe(artwork, liked) {
    const entry = { id: artwork.id, liked, artwork }
    setUndoStack((prev) => [...prev, { artwork, liked }])
    addSwipe(entry)
    sinceLastRefreshRef.current += 1

    const newHistory = [...swipeHistory, entry]
    const likeCount = newHistory.filter((s) => s.liked).length

    if (
      llmConfig?.apiKey &&
      likeCount >= TASTE_PROFILE_THRESHOLD &&
      sinceLastRefreshRef.current >= PROFILE_REFRESH_INTERVAL
    ) {
      sinceLastRefreshRef.current = 0
      try {
        const profile = await generateTasteProfile(llmConfig, newHistory, onboardingData)
        if (profile) setTasteProfile(profile)
      } catch {}
    }

    setDeck((prev) => prev.filter((a) => a.id !== artwork.id))
  }

  useEffect(() => {
    if (deck.length <= BATCH_REFILL_THRESHOLD) loadCards()
  }, [deck.length])

  const likeCount = swipeHistory.filter((s) => s.liked).length
  const totalCount = swipeHistory.length

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: T.bg, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 20px', background: T.white, borderBottom: `0.5px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 500, color: T.ink }}>docent</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {totalCount > 0 && (
            <span style={{ fontFamily: T.fontBody, fontSize: 12, color: T.ink3 }}>
              {totalCount} swiped · {likeCount} liked
            </span>
          )}
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: T.accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: T.fontBody, fontSize: 13, color: T.accent, fontWeight: 500 }}>
              {swipePhase === 'drill' ? '●' : '○'}
            </span>
          </div>
        </div>
      </div>

      {/* Profile banner */}
      {tasteProfile?.summary && (
        <div style={{ padding: '10px 20px', background: T.accentBg, borderBottom: `0.5px solid rgba(12,136,139,0.2)`, flexShrink: 0 }}>
          <p style={{ fontFamily: T.fontBody, fontSize: 12, color: T.ink2, lineHeight: 1.5 }}>
            <strong style={{ fontWeight: 500 }}>Your profile is building:</strong> {tasteProfile.summary}
          </p>
        </div>
      )}

      {/* Card area */}
      <div style={{ flex: 1, position: 'relative', margin: '16px', overflow: 'hidden' }}>
        {loading && deck.length === 0 ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 24, height: 24, border: `2px solid ${T.border}`, borderTopColor: T.accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : deck.length === 0 ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <p style={{ fontFamily: T.fontBody, fontSize: 15, color: T.ink3 }}>You've seen everything!</p>
            <button onClick={loadCards} style={{ padding: '12px 24px', borderRadius: T.rMd, background: T.accent, border: 'none', color: '#fff', fontFamily: T.fontBody, fontSize: 14, cursor: 'pointer' }}>
              Load more
            </button>
          </div>
        ) : (
          <>
            {deck[1] && (
              <SwipeCard key={deck[1].id + '-peek'} artwork={deck[1]} isPeek onLike={() => {}} onPass={() => {}} />
            )}
            <SwipeCard
              key={deck[0].id}
              artwork={deck[0]}
              onLike={(a) => handleSwipe(a, true)}
              onPass={(a) => handleSwipe(a, false)}
              onTap={(a) => setZoomedArtwork(a)}
            />
          </>
        )}
      </div>

      {/* Action buttons */}
      {deck.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '16px 0 24px', flexShrink: 0 }}>
          {/* Undo */}
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            style={{ width: 40, height: 40, borderRadius: '50%', background: T.white, border: `0.5px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: undoStack.length === 0 ? 'default' : 'pointer', opacity: undoStack.length === 0 ? 0.35 : 1 }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={T.ink3} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a5 5 0 1 0 1.5-3.5L2 6"/><path d="M2 2v4h4"/></svg>
          </button>

          {/* Pass */}
          <button
            onClick={() => deck[0] && handleSwipe(deck[0], false)}
            style={{
              width: 58, height: 58, borderRadius: '50%', background: T.white,
              border: `0.5px solid ${T.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              boxShadow: '0 2px 12px -2px rgba(0,0,0,0.10)',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke={T.pass} strokeWidth="2" strokeLinecap="round"><path d="M16 6l-10 10M6 6l10 10"/></svg>
          </button>

          {/* Like */}
          <button
            onClick={() => deck[0] && handleSwipe(deck[0], true)}
            style={{
              width: 58, height: 58, borderRadius: '50%', background: T.accent,
              border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: `0 4px 16px -4px ${T.accent}80`,
            }}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="white"><path d="M11 19s-8-5.5-8-11A5 5 0 0111 4.5 5 5 0 0119 8c0 5.5-8 11-8 11z"/></svg>
          </button>

          {/* Skip (neutral — removes from deck without recording) */}
          <button
            onClick={handleSkip}
            style={{ width: 40, height: 40, borderRadius: '50%', background: T.white, border: `0.5px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill={T.ink3}>
              <polygon points="2,2 9,8 2,14"/>
              <rect x="11" y="2" width="2.5" height="12" rx="1"/>
            </svg>
          </button>
        </div>
      )}

      {/* Build tour CTA */}
      {likeCount >= TASTE_PROFILE_THRESHOLD && (
        <div style={{ padding: '0 20px 20px', flexShrink: 0 }}>
          <button
            onClick={() => onNavigate('intent')}
            style={{
              width: '100%', padding: '14px', borderRadius: T.rMd,
              background: T.ink, border: 'none', color: T.bg,
              fontFamily: T.fontBody, fontSize: 14, fontWeight: 500, cursor: 'pointer',
            }}
          >
            Build my tour →
          </button>
        </div>
      )}

      {zoomedArtwork && (
        <ArtworkZoom
          imageId={zoomedArtwork.image_id}
          title={zoomedArtwork.title}
          artist={zoomedArtwork.artist_display?.split('\n')[0]}
          onClose={() => setZoomedArtwork(null)}
        />
      )}
    </div>
  )
}
