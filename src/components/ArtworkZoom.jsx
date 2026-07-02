import { T, iiif } from '../tokens.js'

export default function ArtworkZoom({ imageId, title, artist, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(10,8,6,0.97)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <img
        src={iiif(imageId, '1200,')}
        alt={title}
        draggable={false}
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '100%',
          maxHeight: '88vh',
          objectFit: 'contain',
          touchAction: 'pinch-zoom',
        }}
      />

      {/* Close */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 16, right: 16,
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(255,255,255,0.12)', border: 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
          <path d="M3 3l10 10M13 3L3 13"/>
        </svg>
      </button>

      {/* Title / artist */}
      {(title || artist) && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '24px 20px 44px',
          background: 'linear-gradient(to top, rgba(10,8,6,0.88) 0%, transparent 100%)',
          pointerEvents: 'none',
        }}>
          {title && (
            <div style={{
              fontFamily: T.fontDisplay, fontSize: 17, fontWeight: 500,
              color: '#fff', lineHeight: 1.25, marginBottom: 4,
            }}>{title}</div>
          )}
          {artist && (
            <div style={{ fontFamily: T.fontBody, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
              {artist}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
