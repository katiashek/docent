// Provider-agnostic LLM service.
// All exported functions accept llmConfig = { provider: 'anthropic'|'openai'|'gemini', apiKey: string }
// and a tier = 'fast'|'smart' that maps to an appropriate model per provider.

const MODELS = {
  anthropic: { fast: 'claude-haiku-4-5-20251001', smart: 'claude-opus-4-7' },
  openai:    { fast: 'gpt-4o-mini',               smart: 'gpt-4o' },
  gemini:    { fast: 'gemini-2.0-flash',           smart: 'gemini-2.5-pro-preview-05-06' },
}

async function callAnthropic(apiKey, model, system, userContent, maxTokens) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: userContent }] }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Anthropic error ${res.status}`)
  }
  const data = await res.json()
  return data.content[0].text
}

async function callOpenAI(apiKey, model, system, userContent, maxTokens) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userContent },
      ],
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `OpenAI error ${res.status}`)
  }
  const data = await res.json()
  return data.choices[0].message.content
}

async function callGemini(apiKey, model, system, userContent, maxTokens) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: userContent }] }],
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Gemini error ${res.status}`)
  }
  const data = await res.json()
  return data.candidates[0].content.parts[0].text
}

async function callLLM(llmConfig, tier, system, userContent, maxTokens) {
  const { provider = 'anthropic', apiKey } = llmConfig || {}
  const model = MODELS[provider]?.[tier] || MODELS.anthropic[tier]
  if (provider === 'openai') return callOpenAI(apiKey, model, system, userContent, maxTokens)
  if (provider === 'gemini') return callGemini(apiKey, model, system, userContent, maxTokens)
  return callAnthropic(apiKey, model, system, userContent, maxTokens)
}

export async function generateOnboardingSummary(llmConfig, onboardingData) {
  return callLLM(
    llmConfig, 'fast',
    "You are a perceptive art curator. Based on a visitor's stated preferences, write a warm 2-3 sentence summary of what you understand about their taste. Second person. Be specific, not generic.",
    `Onboarding answers: ${JSON.stringify(onboardingData)}`,
    150
  )
}

export async function generateInitialProfile(llmConfig, onboardingData, freetextIntent) {
  return callLLM(
    llmConfig, 'smart',
    "You are an expert art curator. Based on a visitor's stated preferences, synthesize a rich taste profile. Return JSON with: { movements: [{label, weight}], themes: string[], summary: string, patternStrength: number }",
    `Onboarding: ${JSON.stringify(onboardingData)}\nFreetext: ${freetextIntent}`,
    300
  )
}

export async function generateTasteProfile(llmConfig, swipeHistory, onboardingData) {
  const liked = swipeHistory.filter((s) => s.liked)
  const passed = swipeHistory.filter((s) => !s.liked)
  const prompt = `
Liked artworks: ${liked.map((s) => `${s.artwork.title} (${s.artwork.style_title}, ${s.artwork.department_title})`).join('; ')}
Passed artworks: ${passed.map((s) => `${s.artwork.title} (${s.artwork.style_title})`).join('; ')}
Onboarding preferences: ${JSON.stringify(onboardingData)}

Synthesize a taste profile. Return ONLY valid JSON:
{ "movements": [{"label": string, "weight": number}], "themes": string[], "summary": string, "patternStrength": number }
Weights and patternStrength are 0-1. Include 4-8 movements. Summary is 2-3 sentences, second person.`

  const text = await callLLM(
    llmConfig, 'smart',
    'You are an expert art curator synthesizing a visitor taste profile from their swipe history. Return only valid JSON.',
    prompt,
    300
  )
  const match = text.match(/\{[\s\S]*\}/)
  return match ? JSON.parse(match[0]) : null
}

export async function generateNarration(llmConfig, artwork) {
  return callLLM(
    llmConfig, 'smart',
    'You are a warm, knowledgeable docent at the Art Institute of Chicago. Generate an audio narration for this artwork — conversational, not academic. Paint a picture and keep your sentence structures varied. 5-7 sentences.',
    `Artwork: "${artwork.title}" by ${artwork.artist_display}, ${artwork.date_display}. Medium: ${artwork.medium_display}. Gallery: ${artwork.gallery_title}.`,
    400
  )
}

export async function generateDiscoveryNarration(llmConfig, artwork, tasteProfile) {
  return callLLM(
    llmConfig, 'smart',
    'You are a knowledgeable, conversational docent at the Art Institute of Chicago. Generate a concise narration for a spontaneous discovery stop.',
    `Artwork: "${artwork.title}" by ${artwork.artist_display}, ${artwork.date_display}. Medium: ${artwork.medium_display}.\nVisitor profile: ${tasteProfile?.summary || 'general interest'}`,
    400
  )
}

export async function answerQuestion(llmConfig, artwork, question) {
  return callLLM(
    llmConfig, 'smart',
    'You are a knowledgeable, conversational docent at the Art Institute of Chicago. Answer questions warmly and precisely in 2-3 sentences.',
    `The visitor is looking at "${artwork.title}" by ${artwork.artist_display} (${artwork.date_display}). Question: ${question}`,
    400
  )
}

export async function generateTourBrief(llmConfig, tasteProfile, selectedArtworks, tourIntent) {
  const artworkList = selectedArtworks.slice(0, 8)
    .map((a) => `${a.title} (${a.style_title || a.department_title || ''})`)
    .join('; ')
  return callLLM(
    llmConfig, 'fast',
    "You are a museum curator writing a brief personal intro for a visitor's tour. 2 sentences max, second person, warm and specific. No more than 45 words.",
    `Visitor taste: ${tasteProfile?.summary || 'eclectic interests'}. Mode: ${tourIntent.mode}${tourIntent.focusText ? `, focus: ${tourIntent.focusText}` : ''}. Artworks selected: ${artworkList}.`,
    80
  )
}

export async function generateCollectionSummary(llmConfig, bookmarks) {
  return callLLM(
    llmConfig, 'fast',
    "You are a perceptive art curator. In one sentence (max 12 words), describe the taste revealed by a visitor's saved works. Be evocative, not generic.",
    `Saved works: ${bookmarks.map((b) => b.title).join(', ')}`,
    30
  )
}
