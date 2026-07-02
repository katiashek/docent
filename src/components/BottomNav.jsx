import { T } from '../tokens.js'

const tabs = [
  {
    id: 'discover',
    label: 'Discover',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none"
        stroke={active ? T.accent : T.ink3}
        strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="9" />
        <path d="M14.5 7.5l-3 6-3-3 6-3z" />
      </svg>
    ),
  },
  {
    id: 'tour',
    label: 'My Tour',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none"
        stroke={active ? T.accent : T.ink3}
        strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6h14M4 11h14M4 16h9" />
      </svg>
    ),
  },
  {
    id: 'saved',
    label: 'Saved',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none"
        stroke={active ? T.accent : T.ink3}
        strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 3h12a1 1 0 011 1v15l-7-4-7 4V4a1 1 0 011-1z" />
      </svg>
    ),
  },
]

export default function BottomNav({ active, onNavigate }) {
  return (
    <div style={{
      height: 64,
      borderTop: `0.5px solid ${T.border}`,
      background: T.white,
      display: 'flex',
      paddingBottom: 8,
      flexShrink: 0,
    }}>
      {tabs.map((tab) => {
        const isActive = active === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => onNavigate(tab.id)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px 0 0',
            }}
          >
            {tab.icon(isActive)}
            <span style={{
              fontFamily: T.fontBody,
              fontSize: 10,
              fontWeight: 500,
              color: isActive ? T.accent : T.ink3,
              letterSpacing: '0.01em',
            }}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
