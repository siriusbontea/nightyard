import { Sheet } from './Sheets'

export function WelcomeCard(props: { onCreate: () => void; onTry: () => void; onSignIn: () => void }) {
  return (
    <div class="scrim welcome-scrim">
      <div class="welcome-card" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
        <p class="brand">Night Yard</p>
        <h2 id="welcome-title">Welcome</h2>
        <p class="welcome-copy">Make a free account to save your plays and use them on any device.</p>
        <button type="button" class="primary wide welcome-btn" onClick={props.onCreate}>
          Make free account
        </button>
        <button type="button" class="primary wide ghost welcome-btn" onClick={props.onTry}>
          Try it first
        </button>
        <button type="button" class="welcome-link" onClick={props.onSignIn}>
          Sign in
        </button>
      </div>
    </div>
  )
}

export function GuestSavePrompt(props: { onCreate: () => void; onClose: () => void; detail?: string }) {
  return (
    <Sheet title="Save your plays" onClose={props.onClose}>
      <p class="welcome-copy">Make a free account to save your plays and use them on any device.</p>
      <p class="fine">{props.detail ?? 'This play stays on the screen. Saving and sync need a free account.'}</p>
      <button type="button" class="primary wide welcome-btn" onClick={props.onCreate}>
        Make free account
      </button>
      <button type="button" class="primary wide ghost welcome-btn" onClick={props.onClose}>
        Not now
      </button>
    </Sheet>
  )
}
