import { describe, expect, it } from 'vitest'
import { navigationAllowlist, normalizeBase } from './basePath'

describe('normalizeBase', () => {
  it('defaults an empty value to the fallback and keeps a trailing slash', () => {
    expect(normalizeBase(undefined, '/playbook/')).toBe('/playbook/')
    expect(normalizeBase('', '/playbook/')).toBe('/playbook/')
    expect(normalizeBase('playbook', '/')).toBe('/playbook/')
    expect(normalizeBase('/playbook', '/')).toBe('/playbook/')
    expect(normalizeBase('/playbook/', '/')).toBe('/playbook/')
  })

  it('leaves the site root as a single slash', () => {
    expect(normalizeBase('/', '/playbook/')).toBe('/')
    expect(normalizeBase(undefined, '/')).toBe('/')
  })
})

describe('navigationAllowlist', () => {
  it('limits a subpath service worker to that folder', () => {
    const allow = navigationAllowlist('/playbook/')
    expect(allow.test('/playbook')).toBe(true)
    expect(allow.test('/playbook/')).toBe(true)
    expect(allow.test('/playbook/editor')).toBe(true)
    expect(allow.test('/')).toBe(false)
    expect(allow.test('/other')).toBe(false)
    expect(allow.test('/playbook-other')).toBe(false)
  })

  it('allows the whole origin when the app is served from /', () => {
    const allow = navigationAllowlist('/')
    expect(allow.test('/')).toBe(true)
    expect(allow.test('/plays')).toBe(true)
  })
})
