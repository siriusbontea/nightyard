import { FIELD_WIDTH, PLAYER_R } from './geometry'
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

/**
 * On the line of scrimmage. The mark's upfield edge touches y = 0 and does not cross it.
 * Eligible receivers who are off the line sit one step behind that, so a gap shows.
 * A rusher who is on the ball sits the same way on the defense side.
 */
const LINE = -PLAYER_R
const BACK = -PLAYER_R - 1.2
const RUSH = PLAYER_R
const QB_GUN = -5.1
/** Directly behind the center. The diamond tip meets the center's mark and does not cover it. */
const QB_UNDER = -5.41
const FB_DEPTH = -8.52
const RB_DEPTH = -11.76

function spot(label: string, role: Role, x: number, y: number, job?: PresetId): Spot {
  return { label, role, x, y, ...(job ? { job } : {}) }
}

/** Flag: everyone but the quarterback lines up on the ball. Two receivers left, one right. */
const FIVE_TWINS: Spot[] = [
  spot('WR1', 'wr', 6.5, LINE),
  spot('WR2', 'wr', 14, LINE),
  spot('WR3', 'wr', 47, LINE),
  spot('C', 'center', C, LINE),
  spot('QB', 'qb', C, QB_GUN),
]

const FIVE_TRIPS: Spot[] = [
  spot('WR1', 'wr', 33, LINE),
  spot('WR2', 'wr', 40, LINE),
  spot('WR3', 'wr', 47, LINE),
  spot('C', 'center', C, LINE),
  spot('QB', 'qb', C, QB_GUN),
]

const FIVE_SPREAD: Spot[] = [
  spot('WR1', 'wr', 6.6, LINE),
  spot('WR2', 'wr', 16.5, LINE),
  spot('WR3', 'wr', 46.8, LINE),
  spot('C', 'center', C, LINE),
  spot('QB', 'qb', C, QB_GUN),
]

/**
 * Classic youth kickoff, and the current high-school rule: at least four players
 * on each side of the kicker. This look puts five on each side. Not the 2024 NFL kickoff.
 */
const KICKOFF_SPOTS: Spot[] = [
  spot('L1', 'wr', 4, LINE, 'cover'),
  spot('L2', 'wr', 9, LINE, 'cover'),
  spot('L3', 'wr', 14, LINE, 'cover'),
  spot('L4', 'wr', 19, LINE, 'cover'),
  spot('L5', 'wr', 24, LINE, 'cover'),
  spot('R1', 'wr', 30, LINE, 'cover'),
  spot('R2', 'wr', 35, LINE, 'cover'),
  spot('R3', 'wr', 40, LINE, 'cover'),
  spot('R4', 'wr', 45, LINE, 'cover'),
  spot('R5', 'wr', 50, LINE, 'cover'),
  spot('K', 'qb', C, -7, 'kick'),
]

const KICK_RETURN_SPOTS: Spot[] = [
  spot('L1', 'wr', 5, LINE, 'block'),
  spot('L2', 'wr', 15, LINE, 'block'),
  spot('LB', 'lb', C, LINE, 'block'),
  spot('R1', 'wr', 38, LINE, 'block'),
  spot('R2', 'wr', 48, LINE, 'block'),
  spot('B1', 'wr', 10, -5, 'block'),
  spot('B2', 'wr', 20, -5, 'block'),
  spot('B3', 'wr', 34, -5, 'block'),
  spot('B4', 'wr', 44, -5, 'block'),
  spot('KR', 'rb', C, -16, 'return'),
  spot('KR2', 'rb', C + 6, -14, 'return'),
]

const PUNT_SPOTS: Spot[] = [
  spot('GnL', 'wr', 5, LINE, 'cover'),
  spot('WL', 'te', 12, BACK, 'block'),
  spot('LT', 'ol', 17.6, LINE, 'block'),
  spot('LG', 'ol', 22.2, LINE, 'block'),
  spot('LS', 'center', C, LINE, 'block'),
  spot('RG', 'ol', 31.2, LINE, 'block'),
  spot('RT', 'ol', 35.8, LINE, 'block'),
  spot('RW', 'te', 41.5, BACK, 'block'),
  spot('GnR', 'wr', 48, LINE, 'cover'),
  spot('PP', 'rb', C + 2.2, -4, 'block'),
  spot('P', 'qb', C, -14, 'kick'),
]

const PUNT_RETURN_SPOTS: Spot[] = [
  spot('JL', 'wr', 6, LINE, 'block'),
  spot('JR', 'wr', 47.5, LINE, 'block'),
  spot('R1', 'dl', 16, LINE, 'rush-kick'),
  spot('R2', 'dl', 21.5, LINE, 'rush-kick'),
  spot('R3', 'dl', 31.5, LINE, 'rush-kick'),
  spot('R4', 'dl', 37, LINE, 'rush-kick'),
  spot('LB1', 'lb', 18, -3.2, 'block'),
  spot('LB2', 'lb', 35, -3.2, 'block'),
  spot('CB1', 'db', 10, -6.4, 'cover'),
  spot('CB2', 'db', 43, -6.4, 'cover'),
  spot('PR', 'rb', C, -15, 'return'),
]

const FIELD_GOAL_SPOTS: Spot[] = [
  spot('LW', 'wr', 8, LINE, 'block'),
  spot('LT', 'ol', 17.4, LINE, 'block'),
  spot('LG', 'ol', 22.2, LINE, 'block'),
  spot('LS', 'center', C, LINE, 'block'),
  spot('RG', 'ol', 31.2, LINE, 'block'),
  spot('RT', 'ol', 36, LINE, 'block'),
  spot('RW', 'wr', 45.5, LINE, 'block'),
  spot('WB', 'te', 12.5, BACK, 'block'),
  spot('UB', 'rb', C + 4, -4.6, 'block'),
  spot('H', 'rb', C, -6.4, 'block'),
  spot('K', 'qb', C, -9.8, 'kick'),
]

/** The team rushing a field goal. Not a seven-man line. */
const FG_BLOCK_SPOTS: Spot[] = [
  spot('R1', 'dl', 8, LINE, 'rush-kick'),
  spot('R2', 'dl', 14.5, LINE, 'rush-kick'),
  spot('R3', 'dl', 20.5, LINE, 'rush-kick'),
  spot('R4', 'dl', C, LINE, 'rush-kick'),
  spot('R5', 'dl', 33, LINE, 'rush-kick'),
  spot('R6', 'dl', 45, LINE, 'rush-kick'),
  spot('LB1', 'lb', 16, -3.6, 'rush-kick'),
  spot('LB2', 'lb', C, -3.6, 'rush-kick'),
  spot('LB3', 'lb', 37, -3.6, 'rush-kick'),
  spot('FS', 'db', 18, -8, 'cover'),
  spot('SS', 'db', 36, -8, 'cover'),
]

/** The kicking unit the block team sees, across the line. Holder at 7, kicker a step behind. */
const FG_KICK_OPPONENT: Spot[] = [
  spot('LW', 'wr', 8, RUSH, 'block'),
  spot('LT', 'ol', 17.4, RUSH, 'block'),
  spot('LG', 'ol', 22.2, RUSH, 'block'),
  spot('LS', 'center', C, RUSH, 'block'),
  spot('RG', 'ol', 31.2, RUSH, 'block'),
  spot('RT', 'ol', 36, RUSH, 'block'),
  spot('RW', 'wr', 45.5, RUSH, 'block'),
  spot('WB', 'te', 12.5, RUSH + 1.1, 'block'),
  spot('UB', 'rb', C + 4, 5.2, 'block'),
  spot('H', 'rb', C, 7, 'block'),
  spot('K', 'qb', C, 10.4, 'kick'),
]

/** Put a unit on the far side of the line. A mark on the near line lands just past lineY. */
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
        spot('WR1', 'wr', 6.2, LINE),
        spot('WR2', 'wr', 13.4, LINE),
        spot('WR3', 'wr', 40, LINE),
        spot('WR4', 'wr', 47.2, LINE),
        spot('C', 'center', C, LINE),
        spot('QB', 'qb', C, QB_GUN),
      ],
    },
    {
      id: 'trips-right',
      name: 'Trips Right',
      spots: [
        spot('WR1', 'wr', 6.4, LINE),
        spot('WR2', 'wr', 33, LINE),
        spot('WR3', 'wr', 40, LINE),
        spot('WR4', 'wr', 47, LINE),
        spot('C', 'center', C, LINE),
        spot('QB', 'qb', C, QB_GUN),
      ],
    },
  ],
  '7v7': [
    {
      id: 'spread',
      name: 'Spread',
      spots: [
        spot('LG', 'ol', 22.2, LINE),
        spot('C', 'center', C, LINE),
        spot('RG', 'ol', 31.2, LINE),
        spot('QB', 'qb', C, QB_GUN),
        spot('WR1', 'wr', 6.8, LINE),
        spot('WR2', 'wr', 38.6, LINE),
        spot('WR3', 'wr', 47.2, LINE),
      ],
    },
    {
      id: 'wing',
      name: 'Wing',
      spots: [
        spot('LG', 'ol', 22.2, LINE),
        spot('C', 'center', C, LINE),
        spot('RG', 'ol', 31.2, LINE),
        spot('QB', 'qb', C, QB_GUN),
        spot('RB', 'rb', 16.2, LINE),
        spot('WR1', 'wr', 7, LINE),
        spot('WR2', 'wr', 47, LINE),
      ],
    },
  ],
  '8v8': [
    {
      id: 'spread',
      name: 'Spread',
      spots: [
        spot('LG', 'ol', 22.2, LINE),
        spot('C', 'center', C, LINE),
        spot('RG', 'ol', 31.2, LINE),
        spot('QB', 'qb', C, QB_GUN),
        spot('RB', 'rb', 16.4, LINE),
        spot('WR1', 'wr', 6.8, LINE),
        spot('WR2', 'wr', 38.6, LINE),
        spot('WR3', 'wr', 47.2, LINE),
      ],
    },
    {
      id: 'pro',
      name: 'Pro',
      spots: [
        spot('LT', 'ol', 17.6, LINE),
        spot('LG', 'ol', 22.2, LINE),
        spot('C', 'center', C, LINE),
        spot('RG', 'ol', 31.1, LINE),
        spot('RT', 'ol', 35.6, LINE),
        spot('QB', 'qb', C, QB_GUN),
        spot('WR1', 'wr', 6.5, LINE),
        spot('WR2', 'wr', 47.4, LINE),
      ],
    },
  ],
  '9v9': [
    {
      id: 'spread',
      name: 'Spread',
      spots: [
        spot('LG', 'ol', 22.2, LINE),
        spot('C', 'center', C, LINE),
        spot('RG', 'ol', 31.2, LINE),
        spot('QB', 'qb', C, QB_GUN),
        spot('RB', 'rb', 16.8, LINE),
        spot('WR1', 'wr', 6.4, LINE),
        spot('WR2', 'wr', 13.2, LINE),
        spot('WR3', 'wr', 39, LINE),
        spot('WR4', 'wr', 47.2, LINE),
      ],
    },
    {
      id: 'pro',
      name: 'Pro',
      spots: [
        spot('LT', 'ol', 17.4, LINE),
        spot('LG', 'ol', 22, LINE),
        spot('C', 'center', C, LINE),
        spot('RG', 'ol', 31.3, LINE),
        spot('RT', 'ol', 35.8, LINE),
        spot('QB', 'qb', C, QB_GUN),
        spot('RB', 'rb', 12.4, LINE),
        spot('WR1', 'wr', 6.2, LINE),
        spot('WR2', 'wr', 47.2, LINE),
      ],
    },
  ],
  '11v11': [
    {
      id: 'trips-bunch',
      name: 'Trips Bunch',
      spots: [
        spot('LT', 'ol', 17.4, LINE),
        spot('LG', 'ol', 21.8, LINE),
        spot('C', 'center', C, LINE),
        spot('RG', 'ol', 31.5, LINE),
        spot('RT', 'ol', 35.8, LINE),
        spot('TE', 'te', 39.6, BACK),
        spot('TE2', 'te', 43.1, BACK),
        spot('WR2', 'wr', 46.6, LINE),
        spot('WR1', 'wr', 6.2, LINE),
        spot('QB', 'qb', C, -5),
        spot('RB', 'rb', C + 3.6, -5.2),
      ],
    },
    {
      id: 'shotgun-trips',
      name: 'Shotgun Trips',
      spots: [
        spot('LT', 'ol', 17.4, LINE),
        spot('LG', 'ol', 21.8, LINE),
        spot('C', 'center', C, LINE),
        spot('RG', 'ol', 31.5, LINE),
        spot('RT', 'ol', 35.8, LINE),
        spot('TE', 'te', 39.2, LINE),
        spot('WR2', 'wr', 44.2, BACK),
        spot('WR3', 'wr', 48.4, LINE),
        spot('WR1', 'wr', 5.5, LINE),
        spot('QB', 'qb', C, QB_GUN),
        spot('RB', 'rb', 21.6, -6.3),
      ],
    },
    {
      id: 'ace',
      name: 'Ace Doubles',
      spots: [
        spot('LT', 'ol', 18.2, LINE),
        spot('LG', 'ol', 22.6, LINE),
        spot('C', 'center', C, LINE),
        spot('RG', 'ol', 30.8, LINE),
        spot('RT', 'ol', 35.2, LINE),
        spot('WR2', 'wr', 13.2, BACK),
        spot('WR3', 'wr', 40.6, BACK),
        spot('WR1', 'wr', 5.6, LINE),
        spot('WR4', 'wr', 48.2, LINE),
        spot('QB', 'qb', C, -5),
        spot('RB', 'rb', 31.2, -6.2),
      ],
    },
    {
      id: 'i-form',
      name: 'I Form',
      spots: [
        spot('LT', 'ol', 18.4, LINE),
        spot('LG', 'ol', 22.7, LINE),
        spot('C', 'center', C, LINE),
        spot('RG', 'ol', 30.6, LINE),
        spot('RT', 'ol', 34.9, LINE),
        spot('TE', 'te', 39.2, LINE),
        spot('WR1', 'wr', 6, LINE),
        spot('WR2', 'wr', 47.4, BACK),
        spot('QB', 'qb', C, QB_UNDER),
        spot('FB', 'fb', C, FB_DEPTH),
        spot('RB', 'rb', C, RB_DEPTH),
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
    spot('R', 'dl', C, RUSH),
    spot('LB', 'lb', C - 8, 5.2),
    spot('CB1', 'db', 8, 8.2),
    spot('S', 'db', C + 4, 7),
    spot('CB2', 'db', 46.2, 8.2),
  ],
  '6v6': [
    spot('R1', 'dl', 23, RUSH),
    spot('R2', 'dl', 31, RUSH),
    spot('LB', 'lb', 26.8, 6.2),
    spot('CB1', 'db', 8, 8.4),
    spot('S', 'db', 36, 7.2),
    spot('CB2', 'db', 46.4, 8.4),
  ],
  '7v7': [
    spot('R1', 'dl', 22, RUSH),
    spot('R2', 'dl', 31.2, RUSH),
    spot('LB1', 'lb', 16, 5.8),
    spot('LB2', 'lb', 26.7, 6.3),
    spot('CB1', 'db', 8, 8.6),
    spot('S', 'db', 38.4, 7.2),
    spot('CB2', 'db', 46.6, 8.6),
  ],
  '8v8': [
    spot('R1', 'dl', 18.5, RUSH),
    spot('R2', 'dl', 26.7, RUSH),
    spot('R3', 'dl', 34.5, RUSH),
    spot('LB1', 'lb', 15.2, 7),
    spot('LB2', 'lb', 26.7, 7.3),
    spot('CB1', 'db', 7.2, 9),
    spot('S', 'db', 39, 7.6),
    spot('CB2', 'db', 47, 9),
  ],
  '9v9': [
    spot('R1', 'dl', 17.6, RUSH),
    spot('R2', 'dl', 24, RUSH),
    spot('R3', 'dl', 31.4, RUSH),
    spot('LB1', 'lb', 15.5, 6.2),
    spot('LB2', 'lb', 26.7, 6.5),
    spot('LB3', 'lb', 37, 6.2),
    spot('CB1', 'db', 6.6, 9.4),
    spot('S', 'db', 42, 8),
    spot('CB2', 'db', 47.4, 9.4),
  ],
  '11v11': [
    spot('DE1', 'dl', 18.2, 3.6),
    spot('DT1', 'dl', 24.2, 3.6),
    spot('DT2', 'dl', 29.4, 3.6),
    spot('DE2', 'dl', 35.2, 3.6),
    spot('LB1', 'lb', 16.5, 6.5),
    spot('LB2', 'lb', C, 6.7),
    spot('LB3', 'lb', 38.2, 6.8),
    spot('CB1', 'db', 6.2, 10),
    spot('SS', 'db', 19.5, 9.3),
    spot('FS', 'db', 33, 9.3),
    spot('CB2', 'db', 47.5, 10),
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
