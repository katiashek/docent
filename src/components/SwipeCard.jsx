import { useRef, useState } from 'react'
import { T, iiif } from '../tokens.js'

const DRAG_THRESHOLD = 80
const ROTATION_MAX = 16

export default function SwipeCard({ artwork, onLike, onPass, onTap, isPeek }) {
  const [drag, setDrag] = useState({ x: 0, y: 0, dragging: false })
  const [flyOff, setFlyOff] = useState(null)
  const startRef = useRef(null)
  const cardRef = useRef(null)

  const imageUrl = iiif(artwork.image_id, '843,')
  const dominantColor = artwork.color
    ? `hsl(${artwork.color.h},${artwork.color.s}%,${artwork.color.l}%)`
    : T.ink4

  function triggerFly(direction) {
    setFlyOff(direction)
    setTimeout(() => {
      if (direction === 'right') onLike(artwork)
      else onPass(artwork)
    }, 340)
  }

  function onPointerDown(e) {
    if (isPeek) return
    startRef.current = { x: e.clientX, y: e.clientY }
    setDrag({ x: 0, y: 0, dragging: true })
    cardRef.current?.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e) {
    if (!drag.dragging || !startRef.current) return
    setDrag((d) => ({
      ...d,
      x: e.clientX - startRef.current.x,
      y: e.clientY - startRef.current.y,
    }))
  }

  function onPointerUp() {
    if (!drag.dragging) return
    // Treat minimal movement as a tap → open zoom
    if (Math.abs(drag.x) < 6 && Math.abs(drag.y) < 6) {
      setDrag({ x: 0, y: 0, dragging: false })
      if (!isPeek) onTap?.(artwork)
      return
    }
    if (drag.x > DRAG_THRESHOLD) triggerFly('right')
    else if (drag.x < -DRAG_THRESHOLD) triggerFly('left')
    else setDrag({ x: 0, y: 0, dragging: false })
  }

  const rotation = flyOff
    ? flyOff === 'right' ? 8 : -8
    : drag.x * 0.04
  const translateX = flyOff
    ? flyOff === 'right' ? 420 : -420
    : drag.x
  const likeOpacity = Math.min(1, Math.max(0, drag.x / 120))
  const passOpacity = Math.min(1, Math.max(0, -drag.x / 120))

  const cardStyle = {
    position: 'absolute',
    inset: 0,
    borderRadius: T.rXl,
    overflow: 'hidden',
    background: dominantColor + '33',
    border: '1px solid rgba(0,0,0,0.10)',
    boxShadow: isPeek ? 'none' : T.shadowSwipeCard,
    transform: flyOff
      ? `translateX(${translateX}px) rotate(${rotation}deg)`
      : `translateX(${drag.x}px) translateY(${drag.y}px) rotate(${rotation}deg)`,
    transition: flyOff
      ? 'transform 0.34s cubic-bezier(.2,.9,.3,1.2), opacity 0.34s'
      : drag.dragging ? 'none' : 'transform 0.3s cubic-bezier(.2,.9,.3,1.2)',
    opacity: flyOff ? 0 : 1,
    cursor: isPeek ? 'default' : 'grab',
    userSelect: 'none',
    zIndex: isPeek ? 1 : 2,
    ...(isPeek && {
      transform: 'scale(0.95) translateY(8px)',
      opacity: 0.7,
    }),
    touchAction: 'none',
  }

  return (
    <div
      ref={cardRef}
      style={cardStyle}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <img
        src={imageUrl}
        alt={artwork.title}
        draggable={false}
        style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
      />

      {/* Like stamp */}
      <div style={{
        position: 'absolute', top: 24, left: 20,
        transform: 'rotate(-12deg)',
        opacity: likeOpacity,
        border: `2.5px solid ${T.like}`,
        borderRadius: T.rMd,
        padding: '4px 10px',
        color: T.like,
        fontFamily: T.fontBody,
        fontSize: 18,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        pointerEvents: 'none',
      }}>Like</div>

      {/* Pass stamp */}
      <div style={{
        position: 'absolute', top: 24, right: 20,
        transform: 'rotate(12deg)',
        opacity: passOpacity,
        border: `2.5px solid ${T.pass}`,
        borderRadius: T.rMd,
        padding: '4px 10px',
        color: T.pass,
        fontFamily: T.fontBody,
        fontSize: 18,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        pointerEvents: 'none',
      }}>Pass</div>

      {/* Bottom overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to top, rgba(10,8,6,0.92) 0%, rgba(10,8,6,0.72) 60%, transparent 100%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        padding: '48px 20px 20px',
        pointerEvents: 'none',
      }}>
        {/* Tags */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {[artwork.style_title, artwork.department_title].filter(Boolean).slice(0, 2).map((tag) => (
            <span key={tag} style={{
              fontFamily: T.fontBody, fontSize: 10, fontWeight: 500,
              color: 'white', background: 'rgba(255,255,255,0.12)',
              border: '0.5px solid rgba(255,255,255,0.2)',
              borderRadius: T.rPill, padding: '3px 9px',
            }}>{tag}</span>
          ))}
        </div>

        <div style={{
          fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 500,
          color: 'white', letterSpacing: '-0.015em', lineHeight: 1.2,
          marginBottom: 6,
        }}>{artwork.title}</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: T.rCircle,
            background: dominantColor,
            border: '1.5px solid rgba(255,255,255,0.25)',
            flexShrink: 0,
          }} />
          <div>
            <div style={{ fontFamily: T.fontBody, fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
              {artwork.artist_display?.split('\n')[0]}
            </div>
            {artwork.gallery_title && (
              <div style={{ fontFamily: T.fontBody, fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                {artwork.gallery_title}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
