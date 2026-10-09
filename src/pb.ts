import PocketBase from 'pocketbase'
import { resolvePocketBaseUrl } from './pbUrl'

function pageOrigin(): string {
  if (typeof location !== 'undefined' && location.origin) return location.origin
  return 'http://127.0.0.1'
}

export const pb = new PocketBase(resolvePocketBaseUrl(import.meta.env.VITE_POCKETBASE_URL, pageOrigin()))
pb.autoCancellation(false)
