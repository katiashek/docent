// Pre-made voices — confirmed available on ElevenLabs free tier
export const EL_VOICES = [
  { id: '21m00Tcm4TlvDq8ikWAM', label: 'Rachel', description: 'warm · American · F' },
  { id: 'pNInz6obpgDQGcFmaJgB', label: 'Adam',   description: 'deep · American · M' },
]

export const FREE_VOICE_IDS = new Set(EL_VOICES.map((v) => v.id))

export const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'

export async function generateSpeech(apiKey, voiceId, text) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_turbo_v2_5',
      voice_settings: { stability: 0.45, similarity_boost: 0.75, style: 0, use_speaker_boost: true },
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail?.message || `ElevenLabs error ${res.status}`)
  }
  return res.blob()
}
