import { describe, expect, it } from 'vitest'
import { navigationAllowlist, normalizeBase } from './basePath'

describe('normalizeBase', () => {
  it('defaults an empty value to the fallback and keeps a trailing slash', () => {
    expect(normalizeBase(undefined, '/nightyard/')).toBe('/nightyard/')
    expect(normalizeBase('', '/nightyard/')).toBe('/nightyard/')
    expect(normalizeBase('nightyard', '/')).toBe('/nightyard/')
    expect(normalizeBase('/nightyard', '/')).toBe('/nightyard/')
    expect(normalizeBase('/nightyard/', '/')).toBe('/nightyard/')
  })

  it('leaves the site root as a single slash', () => {
    expect(normalizeBase('/', '/nightyard/')).toBe('/')
    expect(normalizeBase(undefined, '/')).toBe('/')
  })
})

describe('navigationAllowlist', () => {
  it('limits a subpath service worker to that folder', () => {
    const allow = navigationAllowlist('/nightyard/')
    expect(allow.test('/nightyard')).toBe(true)
    expect(allow.test('/nightyard/')).toBe(true)
    expect(allow.test('/nightyard/editor')).toBe(true)
    expect(allow.test('/')).toBe(false)
    expect(allow.test('/other')).toBe(false)
    expect(allow.test('/nightyard-other')).toBe(false)
  })

  it('allows the whole origin when the app is served from /', () => {
    const allow = navigationAllowlist('/')
    expect(allow.test('/')).toBe(true)
    expect(allow.test('/plays')).toBe(true)
  })
})
