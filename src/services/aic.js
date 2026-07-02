const BASE = 'https://api.artic.edu/api/v1'
const FIELDS = 'id,title,artist_display,date_display,image_id,gallery_title,department_title,style_title,medium_display,color,is_on_view,place_of_origin,date_start,date_end,description,short_description'

export async function fetchOnViewArtworks(onboardingData = {}, limit = 20) {
  let url = `${BASE}/artworks/search?fields=${FIELDS}&limit=${limit}&query[term][is_on_view]=true`
  if (onboardingData.styles?.length) {
    url += `&q=${encodeURIComponent(onboardingData.styles.join(' '))}`
  }
  const res = await fetch(url)
  const data = await res.json()
  return (data.data || []).filter((a) => a.image_id)
}

export async function fetchBoostedArtworks(limit = 20) {
  const res = await fetch(
    `${BASE}/artworks/search?fields=${FIELDS}&limit=${limit}&query[term][is_boosted]=true`
  )
  const data = await res.json()
  return (data.data || []).filter((a) => a.image_id)
}

export async function fetchArtworksPage(page = 1, limit = 20) {
  const res = await fetch(
    `${BASE}/artworks/search?fields=${FIELDS}&limit=${limit}&page=${page}&query[term][is_on_view]=true`
  )
  const data = await res.json()
  return (data.data || []).filter((a) => a.image_id)
}

export async function fetchByStylePage(styleTitle, page = 1, limit = 20) {
  const res = await fetch(
    `${BASE}/artworks/search?fields=${FIELDS}&limit=${limit}&page=${page}&q=${encodeURIComponent(styleTitle)}&query[term][is_on_view]=true`
  )
  const data = await res.json()
  return (data.data || []).filter((a) => a.image_id)
}

export async function searchArtworks(query, limit = 10) {
  const params = new URLSearchParams({
    q: query,
    fields: 'id,title,artist_display,date_display,image_id,gallery_title,style_title,medium_display',
    limit,
  })
  const res = await fetch(`${BASE}/artworks/search?${params}`)
  const data = await res.json()
  return (data.data || []).filter((a) => a.image_id)
}

export async function fetchArtworkById(id) {
  const res = await fetch(`${BASE}/artworks/${id}?fields=${FIELDS}`)
  const data = await res.json()
  return data.data || null
}

export function scoreArtwork(artwork, tasteProfile, onboardingData = {}) {
  let score = 0

  // Swipe history — guard against non-array values from old/LLM-generated profiles
  const swipes = Array.isArray(tasteProfile?.swipeHistory) ? tasteProfile.swipeHistory : []
  const liked = swipes.filter((s) => s.liked)
  const likedStyles = liked.map((s) => s.artwork?.style_title).filter(Boolean)
  const likedDepts = liked.map((s) => s.artwork?.department_title).filter(Boolean)
  if (artwork.style_title && likedStyles.includes(artwork.style_title)) score += 30
  if (artwork.department_title && likedDepts.includes(artwork.department_title)) score += 20

  // LLM-generated taste profile movements
  if (tasteProfile?.movements?.length && artwork.style_title) {
    const artStyle = artwork.style_title.toLowerCase()
    for (const m of tasteProfile.movements) {
      const label = (m.label || '').toLowerCase()
      if (artStyle.includes(label) || label.includes(artStyle)) {
        score += Math.round((m.weight || 0) * 40)
        break
      }
    }
  }

  if (onboardingData.mediums?.length) {
    const med = artwork.medium_display?.toLowerCase() || ''
    if (onboardingData.mediums.some((m) => med.includes(m.toLowerCase()))) score += 10
  }
  if (onboardingData.decadeRange) {
    const [from, to] = onboardingData.decadeRange
    const year = artwork.date_start || 0
    if (year >= from && year <= to) score += 10
  }
  if (onboardingData.regions?.length) {
    const origin = artwork.place_of_origin?.toLowerCase() || ''
    if (onboardingData.regions.some((r) => origin.includes(r.toLowerCase()))) score += 10
  }
  if (onboardingData.styles?.length && artwork.style_title) {
    if (onboardingData.styles.some((s) => artwork.style_title.toLowerCase().includes(s.toLowerCase()))) score += 15
  }

  return score
}

export function scoreForExplore(artwork, focusText) {
  if (!focusText) return 0
  const keywords = focusText.toLowerCase().split(/\s+/)
  const haystack = [artwork.title, artwork.style_title, artwork.department_title, artwork.medium_display]
    .join(' ').toLowerCase()
  return keywords.filter((k) => haystack.includes(k)).length * 40
}
