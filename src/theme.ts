export interface Theme {
  id: 'night' | 'color' | 'print'
  turf: [string, string]
  endZone: string
  line: string
  lineSoft: string
  number: string
  numberStroke: string
  los: string
  losGlow: boolean
  grain: boolean
  vignette: string | null
  outlineOnly: boolean
  routeOutline: string
  label: string
  badgeFill: string
  badgeStroke: string
  badgeText: string
  ballFill: string
  ballStroke: string
  page: string
  title: string
  muted: string
  interactive: boolean
}

export const COLOR_TURF_A = '#2f9a4a'

/** Bright orange sampled from the Dawgs lettering (most common letter pixel). */
export const ACCENT = '#F9682D'

export const NIGHT: Theme = {
  id: 'night',
  turf: ['#1b6b3c', '#165a33'],
  endZone: '#0e3a2c',
  line: 'rgba(255,255,255,0.92)',
  lineSoft: 'rgba(255,255,255,0.55)',
  number: '#f7fafc',
  numberStroke: '#0c3320',
  los: '#ffffff',
  losGlow: true,
  grain: true,
  vignette: '#02140c',
  outlineOnly: false,
  routeOutline: '#07140e',
  label: '#f8fafc',
  badgeFill: '#141414',
  badgeStroke: '#ffffff',
  badgeText: '#ffffff',
  ballFill: '#6b3a1f',
  ballStroke: '#f3e6c8',
  page: '#0E0E10',
  title: '#ffffff',
  muted: '#A8A8A8',
  interactive: true,
}

export const COLOR_FIELD: Theme = {
  id: 'color',
  turf: [COLOR_TURF_A, '#278a41'],
  endZone: '#1b6e38',
  line: 'rgba(255,255,255,0.95)',
  lineSoft: 'rgba(255,255,255,0.7)',
  number: '#ffffff',
  numberStroke: '#14532d',
  los: '#ffffff',
  losGlow: false,
  grain: true,
  vignette: '#06331a',
  outlineOnly: false,
  routeOutline: '#102018',
  label: '#f8fafc',
  badgeFill: '#102018',
  badgeStroke: '#ffffff',
  badgeText: '#ffffff',
  ballFill: '#7c3f16',
  ballStroke: '#fff7e8',
  page: '#f7f6f1',
  title: '#102033',
  muted: '#3d4a5c',
  interactive: false,
}

export const PRINT: Theme = {
  id: 'print',
  turf: ['#ffffff', '#ffffff'],
  endZone: '#f3f4f6',
  line: '#1a1a1a',
  lineSoft: '#4b5563',
  number: '#111111',
  numberStroke: 'none',
  los: '#111111',
  losGlow: false,
  grain: false,
  vignette: null,
  outlineOnly: true,
  routeOutline: '#ffffff',
  label: '#111111',
  badgeFill: '#ffffff',
  badgeStroke: '#111111',
  badgeText: '#111111',
  ballFill: '#ffffff',
  ballStroke: '#111111',
  page: '#ffffff',
  title: '#111111',
  muted: '#374151',
  interactive: false,
}
