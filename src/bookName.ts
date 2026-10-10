export interface BookNameStamp {
  name: string
  namedAt: number
}

/** Newer name wins. An unstamped phone name does not replace a name already on the account. */
export function chooseBookName(
  local: BookNameStamp,
  remote: BookNameStamp | null,
): { name: string; namedAt: number; push: boolean } {
  const localName = local.name.trim() || 'Night Yard'
  const localAt = local.namedAt > 0 ? local.namedAt : 0
  const remoteName = remote?.name.trim() || ''
  const remoteAt = remote && remote.namedAt > 0 ? remote.namedAt : 0

  if (!remoteName) return { name: localName, namedAt: localAt || Date.now(), push: true }
  if (localAt > remoteAt) return { name: localName, namedAt: localAt, push: localName !== remoteName }
  if (remoteAt > localAt) return { name: remoteName, namedAt: remoteAt, push: false }
  if (localName === remoteName) return { name: localName, namedAt: localAt, push: false }
  if (localAt === 0) return { name: remoteName, namedAt: remoteAt, push: false }
  return { name: localName, namedAt: localAt, push: true }
}
