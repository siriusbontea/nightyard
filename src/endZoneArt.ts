import colorUrl from './assets/end-zone.webp'
import lineUrl from './assets/end-zone-line.png'

/** Painted end-zone mark. Black background is already transparent. */
export const END_ZONE_COLOR = colorUrl
/** Black line art for the white print sheet. */
export const END_ZONE_LINE = lineUrl

export const END_ZONE_ART_W = 420
export const END_ZONE_ART_H = 429

/** Inclusive pixel bounds of the painted dog. The files have empty space under it. */
export interface OpaqueBox {
  width: number
  height: number
  left: number
  top: number
  right: number
  bottom: number
}

/** Color webp. Alpha below 16 is fringe, not the dog. */
export const COLOR_ART: OpaqueBox = { width: 420, height: 429, left: 2, top: 0, right: 413, bottom: 379 }

/** White-print line art. The dog sits in the same part of the file. */
export const LINE_ART: OpaqueBox = { width: 548, height: 560, left: 1, top: 0, right: 539, bottom: 496 }

/** Center of the visible artwork, as a fraction of the file. */
export function artContentCenter(box: OpaqueBox): { x: number; y: number } {
  return {
    x: (box.left + box.right) / 2 / box.width,
    y: (box.top + box.bottom) / 2 / box.height,
  }
}

/**
 * Place the file so the visible dog sits in the middle of the end zone.
 * `top` is the end line. `top + height` is the goal line.
 */
export function placeEndZoneLogo(
  zoneTop: number,
  zoneHeight: number,
  zoneWidth: number,
  box: OpaqueBox,
): { x: number; y: number; width: number; height: number; centerX: number; centerY: number } {
  const margin = zoneHeight * 0.1
  const ratio = box.width / box.height
  let height = zoneHeight - margin * 2
  let width = height * ratio
  const maxW = zoneWidth - margin * 2
  if (width > maxW) {
    width = maxW
    height = width / ratio
  }
  const content = artContentCenter(box)
  const centerX = zoneWidth / 2
  const centerY = zoneTop + zoneHeight / 2
  return {
    x: centerX - content.x * width,
    y: centerY - content.y * height,
    width,
    height,
    centerX,
    centerY,
  }
}
