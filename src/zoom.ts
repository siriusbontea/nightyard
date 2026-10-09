export interface TapPoint {
  t: number
  x: number
  y: number
}

/** A second tap on the same spot is the double-tap zoom gesture. */
export function isDoubleTap(previous: TapPoint | null, now: number, x: number, y: number): boolean {
  if (!previous) return false
  if (now - previous.t <= 0 || now - previous.t > 300) return false
  const dx = x - previous.x
  const dy = y - previous.y
  return dx * dx + dy * dy <= 24 * 24
}

export function isPinch(touchCount: number): boolean {
  return touchCount > 1
}
