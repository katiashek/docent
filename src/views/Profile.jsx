import { useEffect, useState } from 'react'
import { T, iiif } from '../tokens.js'
import { useAppState } from '../state/useAppState.js'
import { generateCollectionSummary } from '../services/llm.js'
import { supabase } from '../supabase.js'

const FILTER_OPTIONS = ['All', 'Visited', 'Unvisited', 'By style']

export default function Profile({ onResumeTour }) {
  const { user, bookmarks, journalNotes, llmConfig, savedTours } = useAppState()
  const [tab, setTab] = useState('saved')
  const [filter, setFilter] = useState('All')
  const [savedWorks, setSavedWorks] = useState([])
  const [journalEntries, setJournalEntries] = useState([])
  const [aiLine, setAiLine] = useState('')
  const [loadingWorks, setLoadingWorks] = useState(false)

  useEffect(() => { loadData() }, [user])

  async function loadData() {
    if (!user) return
    setLoadingWorks(true)
    try {
      const { data: bkData } = await supabase.from('bookmarks').select('*').eq('user_id', user.id)
      setSavedWorks(bkData || [])

      const { data: jData } = await supabase.from('journal_notes').select('*').eq('user_id', user.id).order('updated_at', { ascending: false })
      setJournalEntries(jData || [])

      if (llmConfig?.apiKey && bkData?.length && bkData.length % 5 === 0) {
        const line = await generateCollectionSummary(llmConfig, bkData.map((b) => b.artwork_data || { title: b.artwork_id }))
        setAiLine(line)
      }
    } catch {}
    setLoadingWorks(false)
  }

  const filteredWorks = savedWorks.filter((w) => {
    if (filter === 'All') return true
    if (filter === 'Visited') return w.visited
    if (filter === 'Unvisited') return !w.visited
    return true
  })

  const firstImgId = savedWorks[0]?.artwork_data?.image_id

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: T.bg, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ position: 'relative', background: T.white, borderBottom: `0.5px solid ${T.border}`, flexShrink: 0, overflow: 'hidden' }}>
        {firstImgId && (
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.06,
            backgroundImage: `url(${iiif(firstImgId, '400,')})`,
            backgroundSize: 'cover', backgroundPosition: 'center',
          }} />
        )}
        <div style={{ position: 'relative', padding: '16px 20px 0' }}>
          <div style={{ fontFamily: T.fontBody, fontSize: 12, color: T.ink4, fontStyle: 'italic', marginBottom: 10, lineHeight: 1.5 }}>
            {aiLine || 'Your curatorial eye is taking shape.'}{' '}
            <strong style={{ fontWeight: 500, fontStyle: 'normal' }}>{savedWorks.length} works saved.</strong>
          </div>
          <div style={{ display: 'flex', gap: 0, borderBottom: `0.5px solid ${T.border}` }}>
            {[['saved', 'Saved works'], ['journal', 'Journal'], ['tours', 'Tours']].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} style={{
                padding: '10px 20px 12px', background: 'none', border: 'none',
                fontFamily: T.fontBody, fontSize: 13, fontWeight: tab === id ? 500 : 400,
                color: tab === id ? T.ink : T.ink3, cursor: 'pointer', position: 'relative',
              }}>
                {label}
                {tab === id && <div style={{ position: 'absolute', bottom: 0, left: 20, right: 20, height: 1.5, background: T.accent, borderRadius: T.rPill }} />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Saved tab */}
      {tab === 'saved' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', display: 'flex', gap: 7, overflowX: 'auto', flexShrink: 0 }}>
            {FILTER_OPTIONS.map((f) => {
              const sel = filter === f
              return (
                <button key={f} onClick={() => setFilter(f)} style={{
                  padding: '6px 14px', borderRadius: T.rPill, whiteSpace: 'nowrap',
                  border: `${sel ? 1.5 : 0.5}px solid ${sel ? T.accent : T.border}`,
                  background: sel ? T.accentBg : T.white,
                  fontFamily: T.fontBody, fontSize: 12, fontWeight: sel ? 500 : 400,
                  color: sel ? T.accent : T.ink2, cursor: 'pointer',
                }}>{f}</button>
              )
            })}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 12px 20px' }}>
            {filteredWorks.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <p style={{ fontFamily: T.fontBody, fontSize: 14, color: T.ink4 }}>No saved works yet. Bookmark artworks during your tour.</p>
              </div>
            ) : (
              <div style={{ columns: 2, columnGap: 10 }}>
                {filteredWorks.map((w, i) => {
                  const artwork = w.artwork_data || {}
                  const imgId = artwork.image_id
                  const note = journalNotes[w.artwork_id]
                  return (
                    <div key={w.id} style={{ breakInside: 'avoid', marginBottom: 10, background: T.white, borderRadius: T.rLg, border: `0.5px solid ${T.border}`, overflow: 'hidden' }}>
                      <div style={{ position: 'relative' }}>
                        {imgId ? (
                          <img src={iiif(imgId, '300,')} alt={artwork.title || w.artwork_id} style={{ width: '100%', display: 'block', aspectRatio: i % 3 === 0 ? '4/5' : '3/4', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', aspectRatio: '4/5', background: T.bgSub }} />
                        )}
                        {w.visited && (
                          <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(10,8,6,0.65)', borderRadius: T.rPill, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M1.5 4l1.5 1.5 3.5-3.5"/></svg>
                            <span style={{ fontFamily: T.fontBody, fontSize: 9, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>visited</span>
                          </div>
                        )}
                      </div>
                      <div style={{ padding: '10px 12px 12px' }}>
                        <div style={{ fontFamily: T.fontBody, fontSize: 12, fontWeight: 500, color: T.ink, lineHeight: 1.3, marginBottom: 2 }}>{artwork.title || w.artwork_id}</div>
                        <div style={{ fontFamily: T.fontBody, fontSize: 11, color: T.ink3, marginBottom: note?.text ? 8 : 0 }}>{artwork.artist_display?.split('\n')[0]}</div>
                        {note?.text && (
                          <div style={{
                            fontFamily: T.fontBody, fontSize: 11, lineHeight: 1.55, color: T.ink3,
                            fontStyle: 'italic', borderTop: `0.5px solid ${T.border}`, paddingTop: 8,
                            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                          }}>&ldquo;{note.text}&rdquo;</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Journal tab */}
      {tab === 'journal' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0 24px' }}>
          {journalEntries.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <p style={{ fontFamily: T.fontBody, fontSize: 14, color: T.ink4 }}>No journal entries yet. Add notes to artworks during your tour.</p>
            </div>
          ) : journalEntries.map((entry, i) => {
            const artwork = entry.artwork_data || {}
            const imgId = artwork.image_id
            const date = new Date(entry.updated_at)
            const now = new Date()
            const diffDays = Math.floor((now - date) / 86400000)
            const dateStr = diffDays === 0 ? 'Today' : diffDays === 1 ? 'Yesterday' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            return (
              <div key={entry.id} style={{
                display: 'flex', gap: 14, padding: '16px 20px',
                borderBottom: `0.5px solid ${T.border}`, background: T.white,
                marginBottom: i < journalEntries.length - 1 ? 1 : 0,
              }}>
                <div style={{ width: 52, height: 52, borderRadius: T.rMd, overflow: 'hidden', flexShrink: 0, border: `0.5px solid ${T.border}`, background: T.bgSub }}>
                  {imgId && <img src={iiif(imgId, '200,')} alt={entry.artwork_title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ fontFamily: T.fontBody, fontSize: 12, fontWeight: 500, color: T.ink }}>{entry.artwork_title}</div>
                    <div style={{ fontFamily: T.fontBody, fontSize: 11, color: T.ink4, flexShrink: 0, marginLeft: 8 }}>{dateStr}</div>
                  </div>
                  <div style={{ fontFamily: T.fontBody, fontSize: 11, color: T.ink3, marginBottom: 8 }}>{artwork.artist_display?.split('\n')[0]}</div>
                  <div style={{ fontFamily: T.fontBody, fontSize: 13, lineHeight: 1.65, color: T.ink2, fontStyle: 'italic' }}>
                    &ldquo;{entry.note_text}&rdquo;
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Tours tab */}
      {tab === 'tours' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0 24px' }}>
          {savedTours.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <p style={{ fontFamily: T.fontBody, fontSize: 14, color: T.ink4 }}>No saved tours yet. Build a tour and tap Save tour to keep it here.</p>
            </div>
          ) : savedTours.map((tour, i) => {
            const stopCount = tour.stops?.flatMap((g) => g.stops).length || 0
            const galleryCount = tour.stops?.length || 0
            const savedDate = new Date(tour.savedAt)
            const now = new Date()
            const diffDays = Math.floor((now - savedDate) / 86400000)
            const dateStr = diffDays === 0 ? 'Today' : diffDays === 1 ? 'Yesterday' : savedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            const firstImageId = tour.stops?.[0]?.stops?.[0]?.image_id
            return (
              <div key={tour.builtAt} style={{
                display: 'flex', gap: 14, padding: '16px 20px',
                borderBottom: `0.5px solid ${T.border}`, background: T.white,
                marginBottom: i < savedTours.length - 1 ? 1 : 0,
              }}>
                <div style={{ width: 52, height: 52, borderRadius: T.rMd, overflow: 'hidden', flexShrink: 0, border: `0.5px solid ${T.border}`, background: T.bgSub }}>
                  {firstImageId && <img src={iiif(firstImageId, '200,')} alt="tour" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <div style={{ fontFamily: T.fontBody, fontSize: 12, fontWeight: 500, color: T.ink, lineHeight: 1.3, flex: 1, marginRight: 8 }}>
                      {tour.brief || `${stopCount}-stop tour`}
                    </div>
                    <div style={{ fontFamily: T.fontBody, fontSize: 11, color: T.ink4, flexShrink: 0 }}>{dateStr}</div>
                  </div>
                  <div style={{ fontFamily: T.fontBody, fontSize: 11, color: T.ink3, marginBottom: 10 }}>
                    {stopCount} stops · {galleryCount} {galleryCount === 1 ? 'gallery' : 'galleries'} · {Math.round((tour.minutes || 60))} min
                  </div>
                  <button
                    onClick={() => onResumeTour?.(tour)}
                    style={{
                      padding: '6px 14px', borderRadius: T.rPill,
                      background: T.accent, border: 'none',
                      fontFamily: T.fontBody, fontSize: 12, fontWeight: 500,
                      color: '#fff', cursor: 'pointer',
                    }}
                  >
                    Resume tour
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
