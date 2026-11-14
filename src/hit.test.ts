import { describe, expect, it } from 'vitest'
import { hitTest, PLAYER_HIT_PX, playerHitYards } from './hit'
import { createPlay } from './play'

describe('player tap size', () => {
  it('uses at least a 44px hit area', () => {
    expect(PLAYER_HIT_PX).toBeGreaterThanOrEqual(44)
    expect(playerHitYards((px) => px / 10)).toBe(4.4)
    expect(playerHitYards(() => 0.2)).toBe(1.55)
  })

  it('gives the closer player the tap when hit areas overlap', () => {
    const play = createPlay({ format: '5v5', name: 'Tap' })
    const [first, second] = play.players
    first.x = 0
    first.y = 0
    second.x = 6
    second.y = 0
    const radii = { handle: 1, player: playerHitYards((px) => px / 10), stroke: 1 }
    const options = { showHandles: false, selectedStrokeId: null, preferPlayers: true }
    expect(hitTest(play, { x: 2.2, y: 0 }, radii, options)).toEqual({ type: 'player', id: first.id })
    expect(hitTest(play, { x: 4, y: 0 }, radii, options)).toEqual({ type: 'player', id: second.id })
  })

  it('lets the player win when a route handle sits on the marker', () => {
    const play = createPlay({ format: '5v5', name: 'Handle' })
    const player = play.players[0]
    player.x = 10
    player.y = -4
    play.strokes = [
      {
        id: 'line',
        playerId: player.id,
        kind: 'route',
        preset: null,
        points: [
          { x: 10, y: -4 },
          { x: 10, y: 2 },
          { x: 16, y: 2 },
        ],
        curves: [null, null],
      },
    ]
    const radii = { handle: 4, player: 3, stroke: 1, marker: 1.8, cornerBias: 2, minBend: 6 }
    const hit = hitTest(play, { x: 10.2, y: -3.8 }, radii, {
      showHandles: true,
      selectedStrokeId: 'line',
      preferPlayers: false,
    })
    expect(hit).toEqual({ type: 'player', id: player.id })
  })
})
