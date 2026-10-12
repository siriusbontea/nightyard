import { describe, expect, it } from 'vitest'
import source from '../vite.config.ts?raw'
import register from './pwaRegister.ts?raw'
import gate from './updateGate.ts?raw'
import app from './components/App.tsx?raw'

describe('service worker', () => {
  it('asks before reload, checks again when the kid comes back, and leaves the account server on the network', () => {
    expect(source).toContain("registerType: 'prompt'")
    expect(source).toContain('skipWaiting: false')
    expect(source).toContain('clientsClaim: true')
    expect(source).toContain('cleanupOutdatedCaches: true')
    expect(source).toContain('navigateFallbackDenylist')
    expect(source).toContain('/nightyard/pb')
    expect(source).toContain("handler: 'NetworkOnly'")
    expect(register).toContain('onNeedRefresh')
    expect(register).toContain('registration?.update()')
    expect(register).toContain("addEventListener('focus'")
    expect(register).toContain("addEventListener('visibilitychange'")
    expect(gate).toContain('New version ready — tap to update')
    expect(app).toContain('UPDATE_READY')
    expect(app).toContain('flushSave')
  })
})
