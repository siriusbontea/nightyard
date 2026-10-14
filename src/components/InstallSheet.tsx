import { menuInstallText } from '../install'
import { Sheet } from './Sheets'

export function InstallTip(props: { onShow: () => void; onLater: () => void }) {
  return (
    <div class="scrim welcome-scrim install-scrim">
      <div class="welcome-card" role="dialog" aria-modal="true" aria-label="Put Night Yard on your home screen">
        <h2>Put Night Yard on your home screen</h2>
        <p class="fine">Then Night Yard opens like a game.</p>
        <button type="button" class="primary wide" data-tip="See how to add it" onClick={props.onShow}>
          Show me
        </button>
        <button type="button" class="text-btn" data-tip="Maybe later" onClick={props.onLater}>
          Not now
        </button>
      </div>
    </div>
  )
}

export function InstallGuide(props: { ios: boolean; onClose: () => void }) {
  return (
    <Sheet title="Add to Home Screen" onClose={props.onClose}>
      {props.ios ? <IosGuide /> : <p class="fine">{menuInstallText(navigator.userAgent)}</p>}
      <button type="button" class="primary wide" data-tip="Close this" onClick={props.onClose}>
        OK
      </button>
    </Sheet>
  )
}

function IosGuide() {
  return (
    <ol class="install-steps">
      <li class="install-step">
        <span class="install-num">1</span>
        <span class="share-badge" aria-hidden="true">
          <ShareIcon />
        </span>
        <span>
          <strong>Tap Share</strong>
          <span>The square with the arrow, at the bottom.</span>
        </span>
      </li>
      <li class="install-step">
        <span class="install-num">2</span>
        <span class="install-fake">Add to Home Screen</span>
      </li>
      <li class="install-step">
        <span class="install-num">3</span>
        <span class="install-fake add">Add</span>
      </li>
    </ol>
  )
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true">
      <path d="M12 4v9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <path d="M8 8l4-4 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M6 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
  )
}
