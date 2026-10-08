/** Football glyph. A drawn ball sits underneath in case a font or export skips the emoji. */
export const BALL = '🏈'

const EMOJI_FONT = `Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, emoji, sans-serif`

/**
 * The ball at (cx, cy), about the same size as the old oval.
 * `scale` is SVG units per yard. The emoji is drawn on top of a laced football
 * so a print or image that cannot paint the glyph still shows a ball.
 */
export function ballMarkup(cx: number, cy: number, scale: number, fill: string, stroke: string): string {
  const rx = 0.55 * scale
  const ry = 0.82 * scale
  const x = cx.toFixed(1)
  const y = cy.toFixed(1)
  const weight = Math.max(0.8, scale * 0.1).toFixed(1)
  const lace = (dy: number) => {
    const ly = (cy + dy).toFixed(1)
    const half = rx * 0.42
    return `<line x1="${(cx - half).toFixed(1)}" y1="${ly}" x2="${(cx + half).toFixed(1)}" y2="${ly}" stroke="${stroke}" stroke-width="${weight}" stroke-linecap="round"/>`
  }
  const seam = `<line x1="${x}" y1="${(cy - ry * 0.55).toFixed(1)}" x2="${x}" y2="${(cy + ry * 0.55).toFixed(1)}" stroke="${stroke}" stroke-width="${weight}" stroke-linecap="round"/>`
  return `<g data-ball="1">
    <g class="ball-fallback" transform="rotate(-28 ${x} ${y})">
      <ellipse cx="${x}" cy="${y}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="${Math.max(1, scale * 0.12).toFixed(1)}"/>
      ${seam}
      ${lace(-ry * 0.22)}
      ${lace(0)}
      ${lace(ry * 0.22)}
    </g>
    <text class="ball-emoji" x="${x}" y="${y}" fill="${fill}" font-family="${EMOJI_FONT}" font-size="${(2.15 * scale).toFixed(1)}" text-anchor="middle" dominant-baseline="central">${BALL}</text>
  </g>`
}
