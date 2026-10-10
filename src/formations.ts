import { FIELD_WIDTH } from './geometry'
import { uid } from './id'
import type { FormatId, Player, PresetId, Role, Shape, Side } from './types'

export interface Spot {
  label: string
  role: Role
  x: number
  y: number
  /** Drawn when this lineup is chosen. Scrimmage routes stay empty until a kid picks one. */
  job?: PresetId
}

export type SpecialKind = 'kickoff' | 'kick-return' | 'punt' | 'punt-return' | 'field-goal' | 'fg-block'

export interface FormationTemplate {
  id: string
  name: string
  spots: Spot[]
  /** Kicking looks exist only in 11v11 tackle. */
  special?: SpecialKind
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

function spot(label: string, role: Role, x: number, y: number, job?: PresetId): Spot {
  return { label, role, x, y, ...(job ? { job } : {}) }
}

/** Flag: everyone but the quarterback lines up on the ball. Two receivers left, one right. */
const FIVE_TWINS: Spot[] = [
  spot('X', 'wr', 6.5, 0),
  spot('H', 'wr', 14, 0),
  spot('Z', 'wr', 47, 0),
  spot('C', 'center', C, -0.5),
  spot('QB', 'qb', C, -5.1),
]

const FIVE_TRIPS: Spot[] = [
  spot('Y', 'wr', 33, 0),
  spot('H', 'wr', 40, 0),
  spot('Z', 'wr', 47, 0),
  spot('C', 'center', C, -0.5),
  spot('QB', 'qb', C, -5.1),
]

const FIVE_SPREAD: Spot[] = [
  spot('X', 'wr', 6.6, 0),
  spot('H', 'wr', 16.5, 0),
  spot('Z', 'wr', 46.8, 0),
  spot('C', 'center', C, -0.5),
  spot('QB', 'qb', C, -5.1),
]

/** Kickoff cover, drawn on the line so it fits the same window as a scrimmage play. */
const KICKOFF_SPOTS: Spot[] = [
  spot('L1', 'wr', 4, 0, 'cover'),
  spot('L2', 'wr', 9, 0, 'cover'),
  spot('L3', 'wr', 14, 0, 'cover'),
  spot('L4', 'wr', 19, 0, 'cover'),
  spot('L5', 'wr', 24, 0, 'cover'),
  spot('R1', 'wr', 30, 0, 'cover'),
  spot('R2', 'wr', 35, 0, 'cover'),
  spot('R3', 'wr', 40, 0, 'cover'),
  spot('R4', 'wr', 45, 0, 'cover'),
  spot('R5', 'wr', 50, 0, 'cover'),
  spot('K', 'qb', C, -7, 'kick'),
]

const KICK_RETURN_SPOTS: Spot[] = [
  spot('L1', 'wr', 5, 0, 'block'),
  spot('L2', 'wr', 15, 0, 'block'),
  spot('L3', 'wr', C, 0, 'block'),
  spot('L4', 'wr', 38, 0, 'block'),
  spot('L5', 'wr', 48, 0, 'block'),
  spot('M1', 'wr', 10, -5, 'block'),
  spot('M2', 'wr', 20, -5, 'block'),
  spot('M3', 'wr', 34, -5, 'block'),
  spot('M4', 'wr', 44, -5, 'block'),
  spot('KR', 'rb', C, -16, 'return'),
  spot('KR2', 'rb', C + 6, -14, 'return'),
]

const PUNT_SPOTS: Spot[] = [
  spot('GnL', 'wr', 5, 0, 'cover'),
  spot('WL', 'te', 12, -1, 'block'),
  spot('LT', 'ol', 17.6, 0, 'block'),
  spot('LG', 'ol', 22.2, 0, 'block'),
  spot('LS', 'center', C, -0.3, 'block'),
  spot('RG', 'ol', 31.2, 0, 'block'),
  spot('RT', 'ol', 35.8, 0, 'block'),
  spot('WR', 'te', 41.5, -1, 'block'),
  spot('GnR', 'wr', 48, 0, 'cover'),
  spot('PP', 'rb', C + 2.2, -4, 'block'),
  spot('P', 'qb', C, -14, 'kick'),
]

const PUNT_RETURN_SPOTS: Spot[] = [
  spot('Jl', 'wr', 6, 0, 'block'),
  spot('Jr', 'wr', 47.5, 0, 'block'),
  spot('R1', 'dl', 16, 0, 'rush-kick'),
  spot('R2', 'dl', 21.5, 0, 'rush-kick'),
  spot('R3', 'dl', 31.5, 0, 'rush-kick'),
  spot('R4', 'dl', 37, 0, 'rush-kick'),
  spot('W1', 'wr', 18, -3.2, 'block'),
  spot('W2', 'wr', 35, -3.2, 'block'),
  spot('CL', 'wr', 10, -6.4, 'cover'),
  spot('CR', 'wr', 43, -6.4, 'cover'),
  spot('PR', 'rb', C, -15, 'return'),
]

const FIELD_GOAL_SPOTS: Spot[] = [
  spot('LW', 'wr', 8, 0, 'block'),
  spot('LT', 'ol', 17.4, 0, 'block'),
  spot('LG', 'ol', 22.2, 0, 'block'),
  spot('LS', 'center', C, -0.25, 'block'),
  spot('RG', 'ol', 31.2, 0, 'block'),
  spot('RT', 'ol', 36, 0, 'block'),
  spot('RW', 'wr', 45.5, 0, 'block'),
  spot('WB', 'te', 12.5, -1.1, 'block'),
  spot('UB', 'rb', C + 4, -4.6, 'block'),
  spot('H', 'rb', C, -6.4, 'block'),
  spot('K', 'qb', C, -9.8, 'kick'),
]

/** The team rushing a field goal. Not a seven-man line. */
const FG_BLOCK_SPOTS: Spot[] = [
  spot('EL', 'dl', 8, 0, 'rush-kick'),
  spot('LE', 'dl', 14.5, 0, 'rush-kick'),
  spot('DT', 'dl', 20.5, 0, 'rush-kick'),
  spot('N', 'dl', C, 0, 'rush-kick'),
  spot('RE', 'dl', 33, 0, 'rush-kick'),
  spot('ER', 'dl', 45, 0, 'rush-kick'),
  spot('W', 'wr', 16, -3.6, 'rush-kick'),
  spot('M', 'wr', C, -3.6, 'rush-kick'),
  spot('B', 'wr', 37, -3.6, 'rush-kick'),
  spot('FS', 'wr', 18, -8, 'cover'),
  spot('SS', 'wr', 36, -8, 'cover'),
]

/** The kicking unit the block team sees, across the line. Holder at 7, kicker a step behind. */
const FG_KICK_OPPONENT: Spot[] = [
  spot('LW', 'wr', 8, 1.5, 'block'),
  spot('LT', 'ol', 17.4, 1.5, 'block'),
  spot('LG', 'ol', 22.2, 1.5, 'block'),
  spot('LS', 'center', C, 1.2, 'block'),
  spot('RG', 'ol', 31.2, 1.5, 'block'),
  spot('RT', 'ol', 36, 1.5, 'block'),
  spot('RW', 'wr', 45.5, 1.5, 'block'),
  spot('WB', 'te', 12.5, 2.6, 'block'),
  spot('UB', 'rb', C + 4, 5.2, 'block'),
  spot('H', 'rb', C, 7, 'block'),
  spot('K', 'qb', C, 10.4, 'kick'),
]

/** Put a unit on the far side of the line. y of 0 lands on lineY. */
function downfield(spots: Spot[], lineY: number): Spot[] {
  return spots.map((item) => spot(item.label, item.role, item.x, lineY - item.y, item.job))
}

const FORMATIONS: Record<FormatId, FormationTemplate[]> = {
  '5v5': [
    { id: 'doubles', name: 'Twins', spots: FIVE_TWINS },
    { id: 'trips-right', name: 'Trips Right', spots: FIVE_TRIPS },
    { id: 'spread', name: 'Spread', spots: FIVE_SPREAD },
  ],
  '6v6': [
    {
      id: 'doubles',
      name: 'Doubles',
      spots: [
        spot('X', 'wr', 6.2, 0),
        spot('H', 'wr', 13.4, 0),
        spot('Y', 'wr', 40, 0),
        spot('Z', 'wr', 47.2, 0),
        spot('C', 'center', C, -0.5),
        spot('QB', 'qb', C, -5.1),
      ],
    },
    {
      id: 'trips-right',
      name: 'Trips Right',
      spots: [spot('X', 'wr', 6.4, 0), ...FIVE_TRIPS],
    },
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
        spot('Y', 'wr', 38.6, 0),
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
        spot('RB', 'rb', 16.2, 0),
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
        spot('RB', 'rb', 16.4, 0),
        spot('X', 'wr', 6.8, 0),
        spot('Y', 'wr', 38.6, 0),
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
        spot('RB', 'rb', 16.8, 0),
        spot('X', 'wr', 6.4, 0),
        spot('H', 'wr', 13.2, 0),
        spot('Y', 'wr', 39, 0),
        spot('Z', 'wr', 47.2, 0),
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
        spot('RB', 'rb', 12.4, 0),
        spot('X', 'wr', 6.2, 0),
        spot('Z', 'wr', 47.2, 0),
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
        spot('Y', 'te', 39.6, -1.1),
        spot('TE', 'te', 43.1, -1),
        spot('X', 'wr', 46.6, 0),
        spot('Z', 'wr', 6.2, 0),
        spot('QB', 'qb', C, -5),
        spot('RB', 'rb', C + 3.6, -5.2),
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
        spot('TE', 'te', 39.2, 0),
        spot('Y', 'wr', 44.2, -1.1),
        spot('Z', 'wr', 48.4, 0),
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
        spot('H', 'wr', 13.2, -1),
        spot('Y', 'wr', 40.6, -1),
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
        spot('TE', 'te', 39.2, 0),
        spot('X', 'wr', 6, 0),
        spot('Z', 'wr', 47.4, -1),
        spot('QB', 'qb', C, -1.6),
        spot('FB', 'fb', C, -4.9),
        spot('RB', 'rb', C, -8.2),
      ],
    },
    { id: 'kickoff', name: 'Kickoff', special: 'kickoff', spots: KICKOFF_SPOTS },
    { id: 'kick-return', name: 'Kick return', special: 'kick-return', spots: KICK_RETURN_SPOTS },
    { id: 'punt', name: 'Punt', special: 'punt', spots: PUNT_SPOTS },
    { id: 'punt-return', name: 'Punt return', special: 'punt-return', spots: PUNT_RETURN_SPOTS },
    { id: 'field-goal', name: 'Field goal', special: 'field-goal', spots: FIELD_GOAL_SPOTS },
    { id: 'fg-block', name: 'FG block', special: 'fg-block', spots: FG_BLOCK_SPOTS },
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
    spot('M', 'lb', 26.7, 7.3),
    spot('W', 'lb', 15.2, 7),
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
    spot('$', 'lb', 38.2, 6.8),
    spot('LC', 'db', 6.2, 10),
    spot('SS', 'db', 19.5, 9.3),
    spot('FS', 'db', 33, 9.3),
    spot('RC', 'db', 47.5, 10),
  ],
}

const SPECIAL_DEFENSE: Record<string, Spot[]> = {
  kickoff: downfield(KICK_RETURN_SPOTS, 8),
  'kick-return': downfield(KICKOFF_SPOTS, 2),
  punt: downfield(PUNT_RETURN_SPOTS, 2),
  'punt-return': downfield(PUNT_SPOTS, 2),
  'field-goal': downfield(FG_BLOCK_SPOTS, 1.5),
  'fg-block': FG_KICK_OPPONENT,
}

/** The other team on a kicking play. Null for a normal scrimmage look. */
export function specialDefense(formationId: string): Spot[] | null {
  return SPECIAL_DEFENSE[formationId] ?? null
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

export function defenseFor(format: FormatId, mine = false, routeStart = 6, formationId?: string): Player[] {
  const spots = (formationId && specialDefense(formationId)) || DEFENSE[format]
  return spots.map((item, index) => playerFromSpot(item, 'defense', mine, routeStart + index))
}
