export type AuthAction = 'signin' | 'signup' | 'password'

const PASSWORD_HINT = 'Password needs 8 or more letters or numbers'
const USERNAME_HINT = 'Use 3 or more letters or numbers'
const TAKEN = 'That username is taken'
const WRONG = 'Wrong username or password'
const MISMATCH = 'Those passwords do not match'
const OLD = 'That old password is not right'
const OFFLINE = "You're offline. Try again when you have a signal."
const AGAIN = 'Something went wrong. Try again.'

export function checkUsername(username: string): string | null {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,29}$/.test(username.trim())) return USERNAME_HINT
  return null
}

export function checkPassword(password: string): string | null {
  if (password.length < 8) return PASSWORD_HINT
  return null
}

function looksLikeFields(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.values(value).some((entry) => !!entry && typeof entry === 'object' && 'code' in entry)
}

function fieldsOf(error: unknown): Record<string, unknown> {
  if (!error || typeof error !== 'object') return {}
  const data = (error as { data?: unknown }).data
  if (!looksLikeFields(data)) {
    const nested = data && typeof data === 'object' ? (data as { data?: unknown }).data : undefined
    return looksLikeFields(nested) ? nested : {}
  }
  return data
}

function fieldCode(error: unknown, field: string): string {
  const entry = fieldsOf(error)[field]
  if (!entry || typeof entry !== 'object') return ''
  const code = (entry as { code?: unknown }).code
  const message = (entry as { message?: unknown }).message
  return `${typeof code === 'string' ? code : ''} ${typeof message === 'string' ? message : ''}`.toLowerCase()
}

/** Kid-simple copy for PocketBase auth errors. Local checks throw plain Errors first. */
export function friendlyAuthError(error: unknown, action: AuthAction): string {
  const status = error && typeof error === 'object' ? (error as { status?: number }).status : undefined
  if (status === 0 || status === undefined) {
    if (error instanceof Error && typeof status !== 'number') return error.message
    if (status === 0) return OFFLINE
  }
  if (status === 0) return OFFLINE

  const username = fieldCode(error, 'username')
  const password = fieldCode(error, 'password')
  const confirm = fieldCode(error, 'passwordConfirm')
  const oldPassword = fieldCode(error, 'oldPassword')

  if (username.includes('not_unique') || username.includes('unique') || username.includes('taken')) return TAKEN
  if (username.includes('validation') || username.includes('invalid') || username.includes('match')) return USERNAME_HINT
  if (confirm) return MISMATCH
  if (oldPassword) return OLD
  if (password.includes('length') || password.includes('min') || password.includes('invalid')) return PASSWORD_HINT
  if (action === 'signin') return WRONG
  if (action === 'password') return OLD
  return AGAIN
}

export function messageFor(error: unknown, action: AuthAction): string {
  if (error instanceof Error) {
    const status = (error as { status?: unknown }).status
    if (typeof status !== 'number') return error.message
  }
  return friendlyAuthError(error, action)
}
