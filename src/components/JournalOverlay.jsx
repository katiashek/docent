import { useState } from 'react'
import { T } from '../tokens.js'
import { useAppState } from '../state/useAppState.js'

export default function JournalOverlay({ artwork, onClose }) {
  const { journalNotes, saveJournalNote } = useAppState()
  const existing = journalNotes[artwork.id]
  const [text, setText] = useState(existing?.text || '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    await saveJournalNote(artwork.id, artwork.title, artwork, text)
    setSaving(false)
    onClose()
  }

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 60 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(10,8,6,0.45)' }} />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: T.white, borderRadius: '20px 20px 0 0',
        padding: '16px 20px 32px',
        animation: 'slideUp 0.28s ease',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{ width: 36, height: 4, borderRadius: T.rPill, background: 'rgba(28,23,19,0.12)' }} />
        </div>
        <div style={{ fontFamily: T.fontDisplay, fontSize: 18, fontWeight: 500, color: T.ink, marginBottom: 4 }}>
          {artwork.title}
        </div>
        <div style={{ fontFamily: T.fontBody, fontSize: 12, color: T.ink3, marginBottom: 16 }}>
          {artwork.artist_display?.split('\n')[0]}
        </div>
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What struck you about this work?"
          rows={5}
          style={{
            width: '100%', padding: '14px 16px',
            fontFamily: T.fontBody, fontSize: 14, lineHeight: 1.65,
            color: T.ink2, background: T.bgSub,
            border: `0.5px solid ${T.border}`, borderRadius: T.rLg,
            outline: 'none', marginBottom: 16,
          }}
        />
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '14px', borderRadius: T.rMd,
              background: 'transparent', border: `0.5px solid ${T.border}`,
              fontFamily: T.fontBody, fontSize: 14, color: T.ink2, cursor: 'pointer',
            }}
          >Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 2, padding: '14px', borderRadius: T.rMd,
              background: T.ink, border: 'none',
              fontFamily: T.fontBody, fontSize: 14, fontWeight: 500,
              color: T.bg, cursor: 'pointer',
            }}
          >{saving ? 'Saving…' : 'Save note'}</button>
        </div>
      </div>
    </div>
  )
}
