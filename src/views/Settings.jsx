import { useState } from 'react'
import { T } from '../tokens.js'
import { useAppState } from '../state/useAppState.js'
import { supabase } from '../supabase.js'
import { EL_VOICES } from '../services/elevenlabs.js'

const PROVIDERS = [
  {
    id: 'anthropic',
    label: 'Anthropic',
    placeholder: 'sk-ant-...',
    hint: 'Get your key at console.anthropic.com',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    placeholder: 'sk-...',
    hint: 'Get your key at platform.openai.com/api-keys',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    placeholder: 'AIzaSy...',
    hint: 'Get your key at aistudio.google.com/apikey',
  },
]

export default function Settings({ onBack, onSignOut }) {
  const { llmConfig, setLlmConfig, elevenLabsConfig, setElevenLabsConfig, user } = useAppState()
  const [provider, setProvider] = useState(llmConfig?.provider || 'anthropic')
  const [keyInput, setKeyInput] = useState(llmConfig?.apiKey || '')
  const [elKey, setElKey] = useState(elevenLabsConfig?.apiKey || '')
  const [elVoice, setElVoice] = useState(elevenLabsConfig?.voiceId || EL_VOICES[0].id)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [elSaving, setElSaving] = useState(false)
  const [elSaved, setElSaved] = useState(false)
  const [elSaveError, setElSaveError] = useState('')

  // Sync key field when switching providers so users don't carry over the wrong key
  function handleProviderChange(p) {
    if (p === provider) return
    setProvider(p)
    setKeyInput(p === llmConfig?.provider ? (llmConfig?.apiKey || '') : '')
    setSaved(false)
  }

  async function saveKey() {
    setSaving(true)
    setSaveError('')
    const config = { provider, apiKey: keyInput }
    setLlmConfig(config)
    if (user) {
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        llm_config: { ...config, elevenLabsKey: elevenLabsConfig.apiKey, elevenLabsVoiceId: elevenLabsConfig.voiceId },
        updated_at: new Date().toISOString(),
      })
      if (error) {
        setSaveError('Couldn\'t save — check your connection.')
        setSaving(false)
        return
      }
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function saveElevenLabs() {
    setElSaving(true)
    setElSaveError('')
    const cfg = { apiKey: elKey.trim(), voiceId: elVoice }
    setElevenLabsConfig(cfg)
    if (user) {
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        llm_config: { provider: llmConfig.provider, apiKey: llmConfig.apiKey, elevenLabsKey: cfg.apiKey, elevenLabsVoiceId: cfg.voiceId },
        updated_at: new Date().toISOString(),
      })
      if (error) {
        setElSaveError('Couldn\'t save — check your connection.')
        setElSaving(false)
        return
      }
    }
    setElSaving(false)
    setElSaved(true)
    setTimeout(() => setElSaved(false), 2000)
  }

  const currentProvider = PROVIDERS.find((p) => p.id === provider)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: T.bg }}>
      {/* Header */}
      <div style={{ padding: '14px 20px', background: T.white, borderBottom: `0.5px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 500, color: T.ink, padding: 0 }}>
          docent
        </button>
        <span style={{ fontFamily: T.fontBody, fontSize: 13, color: T.ink3 }}>Settings</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px 40px' }}>

        {/* AI Provider */}
        <div style={{ background: T.white, borderRadius: T.rLg, border: `0.5px solid ${T.border}`, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '16px 18px' }}>
            <div style={{ fontFamily: T.fontBody, fontSize: 12, fontWeight: 500, color: T.ink4, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>AI Provider</div>

            {/* Provider segmented control */}
            <div style={{ display: 'flex', background: T.bgSub, borderRadius: T.rMd, padding: 3, marginBottom: 16, border: `0.5px solid ${T.border}` }}>
              {PROVIDERS.map((p) => {
                const sel = provider === p.id
                return (
                  <button
                    key={p.id}
                    onClick={() => handleProviderChange(p.id)}
                    style={{
                      flex: 1, padding: '8px 0', borderRadius: T.rSm,
                      border: 'none', cursor: 'pointer',
                      background: sel ? T.white : 'transparent',
                      boxShadow: sel ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      fontFamily: T.fontBody, fontSize: 13, fontWeight: sel ? 500 : 400,
                      color: sel ? T.ink : T.ink3,
                      transition: 'all 0.15s',
                    }}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>

            {/* Key input */}
            <div style={{ fontFamily: T.fontBody, fontSize: 12, color: T.ink3, marginBottom: 8 }}>API Key</div>
            <input
              type="password"
              value={keyInput}
              onChange={(e) => { setKeyInput(e.target.value); setSaved(false) }}
              placeholder={currentProvider?.placeholder}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: T.rMd,
                border: `0.5px solid ${T.border}`, background: T.bgSub,
                fontFamily: T.fontBody, fontSize: 13, color: T.ink2, outline: 'none',
                marginBottom: 8, boxSizing: 'border-box',
              }}
            />
            <p style={{ fontFamily: T.fontBody, fontSize: 11, color: T.ink4, lineHeight: 1.5, marginBottom: 14 }}>
              {currentProvider?.hint} · Stored securely in your profile and never shared.
            </p>

            <button onClick={saveKey} disabled={saving} style={{
              padding: '10px 20px', borderRadius: T.rMd,
              background: saved ? T.accentBg : T.accent, border: 'none',
              color: saved ? T.accent : '#fff',
              fontFamily: T.fontBody, fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}>
              {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save key'}
            </button>
            {saveError && <p style={{ fontFamily: T.fontBody, fontSize: 12, color: T.pass, marginTop: 8 }}>{saveError}</p>}
          </div>
        </div>

        {/* Voice & Audio */}
        <div style={{ background: T.white, borderRadius: T.rLg, border: `0.5px solid ${T.border}`, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '16px 18px' }}>
            <div style={{ fontFamily: T.fontBody, fontSize: 12, fontWeight: 500, color: T.ink4, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>Voice & Audio</div>

            <div style={{ fontFamily: T.fontBody, fontSize: 12, color: T.ink3, marginBottom: 8 }}>ElevenLabs API Key</div>
            <input
              type="password"
              value={elKey}
              onChange={(e) => { setElKey(e.target.value); setElSaved(false) }}
              placeholder="your-elevenlabs-key"
              style={{
                width: '100%', padding: '10px 12px', borderRadius: T.rMd,
                border: `0.5px solid ${T.border}`, background: T.bgSub,
                fontFamily: T.fontBody, fontSize: 13, color: T.ink2, outline: 'none',
                marginBottom: 6, boxSizing: 'border-box',
              }}
            />
            <p style={{ fontFamily: T.fontBody, fontSize: 11, color: T.ink4, lineHeight: 1.5, marginBottom: 14 }}>
              Get your key at elevenlabs.io · Narrations are generated once and cached for all users.
            </p>

            <div style={{ fontFamily: T.fontBody, fontSize: 12, color: T.ink3, marginBottom: 10 }}>Voice</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {EL_VOICES.map((v) => {
                const sel = elVoice === v.id
                return (
                  <button
                    key={v.id}
                    onClick={() => { setElVoice(v.id); setElSaved(false) }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderRadius: T.rMd, cursor: 'pointer', textAlign: 'left',
                      background: sel ? T.accentBg : T.bgSub,
                      border: `${sel ? 1.5 : 0.5}px solid ${sel ? T.accent : T.border}`,
                    }}
                  >
                    <div>
                      <span style={{ fontFamily: T.fontBody, fontSize: 13, fontWeight: sel ? 500 : 400, color: sel ? T.accent : T.ink }}>{v.label}</span>
                      <span style={{ fontFamily: T.fontBody, fontSize: 11, color: T.ink4, marginLeft: 8 }}>{v.description}</span>
                    </div>
                    {sel && (
                      <div style={{ width: 16, height: 16, borderRadius: '50%', background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 4l2 2 4-4"/></svg>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            <button onClick={saveElevenLabs} disabled={elSaving} style={{
              padding: '10px 20px', borderRadius: T.rMd,
              background: elSaved ? T.accentBg : T.accent, border: 'none',
              color: elSaved ? T.accent : '#fff',
              fontFamily: T.fontBody, fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}>
              {elSaving ? 'Saving…' : elSaved ? 'Saved ✓' : 'Save voice settings'}
            </button>
            {elSaveError && <p style={{ fontFamily: T.fontBody, fontSize: 12, color: T.pass, marginTop: 8 }}>{elSaveError}</p>}
          </div>
        </div>

        {/* Account */}
        <div style={{ background: T.white, borderRadius: T.rLg, border: `0.5px solid ${T.border}`, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '16px 18px' }}>
            <div style={{ fontFamily: T.fontBody, fontSize: 14, fontWeight: 500, color: T.ink, marginBottom: 4 }}>Signed in as</div>
            <div style={{ fontFamily: T.fontBody, fontSize: 13, color: T.ink3 }}>{user?.email}</div>
          </div>
        </div>

        <button onClick={async () => { await supabase.auth.signOut(); onSignOut() }} style={{
          width: '100%', padding: '14px', borderRadius: T.rMd,
          background: 'transparent', border: `0.5px solid ${T.border}`,
          fontFamily: T.fontBody, fontSize: 14, color: T.ink2, cursor: 'pointer',
        }}>
          Sign out
        </button>
      </div>
    </div>
  )
}
