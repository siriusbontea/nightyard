import { describe, expect, it } from 'vitest'
import source from '../vite.config.ts?raw'

describe('service worker', () => {
  it('updates itself and leaves the account server on the network', () => {
    expect(source).toContain("registerType: 'autoUpdate'")
    expect(source).toContain('cleanupOutdatedCaches: true')
    expect(source).toContain('navigateFallbackDenylist')
    expect(source).toContain('/nightyard/pb')
    expect(source).toContain("handler: 'NetworkOnly'")
  })
})
