import { useEffect, useRef, useState } from 'react'
import { T } from '../tokens.js'
import { supabase } from '../supabase.js'
import { generateSpeech, DEFAULT_VOICE_ID } from '../services/elevenlabs.js'

const SPEEDS = [0.75, 1, 1.25, 1.5, 2]
const WPM = 130

export default function NarrationPlayer({ text, artworkId, elevenLabsConfig, onProgress }) {
  const mountedRef = useRef(true)
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false } }, [])

  // ── ElevenLabs / <audio> state ───────────────────────────────────────────
  const [elFailed, setElFailed] = useState(false) // true = silently fell back to WSA
  const [audioUrl, setAudioUrl] = useState(null)
  // 'idle' | 'loading' | 'ready' | 'error'
  const [audioStatus, setAudioStatus] = useState('idle')
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const audioRef = useRef(null)
  const generatingRef = useRef(false) // guard against duplicate generation

  // ── Shared ───────────────────────────────────────────────────────────────
  const hasElevenLabs = !!elevenLabsConfig?.apiKey && !elFailed
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)

  // ── Web Speech API fallback ──────────────────────────────────────────────
  const utterRef    = useRef(null)
  const wsaTimerRef = useRef(null)
  const wsaStartRef = useRef(null)
  const [wsaElapsed, setWsaElapsed] = useState(0)
  const words    = text?.split(/\s+/) || []
  const wsaTotal = Math.round(words.length / (WPM / 60))

  // Reset + kick off audio load when artwork changes
  useEffect(() => {
    setPlaying(false)
    setCurrentTime(0)
    setWsaElapsed(0)
    window.speechSynthesis?.cancel()
    clearInterval(wsaTimerRef.current)

    if (hasElevenLabs && artworkId && text) {
      generatingRef.current = false
      setElFailed(false)
      setAudioStatus('loading')
      setAudioUrl(null)
      setTimeout(() => tryStorageUrl(), 50)
    }

    return () => {
      window.speechSynthesis?.cancel()
      clearInterval(wsaTimerRef.current)
      if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null }
    }
  }, [artworkId]) // eslint-disable-line

  function tryStorageUrl() {
    const { data: { publicUrl } } = supabase.storage
      .from('narration-audio')
      .getPublicUrl(`${artworkId}.mp3`)
    setAudioUrl(publicUrl)
    // onCanPlay → 'ready'; onError → generateFromElevenLabs
  }

  const blobUrlRef = useRef(null)

  async function generateFromElevenLabs() {
    if (generatingRef.current) return
    generatingRef.current = true
    const voiceId = elevenLabsConfig?.voiceId || DEFAULT_VOICE_ID
    try {
      const blob = await generateSpeech(elevenLabsConfig.apiKey, voiceId, text)
      if (!mountedRef.current) return
      let finalUrl
      try {
        const filename = `${artworkId}.mp3`
        await supabase.storage.from('narration-audio').upload(filename, blob, {
          contentType: 'audio/mpeg', upsert: true,
        })
        const { data: { publicUrl } } = supabase.storage.from('narration-audio').getPublicUrl(filename)
        finalUrl = publicUrl
      } catch {
        // Storage bucket not set up — use in-session blob URL
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
        finalUrl = URL.createObjectURL(blob)
        blobUrlRef.current = finalUrl
      }
      if (!mountedRef.current) return
      setAudioUrl(finalUrl)
      // onCanPlay will fire next and set status → 'ready'
    } catch (err) {
      if (!mountedRef.current) return
      console.warn('[ElevenLabs] failed, falling back to Web Speech API:', err.message)
      setElFailed(true)
      setAudioStatus('idle')
      generatingRef.current = false
    }
  }

  // ── Audio element event handlers ─────────────────────────────────────────

  function onCanPlay() {
    setAudioStatus('ready')
    generatingRef.current = false
    if (audioRef.current) audioRef.current.playbackRate = speed
  }
  function onTimeUpdate() {
    const el = audioRef.current
    if (!el?.duration) return
    setCurrentTime(el.currentTime)
    onProgress?.(el.currentTime / el.duration)
  }
  function onEnded() {
    setPlaying(false)
    onProgress?.(1)
  }
  function onDurationChange() {
    setDuration(audioRef.current?.duration || 0)
  }
  function onAudioError() {
    if (generatingRef.current) return // already generating, ignore stale error
    if (!elevenLabsConfig?.apiKey || !text || !artworkId) {
      setAudioStatus('error')
      return
    }
    setAudioUrl(null)
    generateFromElevenLabs()
  }

  // Apply speed change live (audio element only; WSA handled at play-time)
  useEffect(() => {
    if (audioRef.current && audioStatus === 'ready') {
      audioRef.current.playbackRate = speed
    }
  }, [speed, audioStatus])

  // ── Playback controls ────────────────────────────────────────────────────

  function audioPlay() {
    if (!audioRef.current || audioStatus !== 'ready') return
    audioRef.current.playbackRate = speed
    audioRef.current.play()
      .then(() => setPlaying(true))
      .catch(() => {})
  }
  function audioPause() {
    audioRef.current?.pause()
    setPlaying(false)
  }
  function audioSeek(delta) {
    if (!audioRef.current) return
    audioRef.current.currentTime = Math.max(0, Math.min(duration, currentTime + delta))
  }
  function audioSeekTo(fraction) {
    if (!audioRef.current || !duration) return
    audioRef.current.currentTime = fraction * duration
  }

  function wsaPlay() {
    if (!text) return
    window.speechSynthesis?.cancel()
    clearInterval(wsaTimerRef.current)
    const utter = new SpeechSynthesisUtterance(text)
    utter.rate = speed * 0.92
    utter.onend = () => { setPlaying(false); setWsaElapsed(wsaTotal); clearInterval(wsaTimerRef.current) }
    utterRef.current = utter
    window.speechSynthesis?.speak(utter)
    setPlaying(true)
    wsaStartRef.current = Date.now() - wsaElapsed * 1000
    wsaTimerRef.current = setInterval(() => {
      const el = (Date.now() - wsaStartRef.current) / 1000
      setWsaElapsed(el)
      onProgress?.(Math.min(1, el / wsaTotal))
    }, 200)
  }
  function wsaPause() {
    window.speechSynthesis?.pause()
    setPlaying(false)
    clearInterval(wsaTimerRef.current)
  }
  function wsaResume() {
    window.speechSynthesis?.resume()
    setPlaying(true)
    wsaStartRef.current = Date.now() - wsaElapsed * 1000
    wsaTimerRef.current = setInterval(() => {
      const el = (Date.now() - wsaStartRef.current) / 1000
      setWsaElapsed(el)
      onProgress?.(Math.min(1, el / wsaTotal))
    }, 200)
  }

  function handleSpeedChange(s) {
    setSpeed(s)
    // WSA can't change rate mid-utterance — restart from beginning
    if (!hasElevenLabs && playing) {
      window.speechSynthesis?.cancel()
      clearInterval(wsaTimerRef.current)
      setWsaElapsed(0)
      setPlaying(false)
    }
  }

  function handlePlayPause() {
    if (hasElevenLabs) {
      playing ? audioPause() : audioPlay()
    } else {
      if (playing) wsaPause()
      else if (wsaElapsed > 0) wsaResume()
      else wsaPlay()
    }
  }

  // ── Display values ───────────────────────────────────────────────────────

  const progress    = hasElevenLabs
    ? (duration > 0 ? currentTime / duration : 0)
    : (wsaTotal > 0 ? Math.min(1, wsaElapsed / wsaTotal) : 0)
  const dispElapsed = hasElevenLabs ? currentTime : wsaElapsed
  const dispTotal   = hasElevenLabs ? duration    : wsaTotal
  const canPlay   = hasElevenLabs ? audioStatus === 'ready' : true
  const isLoading = hasElevenLabs && audioStatus === 'loading'

  const fmt = (s) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`

  return (
    <div style={{ padding: '0 20px 20px' }}>
      {/* Hidden audio element */}
      {hasElevenLabs && (
        <audio
          ref={audioRef}
          src={audioUrl || undefined}
          onCanPlay={onCanPlay}
          onTimeUpdate={onTimeUpdate}
          onEnded={onEnded}
          onDurationChange={onDurationChange}
          onError={onAudioError}
          preload="auto"
        />
      )}

      {/* Loading */}
      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 80, paddingTop: 14 }}>
          <div style={{ width: 12, height: 12, border: `1.5px solid ${T.border}`, borderTopColor: T.accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
          <span style={{ fontFamily: T.fontBody, fontSize: 12, color: T.ink4 }}>Generating audio…</span>
        </div>
      )}

      {/* Player */}
      {!isLoading && (
        <>
          {/* Progress bar */}
          <div
            style={{ height: 3, background: T.bgSub, borderRadius: T.rPill, marginBottom: 8, cursor: canPlay ? 'pointer' : 'default' }}
            onClick={(e) => {
              if (!hasElevenLabs || !canPlay) return
              const rect = e.currentTarget.getBoundingClientRect()
              audioSeekTo((e.clientX - rect.left) / rect.width)
            }}
          >
            <div style={{ height: '100%', width: `${progress * 100}%`, background: T.accent, borderRadius: T.rPill }} />
          </div>

          {/* Time + speed */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontFamily: T.fontBody, fontSize: 11, color: T.ink4, minWidth: 28 }}>{fmt(dispElapsed)}</span>
            <div style={{ display: 'flex', gap: 3 }}>
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSpeedChange(s)}
                  style={{
                    padding: '3px 6px', borderRadius: T.rPill,
                    background: speed === s ? T.accentBg : 'transparent',
                    border: `0.5px solid ${speed === s ? T.accent : T.border}`,
                    fontFamily: T.fontBody, fontSize: 9, fontWeight: speed === s ? 600 : 400,
                    color: speed === s ? T.accent : T.ink4, cursor: 'pointer', transition: 'all 0.12s',
                  }}
                >
                  {s}×
                </button>
              ))}
            </div>
            <span style={{ fontFamily: T.fontBody, fontSize: 11, color: T.ink4, minWidth: 28, textAlign: 'right' }}>{fmt(dispTotal)}</span>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
            <button
              onClick={() => hasElevenLabs ? audioSeek(-15) : {}}
              style={{ background: 'none', border: 'none', cursor: hasElevenLabs ? 'pointer' : 'default', opacity: hasElevenLabs ? 1 : 0.3, width: 38, height: 38, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
            >
              <svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke={T.ink2} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 13a8 8 0 108-8H8"/><path d="M8 8L5 5l3-3"/>
              </svg>
              <span style={{ position: 'absolute', fontFamily: T.fontBody, fontSize: 8, fontWeight: 700, color: T.ink2, lineHeight: 1, pointerEvents: 'none', letterSpacing: '-0.02em' }}>15</span>
            </button>

            <button
              onClick={handlePlayPause}
              disabled={!canPlay}
              style={{ width: 40, height: 40, borderRadius: T.rCircle, background: T.accent, border: 'none', cursor: canPlay ? 'pointer' : 'default', opacity: canPlay ? 1 : 0.4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {playing
                ? <svg width="14" height="14" viewBox="0 0 14 14" fill="white"><rect x="2" y="1" width="4" height="12" rx="1"/><rect x="8" y="1" width="4" height="12" rx="1"/></svg>
                : <svg width="14" height="14" viewBox="0 0 14 14" fill="white"><polygon points="3,1 13,7 3,13"/></svg>
              }
            </button>

            <button
              onClick={() => hasElevenLabs ? audioSeek(15) : {}}
              style={{ background: 'none', border: 'none', cursor: hasElevenLabs ? 'pointer' : 'default', opacity: hasElevenLabs ? 1 : 0.3, width: 38, height: 38, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
            >
              <svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke={T.ink2} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 13a8 8 0 1 1-8-8H18"/><path d="M18 8L21 5l-3-3"/>
              </svg>
              <span style={{ position: 'absolute', fontFamily: T.fontBody, fontSize: 8, fontWeight: 700, color: T.ink2, lineHeight: 1, pointerEvents: 'none', letterSpacing: '-0.02em' }}>15</span>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
