import { describe, expect, it } from 'vitest'
import { isPocketBaseRequest, navigationAllowlist, normalizeBase } from './basePath'

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
    expect(allow.test('/nightyard/playback')).toBe(true)
    expect(allow.test('/nightyard/pb')).toBe(false)
    expect(allow.test('/nightyard/pb/')).toBe(false)
    expect(allow.test('/nightyard/pb/api/collections/plays/records')).toBe(false)
    expect(allow.test('/')).toBe(false)
    expect(allow.test('/other')).toBe(false)
    expect(allow.test('/nightyard-other')).toBe(false)
  })

  it('allows the whole origin when the app is served from /', () => {
    const allow = navigationAllowlist('/')
    expect(allow.test('/')).toBe(true)
    expect(allow.test('/plays')).toBe(true)
    expect(allow.test('/nightyard/pb/api')).toBe(false)
  })
})

describe('isPocketBaseRequest', () => {
  it('matches only the accounts API path', () => {
    expect(isPocketBaseRequest('/nightyard/pb')).toBe(true)
    expect(isPocketBaseRequest('/nightyard/pb/api/health')).toBe(true)
    expect(isPocketBaseRequest('/nightyard/playback')).toBe(false)
    expect(isPocketBaseRequest('/nightyard/')).toBe(false)
  })
})
