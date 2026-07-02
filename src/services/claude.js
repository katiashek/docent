const ANTHROPIC_BASE = 'https://api.anthropic.com/v1'

async function callClaude(apiKey, model, system, userContent, maxTokens) {
  const res = await fetch(`${ANTHROPIC_BASE}/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userContent }],
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Claude error ${res.status}`)
  }
  const data = await res.json()
  return data.content[0].text
}

export async function generateOnboardingSummary(apiKey, onboardingData) {
  return callClaude(
    apiKey,
    'claude-haiku-4-5-20251001',
    'You are a perceptive art curator. Based on a visitor\'s stated preferences, write a warm 2-3 sentence summary of what you understand about their taste. Second person. Be specific, not generic.',
    `Onboarding answers: ${JSON.stringify(onboardingData)}`,
    150
  )
}

export async function generateInitialProfile(apiKey, onboardingData, freetextIntent) {
  return callClaude(
    apiKey,
    'claude-opus-4-7',
    'You are an expert art curator. Based on a visitor\'s stated preferences, synthesize a rich taste profile. Return JSON with: { movements: [{label, weight}], themes: string[], summary: string, patternStrength: number }',
    `Onboarding: ${JSON.stringify(onboardingData)}\nFreetext: ${freetextIntent}`,
    300
  )
}

export async function generateTasteProfile(apiKey, swipeHistory, onboardingData) {
  const liked = swipeHistory.filter((s) => s.liked)
  const passed = swipeHistory.filter((s) => !s.liked)

  const prompt = `
Liked artworks: ${liked.map((s) => `${s.artwork.title} (${s.artwork.style_title}, ${s.artwork.department_title})`).join('; ')}
Passed artworks: ${passed.map((s) => `${s.artwork.title} (${s.artwork.style_title})`).join('; ')}
Onboarding preferences: ${JSON.stringify(onboardingData)}

Synthesize a taste profile. Return ONLY valid JSON:
{ "movements": [{"label": string, "weight": number}], "themes": string[], "summary": string, "patternStrength": number }
Weights and patternStrength are 0-1. Include 4-8 movements. Summary is 2-3 sentences, second person.`

  const text = await callClaude(
    apiKey,
    'claude-opus-4-7',
    'You are an expert art curator synthesizing a visitor taste profile from their swipe history. Return only valid JSON.',
    prompt,
    300
  )
  const match = text.match(/\{[\s\S]*\}/)
  return match ? JSON.parse(match[0]) : null
}

export async function generateNarration(apiKey, artwork, tasteProfile, tourIntent) {
  const focusNote = tourIntent?.focusText
    ? `\nEmphasis angle: ${tourIntent.focusText}`
    : ''
  const profileNote = tasteProfile?.summary
    ? `\nVisitor profile: ${tasteProfile.summary}`
    : ''

  return callClaude(
    apiKey,
    'claude-opus-4-7',
    `You are a warm, knowledgeable docent at the Art Institute of Chicago. Generate an audio narration for this artwork — conversational, not academic. Paint a picture. 3-4 paragraphs.`,
    `Artwork: "${artwork.title}" by ${artwork.artist_display}, ${artwork.date_display}. Medium: ${artwork.medium_display}. Gallery: ${artwork.gallery_title}.${profileNote}${focusNote}`,
    600
  )
}

export async function generateDiscoveryNarration(apiKey, artwork, tasteProfile) {
  return callClaude(
    apiKey,
    'claude-opus-4-7',
    'You are a knowledgeable, conversational docent at the Art Institute of Chicago. Generate a concise narration for a spontaneous discovery stop.',
    `Artwork: "${artwork.title}" by ${artwork.artist_display}, ${artwork.date_display}. Medium: ${artwork.medium_display}.\nVisitor profile: ${tasteProfile?.summary || 'general interest'}`,
    400
  )
}

export async function answerQuestion(apiKey, artwork, question) {
  return callClaude(
    apiKey,
    'claude-opus-4-7',
    'You are a knowledgeable, conversational docent at the Art Institute of Chicago. Answer questions warmly and precisely in 2-3 sentences.',
    `The visitor is looking at "${artwork.title}" by ${artwork.artist_display} (${artwork.date_display}). Question: ${question}`,
    400
  )
}

export async function generateCollectionSummary(apiKey, bookmarks) {
  return callClaude(
    apiKey,
    'claude-haiku-4-5-20251001',
    'You are a perceptive art curator. In one sentence (max 12 words), describe the taste revealed by a visitor\'s saved works. Be evocative, not generic.',
    `Saved works: ${bookmarks.map((b) => b.title).join(', ')}`,
    30
  )
}
