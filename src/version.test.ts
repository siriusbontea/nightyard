import { describe, expect, it } from 'vitest'
import pkgRaw from '../package.json?raw'
import about from './components/Sheets.tsx?raw'
import { APP_VERSION } from './version'

describe('app version', () => {
  it('matches package.json and is what About shows', () => {
    const pkg = JSON.parse(pkgRaw) as { version: string }
    expect(APP_VERSION).toBe(pkg.version)
    expect(APP_VERSION).toBe('1.2.3')
    expect(about).toContain('{APP_VERSION}')
    expect(about).toContain('GPL v2.0')
    expect(about).not.toMatch(/Version 1\.\d+\.\d+/)
  })
})
