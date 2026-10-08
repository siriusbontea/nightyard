export interface Point {
  x: number
  y: number
}

export type FormatId = '5v5' | '6v6' | '7v7' | '8v8' | '9v9' | '11v11'

export type Role = 'qb' | 'center' | 'ol' | 'wr' | 'rb' | 'te' | 'fb' | 'dl' | 'lb' | 'db'

export type Shape = 'diamond' | 'square' | 'circle'

export type Side = 'offense' | 'defense'

export type StrokeKind = 'route' | 'motion' | 'block' | 'run'

export type PresetId =
  | 'go'
  | 'slant'
  | 'out'
  | 'in'
  | 'post'
  | 'corner'
  | 'hitch'
  | 'curl'
  | 'wheel'
  | 'drag'
  | 'block'
  | 'run'
  | 'motion'

export interface Player {
  id: string
  label: string
  role: Role
  side: Side
  x: number
  y: number
  /** Team fill. Orange is your team, lime is the other team. */
  color: string
  /** Line color, kept different for each player so paths stay easy to follow. */
  routeColor: string
  shape: Shape
  read: number | null
  note: string
}

export interface Stroke {
  id: string
  playerId: string
  kind: StrokeKind
  points: Point[]
  curves: (Point | null)[]
  preset: PresetId | null
}

export interface Play {
  id: string
  name: string
  formation: string
  formationId: string
  format: FormatId
  /** Yards from the goal line being attacked. 50 is midfield. */
  los: number
  notes: string
  /** Which side of the ball your team is on. */
  ourSide: Side
  /** When true, the other team is drawn. */
  showDefense: boolean
  players: Player[]
  strokes: Stroke[]
  createdAt: number
  updatedAt: number
}

export const FORMATS: { id: FormatId; label: string; offense: number }[] = [
  { id: '5v5', label: '5v5 flag', offense: 5 },
  { id: '6v6', label: '6v6 flag', offense: 6 },
  { id: '7v7', label: '7v7 flag', offense: 7 },
  { id: '8v8', label: '8v8 flag', offense: 8 },
  { id: '9v9', label: '9v9 flag', offense: 9 },
  { id: '11v11', label: '11v11 tackle', offense: 11 },
]

export function formatLabel(id: FormatId): string {
  return FORMATS.find((format) => format.id === id)?.label ?? id
}

/** Short count for the phone UI. Printed sheets still use formatLabel. */
export function formatShort(id: FormatId): string {
  const count = FORMATS.find((format) => format.id === id)?.offense
  return count ? `${count} on ${count}` : id
}

export function formatStyle(id: FormatId): string {
  return id === '11v11' ? 'tackle' : 'flag'
}

export function isFormatId(value: string): value is FormatId {
  return FORMATS.some((format) => format.id === value)
}

export function ourSideOf(play: { ourSide?: Side }): Side {
  return play.ourSide === 'defense' ? 'defense' : 'offense'
}
