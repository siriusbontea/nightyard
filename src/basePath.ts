/** Normalize a Vite `base` so asset, manifest, and service-worker URLs stay on one path. */
export function normalizeBase(input: string | undefined, fallback: string): string {
  let base = (input ?? '').trim()
  if (!base) base = fallback
  if (base === './' || base === '.') return './'
  if (!base.startsWith('/')) base = `/${base}`
  if (!base.endsWith('/')) base = `${base}/`
  return base
}

/**
 * Navigation routes the service worker may satisfy with the app shell.
 * A subpath build must not claim the rest of the origin.
 */
/** PocketBase lives at this path and must not be served as the app shell. */
export function isPocketBaseRequest(pathname: string): boolean {
  return pathname === '/nightyard/pb' || pathname.startsWith('/nightyard/pb/')
}

export function navigationAllowlist(base: string): RegExp {
  if (base === '/' || base === './' || base === '') return /^\/(?!nightyard\/pb(?:\/|$)).*/
  const path = base.replace(/\/$/, '')
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (path === '/nightyard') return /^\/nightyard(?:\/(?!pb(?:\/|$)).*)?$/
  return new RegExp(`^${escaped}(?:/|$)`)
}
