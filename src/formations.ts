import { FIELD_WIDTH } from './geometry'
import { uid } from './id'
import type { FormatId, Player, Role, Shape, Side } from './types'

export interface Spot {
  label: string
  role: Role
  x: number
  y: number
}

export interface FormationTemplate {
  id: string
  name: string
  spots: Spot[]
}

/** Your team. Same orange as the old quarterback mark. */
export const OUR_COLOR = '#f0c14a'

/** The other team. Same lime as the old Y mark. */
export const THEIR_COLOR = '#d6f25a'

/** Path colors. None of these is the orange or the lime, so a line never matches a team. */
export const ROUTE_PALETTE = [
  '#38bdf8',
  '#fb7185',
  '#c084fc',
  '#22d3ee',
  '#f472b6',
  '#818cf8',
  '#f43f5e',
  '#a78bfa',
  '#7dd3fc',
  '#e879f9',
  '#60a5fa',
  '#fda4af',
] as const

export function shapeFor(role: Role): Shape {
  if (role === 'qb') return 'diamond'
  if (role === 'center' || role === 'ol' || role === 'dl') return 'square'
  return 'circle'
}

export function routeColorAt(index: number): string {
  const palette = ROUTE_PALETTE
  const wrapped = ((index % palette.length) + palette.length) % palette.length
  return palette[wrapped]
}

/** Yard line of the ball and the center, halfway between the sidelines. */
const C = FIELD_WIDTH / 2

function spot(label: string, role: Role, x: number, y: number): Spot {
  return { label, role, x, y }
}

const FIVE_DOUBLES: Spot[] = [
  spot('X', 'wr', 7.2, 0),
  spot('Y', 'wr', 36.4, -0.5),
  spot('Z', 'wr', 47, 0),
  spot('C', 'center', C, -0.65),
  spot('QB', 'qb', C, -5.1),
]

const FIVE_TRIPS: Spot[] = [
  spot('Y', 'wr', 32.8, -0.3),
  spot('H', 'wr', 39.2, 0.35),
  spot('Z', 'wr', 47.2, 0),
  spot('C', 'center', C, -0.65),
  spot('QB', 'qb', C, -5.1),
]

const FIVE_SPREAD: Spot[] = [
  spot('X', 'wr', 6.6, 0),
  spot('H', 'wr', 16.5, -0.4),
  spot('Z', 'wr', 46.8, 0),
  spot('C', 'center', C, -0.65),
  spot('QB', 'qb', C, -5.1),
]

const FORMATIONS: Record<FormatId, FormationTemplate[]> = {
  '5v5': [
    { id: 'doubles', name: 'Doubles', spots: FIVE_DOUBLES },
    { id: 'trips-right', name: 'Trips Right', spots: FIVE_TRIPS },
    { id: 'spread', name: 'Spread', spots: FIVE_SPREAD },
  ],
  '6v6': [
    { id: 'doubles', name: 'Doubles', spots: [...FIVE_DOUBLES, spot('RB', 'rb', 21.4, -5.5)] },
    { id: 'trips-right', name: 'Trips Right', spots: [...FIVE_TRIPS, spot('RB', 'rb', 20.5, -5.4)] },
  ],
  '7v7': [
    {
      id: 'spread',
      name: 'Spread',
      spots: [
        spot('LG', 'ol', 22.2, -0.45),
        spot('C', 'center', C, -0.6),
        spot('RG', 'ol', 31.2, -0.45),
        spot('QB', 'qb', C, -5.1),
        spot('X', 'wr', 6.8, 0),
        spot('Y', 'wr', 38.6, -0.35),
        spot('Z', 'wr', 47.2, 0),
      ],
    },
    {
      id: 'wing',
      name: 'Wing',
      spots: [
        spot('LG', 'ol', 22.2, -0.45),
        spot('C', 'center', C, -0.6),
        spot('RG', 'ol', 31.2, -0.45),
        spot('QB', 'qb', C, -5.1),
        spot('RB', 'rb', 22, -5.6),
        spot('X', 'wr', 7, 0),
        spot('Z', 'wr', 47, 0),
      ],
    },
  ],
  '8v8': [
    {
      id: 'spread',
      name: 'Spread',
      spots: [
        spot('LG', 'ol', 22.2, -0.45),
        spot('C', 'center', C, -0.6),
        spot('RG', 'ol', 31.2, -0.45),
        spot('QB', 'qb', C, -5.1),
        spot('RB', 'rb', 21.5, -5.6),
        spot('X', 'wr', 6.8, 0),
        spot('Y', 'wr', 38.6, -0.35),
        spot('Z', 'wr', 47.2, 0),
      ],
    },
    {
      id: 'pro',
      name: 'Pro',
      spots: [
        spot('LT', 'ol', 17.6, -0.4),
        spot('LG', 'ol', 22.2, -0.45),
        spot('C', 'center', C, -0.6),
        spot('RG', 'ol', 31.1, -0.45),
        spot('RT', 'ol', 35.6, -0.4),
        spot('QB', 'qb', C, -5.1),
        spot('X', 'wr', 6.5, 0),
        spot('Z', 'wr', 47.4, 0),
      ],
    },
  ],
  '9v9': [
    {
      id: 'spread',
      name: 'Spread',
      spots: [
        spot('LG', 'ol', 22.2, -0.45),
        spot('C', 'center', C, -0.6),
        spot('RG', 'ol', 31.2, -0.45),
        spot('QB', 'qb', C, -5.1),
        spot('RB', 'rb', 21.2, -5.7),
        spot('X', 'wr', 6.4, 0),
        spot('H', 'wr', 15.8, -0.3),
        spot('Y', 'wr', 39, -0.3),
        spot('Z', 'wr', 47.6, 0),
      ],
    },
    {
      id: 'pro',
      name: 'Pro',
      spots: [
        spot('LT', 'ol', 17.4, -0.4),
        spot('LG', 'ol', 22, -0.45),
        spot('C', 'center', C, -0.6),
        spot('RG', 'ol', 31.3, -0.45),
        spot('RT', 'ol', 35.8, -0.4),
        spot('QB', 'qb', C, -5.1),
        spot('RB', 'rb', 22.2, -5.8),
        spot('X', 'wr', 6.2, 0),
        spot('Z', 'wr', 47.6, 0),
      ],
    },
  ],
  '11v11': [
    {
      id: 'trips-bunch',
      name: 'Trips Bunch',
      spots: [
        spot('LT', 'ol', 17.4, 0),
        spot('LG', 'ol', 21.8, 0),
        spot('C', 'center', C, -0.15),
        spot('RG', 'ol', 31.5, 0),
        spot('RT', 'ol', 35.8, 0),
        spot('Y', 'te', 39.2, 0),
        spot('TE', 'te', 41.2, 0.35),
        spot('X', 'wr', 43.4, 0),
        spot('Z', 'wr', 6.2, 0),
        spot('QB', 'qb', C, -5),
        spot('RB', 'rb', C + 2.4, -5.1),
      ],
    },
    {
      id: 'shotgun-trips',
      name: 'Shotgun Trips',
      spots: [
        spot('LT', 'ol', 17.4, 0),
        spot('LG', 'ol', 21.8, 0),
        spot('C', 'center', C, -0.15),
        spot('RG', 'ol', 31.5, 0),
        spot('RT', 'ol', 35.8, 0),
        spot('TE', 'te', 40.4, 0),
        spot('Y', 'wr', 44.8, 0.15),
        spot('Z', 'wr', 49.6, 0),
        spot('X', 'wr', 5.5, 0),
        spot('QB', 'qb', C, -5.1),
        spot('RB', 'rb', 21.6, -6.3),
      ],
    },
    {
      id: 'ace',
      name: 'Ace Doubles',
      spots: [
        spot('LT', 'ol', 18.2, 0),
        spot('LG', 'ol', 22.6, 0),
        spot('C', 'center', C, -0.15),
        spot('RG', 'ol', 30.8, 0),
        spot('RT', 'ol', 35.2, 0),
        spot('H', 'wr', 13.2, 0),
        spot('Y', 'wr', 40.6, 0),
        spot('X', 'wr', 5.6, 0),
        spot('Z', 'wr', 48.2, 0),
        spot('QB', 'qb', C, -5),
        spot('RB', 'rb', 31.2, -6.2),
      ],
    },
    {
      id: 'i-form',
      name: 'I Form',
      spots: [
        spot('LT', 'ol', 18.4, -0.2),
        spot('LG', 'ol', 22.7, -0.25),
        spot('C', 'center', C, -0.3),
        spot('RG', 'ol', 30.6, -0.25),
        spot('RT', 'ol', 34.9, -0.2),
        spot('TE', 'te', 39.4, -0.15),
        spot('X', 'wr', 6, 0),
        spot('Z', 'wr', 47.6, 0),
        spot('QB', 'qb', C, -4.2),
        spot('FB', 'fb', C, -7.8),
        spot('RB', 'rb', C, -11.3),
      ],
    },
  ],
}

const DEFENSE: Record<FormatId, Spot[]> = {
  '5v5': [
    spot('M', 'lb', 23.2, 4.4),
    spot('W', 'lb', 31, 4.4),
    spot('LC', 'db', 8, 8.2),
    spot('S', 'db', 36.2, 6.8),
    spot('RC', 'db', 46.2, 8.2),
  ],
  '6v6': [
    spot('E', 'dl', 23, 3.8),
    spot('T', 'dl', 31, 3.8),
    spot('M', 'lb', 26.8, 6.2),
    spot('LC', 'db', 8, 8.4),
    spot('S', 'db', 36, 7.2),
    spot('RC', 'db', 46.4, 8.4),
  ],
  '7v7': [
    spot('E', 'dl', 22, 3.8),
    spot('T', 'dl', 31.2, 3.8),
    spot('M', 'lb', 26.7, 6.3),
    spot('W', 'lb', 16, 5.8),
    spot('LC', 'db', 8, 8.6),
    spot('S', 'db', 38.4, 7.2),
    spot('RC', 'db', 46.6, 8.6),
  ],
  '8v8': [
    spot('E', 'dl', 18.5, 3.7),
    spot('N', 'dl', 26.7, 3.7),
    spot('T', 'dl', 34.5, 3.7),
    spot('M', 'lb', 26.7, 6.4),
    spot('W', 'lb', 16.5, 6),
    spot('LC', 'db', 7.2, 9),
    spot('S', 'db', 39, 7.6),
    spot('RC', 'db', 47, 9),
  ],
  '9v9': [
    spot('E', 'dl', 17.6, 3.6),
    spot('N', 'dl', 24, 3.6),
    spot('T', 'dl', 31.4, 3.6),
    spot('W', 'lb', 15.5, 6.2),
    spot('M', 'lb', 26.7, 6.5),
    spot('$', 'lb', 37, 6.2),
    spot('LC', 'db', 6.6, 9.4),
    spot('S', 'db', 42, 8),
    spot('RC', 'db', 47.4, 9.4),
  ],
  '11v11': [
    spot('E', 'dl', 18.2, 3.6),
    spot('N', 'dl', 24.2, 3.6),
    spot('T', 'dl', 29.4, 3.6),
    spot('J', 'dl', 35.2, 3.6),
    spot('W', 'lb', 16.5, 6.5),
    spot('M', 'lb', C, 6.7),
    spot('$', 'lb', 36.5, 6.5),
    spot('LC', 'db', 6.2, 10),
    spot('SS', 'db', 18, 9.3),
    spot('FS', 'db', 33, 9.3),
    spot('RC', 'db', 47.5, 10),
  ],
}

export function formationsFor(format: FormatId): FormationTemplate[] {
  return FORMATIONS[format]
}

export function formationById(format: FormatId, id: string): FormationTemplate {
  const list = formationsFor(format)
  return list.find((formation) => formation.id === id) ?? list[0]
}

export function playerFromSpot(spotDef: Spot, side: Side, mine: boolean, routeIndex: number): Player {
  return {
    id: uid(),
    label: spotDef.label,
    role: spotDef.role,
    side,
    x: spotDef.x,
    y: spotDef.y,
    color: mine ? OUR_COLOR : THEIR_COLOR,
    routeColor: routeColorAt(routeIndex),
    shape: shapeFor(spotDef.role),
    read: null,
    note: '',
  }
}

export function offenseFor(format: FormatId, formationId: string, mine = true, routeStart = 0): Player[] {
  return formationById(format, formationId).spots.map((item, index) => playerFromSpot(item, 'offense', mine, routeStart + index))
}

export function defenseFor(format: FormatId, mine = false, routeStart = 6): Player[] {
  return DEFENSE[format].map((item, index) => playerFromSpot(item, 'defense', mine, routeStart + index))
}
