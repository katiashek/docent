import { fetchOnViewArtworks, fetchBoostedArtworks, scoreArtwork, scoreForExplore } from './aic.js'
import { generateTourBrief } from './llm.js'

const MINUTES_PER_ARTWORK = 2

export async function buildItinerary(tasteProfile, onboardingData, tourIntent, llmConfig) {
  const minutes = tourIntent.minutes || 60
  const maxStops = Math.floor(minutes / MINUTES_PER_ARTWORK)

  // Pull top movements from the LLM-generated taste profile to inform the AIC query
  const profileStyles = (tasteProfile?.movements || [])
    .sort((a, b) => (b.weight || 0) - (a.weight || 0))
    .slice(0, 3)
    .map((m) => m.label)
    .filter(Boolean)
  const queryStyles = [...new Set([...profileStyles, ...(onboardingData?.styles || [])])]

  let candidates = await fetchOnViewArtworks({ ...onboardingData, styles: queryStyles }, 60).catch(() => [])
  if (candidates.length < 10) {
    const boosted = await fetchBoostedArtworks(40).catch(() => [])
    candidates = [...candidates, ...boosted]
  }

  const avoidText = tourIntent.avoidText?.toLowerCase() || ''
  if (avoidText) {
    candidates = candidates.filter((a) => {
      const haystack = [a.title, a.style_title, a.department_title, a.medium_display].join(' ').toLowerCase()
      return !avoidText.split(/[\s,]+/).some((kw) => kw && haystack.includes(kw))
    })
  }

  const scored = candidates.map((a) => {
    let score = scoreArtwork(a, tasteProfile, onboardingData)
    if (tourIntent.mode === 'explore') {
      score = score * 0.5 + scoreForExplore(a, tourIntent.focusText)
    }
    return { artwork: a, score }
  })

  scored.sort((a, b) => b.score - a.score)
  const selected = scored.slice(0, maxStops).map((s) => s.artwork)
  const grouped = groupByGallery(selected)

  // LLM-generated brief when a key is available; fall back to algorithmic summary
  let brief
  if (llmConfig?.apiKey && selected.length > 0) {
    brief = await generateTourBrief(llmConfig, tasteProfile, selected, tourIntent).catch(() => null)
  }
  if (!brief) {
    const depts = [...new Set(selected.map((a) => a.department_title).filter(Boolean))].slice(0, 3)
    brief = [
      `A ${minutes}-minute tour across ${grouped.length} ${grouped.length === 1 ? 'gallery' : 'galleries'}, ${selected.length} works.`,
      tourIntent.mode === 'explore' && tourIntent.focusText
        ? `Focused on: ${tourIntent.focusText}.`
        : tourIntent.mode === 'explore'
        ? 'Charted to stretch beyond your usual taste.'
        : 'Built entirely around your taste profile.',
      depts.length ? `Spans ${depts.join(', ')}.` : '',
    ].filter(Boolean).join(' ')
  }

  return {
    stops: grouped,
    totalMinutes: selected.length * MINUTES_PER_ARTWORK,
    mode: tourIntent.mode,
    brief,
    builtAt: Date.now(),
  }
}

function groupByGallery(artworks) {
  const groups = {}
  artworks.forEach((a, i) => {
    const key = a.gallery_title || 'General Galleries'
    if (!groups[key]) groups[key] = { gallery: key, floor: parseFloor(a.gallery_title), stops: [] }
    groups[key].stops.push({
      id: a.id,
      artworkId: a.id,
      title: a.title,
      artist: a.artist_display?.split('\n')[0] || '',
      year: a.date_display || '',
      imageId: a.image_id,
      dominantColor: a.color ? `hsl(${a.color.h},${a.color.s}%,${a.color.l}%)` : '#9C948C',
      gallery: a.gallery_title || '',
      floor: parseFloor(a.gallery_title),
      estimatedMinutes: MINUTES_PER_ARTWORK,
      completed: false,
      narration: null,
      description: a.description || null,
      shortDescription: a.short_description || null,
    })
  })
  return Object.values(groups).sort((a, b) => a.floor - b.floor)
}

function parseFloor(galleryTitle) {
  if (!galleryTitle) return 1
  const m = galleryTitle.match(/floor\s*(\d)/i) || galleryTitle.match(/level\s*(\d)/i)
  return m ? parseInt(m[1]) : 1
}
