export const T = {
  bg:        '#FAFAF9',
  bgSub:     '#F4F2EE',
  white:     '#FFFFFF',
  border:    'rgba(28,23,19,0.10)',
  borderMid: 'rgba(28,23,19,0.14)',
  ink:       '#1C1713',
  ink2:      '#3A332C',
  ink3:      '#6A6157',
  ink4:      '#9C948C',
  accent:    '#0C888B',
  accentBg:  'rgba(12,136,139,0.10)',
  accentMid: 'rgba(12,136,139,0.20)',
  like:      '#6DB87A',
  pass:      '#E05C5C',

  fontDisplay: "'Fraunces', Georgia, serif",
  fontBody:    "'Inter', system-ui, sans-serif",

  rSm:    '6px',
  rMd:    '8px',
  rLg:    '12px',
  rXl:    '16px',
  r50:    '50px',
  rPill:  '100px',
  rCircle:'50%',

  shadowSwipeCard: '0 8px 40px -8px rgba(0,0,0,0.28), 0 2px 8px -2px rgba(0,0,0,0.12)',
  shadowFab:       '0 4px 16px -4px rgba(0,0,0,0.35)',
}

export const iiif = (imageId, width = '400,') =>
  `https://www.artic.edu/iiif/2/${imageId}/full/${width}/0/default.jpg`
