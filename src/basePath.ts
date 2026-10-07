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
export function navigationAllowlist(base: string): RegExp {
  if (base === '/' || base === './' || base === '') return /^\/.*/
  const path = base.replace(/\/$/, '')
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^${escaped}(?:/|$)`)
}
