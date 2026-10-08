/**
 * A short tap in Move mode opens the position list.
 * A mouse click only selects, so a desktop double-click still opens it on the second click.
 * A drag is handled separately and never counts as a tap.
 */
export function tapOpensPosition(pointerType: string, alreadySelected: boolean): boolean {
  return pointerType === 'mouse' ? alreadySelected : true
}
