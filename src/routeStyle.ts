/**
 * Route ink in screen pixels, then converted to SVG units.
 * Phone fields are under 720 CSS pixels wide. Everything wider uses the desktop size.
 * `pxPerUnit` is CSS pixels per SVG unit (svg width / viewBox width).
 */
export interface RouteInk {
  stroke: number
  halo: number
  head: number
  headWidth: number
  trim: number
  handle: number
  midHandle: number
  motionOn: number
  motionOff: number
  highlight: number
  phone: boolean
}

export function routeInk(pxPerUnit: number, displayPx: number, coarse = false): RouteInk {
  const unit = Math.max(pxPerUnit, 0.04)
  const phone = displayPx < 720
  const strokePx = phone ? 3.2 : 4
  const headPx = phone ? 11 : 13
  const headWidthPx = phone ? 10 : 12
  const haloPx = 1.25
  const px = (value: number) => value / unit
  return {
    stroke: px(strokePx),
    halo: px(haloPx),
    head: px(headPx),
    headWidth: px(headWidthPx),
    trim: px(headPx * 0.7),
    handle: px((coarse ? 22 : 14) / 2),
    midHandle: px((coarse ? 16 : 12) / 2),
    motionOn: px(phone ? 7 : 9),
    motionOff: px(phone ? 6 : 7),
    highlight: px(1.5),
    phone,
  }
}
