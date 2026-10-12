import { useEffect, useId, useState } from 'preact/hooks'
import { changePassword, deleteAccount, signIn, signOut, signUp } from '../account'
import { messageFor } from '../accountErrors'
import { getSyncState, statusLine, subscribeSync } from '../sync'
import { Sheet } from './Sheets'

type Mode = 'in' | 'up' | 'password'

export function AccountSheet(props: {
  onClose: () => void
  saved: boolean
  start?: Mode
  phonePlays?: number
  onDeleted: () => void | Promise<void>
}) {
  const [mode, setMode] = useState<Mode>(props.start ?? 'in')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [oldPassword, setOldPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [account, setAccount] = useState(getSyncState())
  const [deleting, setDeleting] = useState(false)
  const [typed, setTyped] = useState('')

  useEffect(() => subscribeSync(setAccount), [])

  function resetError() {
    setError('')
  }

  async function submit(event: Event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (account.signedIn && mode === 'password') {
        await changePassword(oldPassword, password, confirm)
        setPassword('')
        setConfirm('')
        setOldPassword('')
        setMode('in')
        return
      }
      if (mode === 'up') {
        await signUp(username, password, confirm)
        props.onClose()
        return
      }
      await signIn(username, password)
      props.onClose()
    } catch (caught) {
      const action = account.signedIn && mode === 'password' ? 'password' : mode === 'up' ? 'signup' : 'signin'
      setError(messageFor(caught, action))
    } finally {
      setBusy(false)
    }
  }

  async function removeAccount() {
    setBusy(true)
    setError('')
    try {
      await deleteAccount()
      await props.onDeleted()
    } catch {
      setError('Could not delete the account. Try again.')
      setBusy(false)
    }
  }

  if (account.signedIn && deleting) {
    const ready = typed.trim() === account.username
    return (
      <Sheet title="Delete account" noTips onClose={() => { setDeleting(false); setTyped(''); setError('') }}>
        <p class="fine">This deletes your account and every play and playbook. They are gone forever.</p>
        <label class="field-label">
          Type {account.username}
          <input
            value={typed}
            aria-label="Type your username"
            autoCapitalize="none"
            autoCorrect="off"
            spellcheck={false}
            onInput={(event) => setTyped((event.currentTarget as HTMLInputElement).value)}
          />
        </label>
        {error ? (
          <p class="form-error" role="alert">
            {error}
          </p>
        ) : (
          <p class="fine">Type your username, then tap Delete account.</p>
        )}
        <button type="button" class="primary wide" onClick={() => { setDeleting(false); setTyped(''); setError('') }}>
          Cancel
        </button>
        <button type="button" class="primary wide danger" disabled={!ready || busy} onClick={() => void removeAccount()}>
          {busy ? 'One moment…' : 'Delete account'}
        </button>
      </Sheet>
    )
  }

  if (account.signedIn && mode !== 'password') {
    return (
      <Sheet title="Your account" onClose={props.onClose}>
        <p class="fine">
          Signed in as <strong>{account.username}</strong>
        </p>
        <p class="sync-line">{statusLine(props.saved, account)}</p>
        <button type="button" class="primary wide" onClick={() => { resetError(); setMode('password') }}>
          Change password
        </button>
        <button
          type="button"
          class="primary wide ghost"
          onClick={() => {
            signOut()
            props.onClose()
          }}
        >
          Sign out
        </button>
        <p class="fine">Signing out keeps your plays on this phone.</p>
        <button type="button" class="primary wide danger" onClick={() => { setError(''); setTyped(''); setDeleting(true) }}>
          Delete account
        </button>
      </Sheet>
    )
  }

  const title = account.signedIn ? 'Change password' : mode === 'up' ? 'Make a free account' : 'Sign in'
  return (
    <Sheet title={title} onClose={props.onClose}>
      <form class="stack" onSubmit={submit}>
        {account.signedIn ? (
          <SecretField label="Old password" value={oldPassword} autoComplete="current-password" onInput={setOldPassword} />
        ) : (
          <label class="field-label">
            Username
            <input
              value={username}
              autocomplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellcheck={false}
              onInput={(event) => setUsername((event.currentTarget as HTMLInputElement).value)}
            />
          </label>
        )}
        <SecretField
          label={account.signedIn ? 'New password' : 'Password'}
          value={password}
          autoComplete={mode === 'up' || account.signedIn ? 'new-password' : 'current-password'}
          onInput={setPassword}
        />
        {mode === 'up' || account.signedIn ? (
          <SecretField
            label="Password again"
            value={confirm}
            autoComplete="new-password"
            onInput={setConfirm}
          />
        ) : null}
        {error ? (
          <p class="form-error" role="alert">
            {error}
          </p>
        ) : (
          <p class="fine">
            {account.signedIn
              ? 'Use 8 or more letters or numbers.'
              : mode === 'up' && (props.phonePlays ?? 0) > 0
                ? 'Plays on this phone will be saved to your account.'
                : 'Your plays stay on this phone, and on any phone where you sign in.'}
          </p>
        )}
        <button type="submit" class="primary wide" disabled={busy}>
          {busy ? 'One moment…' : account.signedIn ? 'Save password' : mode === 'up' ? 'Make free account' : 'Sign in'}
        </button>
      </form>
      {account.signedIn ? (
        <button type="button" class="text-btn" onClick={() => { resetError(); setMode('in') }}>
          Back
        </button>
      ) : mode === 'up' ? (
        <button type="button" class="text-btn" onClick={() => { resetError(); setMode('in') }}>
          I already have an account
        </button>
      ) : (
        <button type="button" class="text-btn" onClick={() => { resetError(); setMode('up') }}>
          New here? Make a free account
        </button>
      )}
    </Sheet>
  )
}

function SecretField(props: {
  label: string
  value: string
  autoComplete: string
  onInput: (value: string) => void
}) {
  const [shown, setShown] = useState(false)
  const id = useId()
  return (
    <div class="field-label">
      <label for={id}>{props.label}</label>
      <span class="secret">
        {shown ? (
          <input
            id={id}
            type="text"
            value={props.value}
            autocomplete={props.autoComplete}
            onInput={(event) => props.onInput((event.currentTarget as HTMLInputElement).value)}
          />
        ) : (
          <input
            id={id}
            type="password"
            value={props.value}
            autocomplete={props.autoComplete}
            onInput={(event) => props.onInput((event.currentTarget as HTMLInputElement).value)}
          />
        )}
        <button
          type="button"
          class="text-btn"
          aria-pressed={shown}
          aria-label={shown ? `Hide ${props.label}` : `Show ${props.label}`}
          onClick={() => setShown((value) => !value)}
        >
          {shown ? 'Hide' : 'Show'}
        </button>
      </span>
    </div>
  )
}
