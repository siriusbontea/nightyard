/** Default API path. Production and dev both use this unless `VITE_POCKETBASE_URL` is set. */
export const DEFAULT_POCKETBASE_PATH = '/nightyard/pb'

/** Resolve the PocketBase base URL. Relative values hang off the page origin. */
export function resolvePocketBaseUrl(configured: string | undefined, origin: string): string {
  const raw = (configured ?? '').trim() || DEFAULT_POCKETBASE_PATH
  const trimmed = raw.replace(/\/+$/, '')
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return `${origin.replace(/\/+$/, '')}${path}`
}
