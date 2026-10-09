/** Regulation field between the goal lines, in yards. */
export const FIELD_LENGTH = 100

/** Opponent's 30. New plays start here so the far end zone is on screen. */
export const DEFAULT_LOS = 30

/** End zone depth. Drawn only when that yardage is inside the camera. */
export const END_ZONE_DEPTH = 10

/**
 * Inbound hash, yards from each sideline.
 * College hashes sit 20 yards in on a 53⅓-yard field. Flag and tackle share
 * this marking: the format changes who is on the field, not the yard lines.
 */
export const HASH_INSET = 20

/** Yard line painted at `yardsFromOppGoal`, counting from the goal being attacked. */
export function displayedYard(yardsFromOppGoal: number): number {
  return Math.min(yardsFromOppGoal, FIELD_LENGTH - yardsFromOppGoal)
}

/** Screen direction of the arrow beside a 10-yard number. The 50 has none. */
export function numberArrow(yardsFromOppGoal: number): 'up' | 'down' | null {
  if (yardsFromOppGoal < 50) return 'up'
  if (yardsFromOppGoal > 50) return 'down'
  return null
}

/** Field y (0 = line of scrimmage, + is upfield) of a line `yards` from the opponent goal. */
export function fieldYAt(los: number, yardsFromOppGoal: number): number {
  return los - yardsFromOppGoal
}
