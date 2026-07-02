import { T } from '../tokens.js'

export default function ProgressDots({ total, current }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: i === current ? 20 : 6,
            height: 6,
            borderRadius: T.rPill,
            background:
              i === current ? T.accent : i < current ? T.accentMid : 'rgba(28,23,19,0.12)',
            transition: 'all 0.3s cubic-bezier(.2,.9,.3,1.2)',
          }}
        />
      ))}
    </div>
  )
}
