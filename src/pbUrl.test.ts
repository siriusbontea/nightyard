import { describe, expect, it } from 'vitest'
import { DEFAULT_POCKETBASE_PATH, resolvePocketBaseUrl } from './pbUrl'

describe('resolvePocketBaseUrl', () => {
  it('defaults to /nightyard/pb on the page origin', () => {
    expect(resolvePocketBaseUrl(undefined, 'http://127.0.0.1:43123')).toBe(
      'http://127.0.0.1:43123/nightyard/pb',
    )
    expect(resolvePocketBaseUrl('', 'https://www.roninforged.com')).toBe(
      `https://www.roninforged.com${DEFAULT_POCKETBASE_PATH}`,
    )
  })

  it('keeps a full URL and drops a trailing slash', () => {
    expect(resolvePocketBaseUrl('https://pb.example.com/nightyard/pb/', 'http://localhost')).toBe(
      'https://pb.example.com/nightyard/pb',
    )
  })

  it('joins a relative path onto the origin', () => {
    expect(resolvePocketBaseUrl('pb', 'http://127.0.0.1:43123/')).toBe('http://127.0.0.1:43123/pb')
  })
})
