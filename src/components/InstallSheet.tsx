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
    <>
      <ol class="install-steps">
        <li class="install-step">
          <span class="install-num">1</span>
          <span class="install-copy">
            <strong>Tap the menu button (three lines) on the left side of the web address at the bottom.</strong>
            <SafariBar />
          </span>
        </li>
        <li class="install-step">
          <span class="install-num">2</span>
          <span class="share-badge" aria-hidden="true">
            <ShareIcon />
          </span>
          <span>
            <strong>Tap Share</strong>
          </span>
        </li>
        <li class="install-step">
          <span class="install-num">3</span>
          <span class="install-copy">
            <strong>Tap Add to Home Screen</strong>
            <span class="install-hint">Scroll down if you need to.</span>
            <span class="install-fake">Add to Home Screen</span>
          </span>
        </li>
        <li class="install-step">
          <span class="install-num">4</span>
          <span class="install-copy">
            <strong>Tap Add</strong>
            <span class="install-fake add">Add</span>
          </span>
        </li>
      </ol>
      <p class="fine install-note">Older iPhones may show the Share button (square with up arrow) right in the bottom bar.</p>
    </>
  )
}

function SafariBar() {
  return (
    <span class="install-safari" aria-hidden="true">
      <svg viewBox="0 0 320 78" width="100%" role="img">
        <rect x="0" y="26" width="320" height="52" rx="16" fill="#000" />
        <circle cx="22" cy="53" r="16" fill="#3a3a3c" />
        <path d="M25 47.5 18 53l7 5.5" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        <rect x="46" y="37" width="214" height="32" rx="16" fill="#3a3a3c" />
        <circle class="install-menu" cx="68" cy="53" r="12" fill="none" stroke="#F9682D" stroke-width="2.5" />
        <path d="M61 49h13M61 53h9M61 57h5" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" />
        <text x="86" y="57" fill="#fff" font-size="13" font-family="inherit">nightyard</text>
        <g transform="translate(230 46)" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M7 2.2a5.6 5.6 0 1 1-1.6-1.4" />
          <path d="M7 .4v4H3.2" />
        </g>
        <circle cx="292" cy="53" r="16" fill="#3a3a3c" />
        <rect x="286" y="44" width="10" height="10" rx="2" fill="none" stroke="#fff" stroke-width="1.5" />
        <rect x="282" y="48" width="10" height="10" rx="2" fill="#3a3a3c" stroke="#fff" stroke-width="1.5" />
        <path d="M68 16v14" fill="none" stroke="#F9682D" stroke-width="3" stroke-linecap="round" />
        <path d="M60 26l8 10 8-10" fill="none" stroke="#F9682D" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </span>
  )
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      <path d="M12 4v9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <path d="M8 8l4-4 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M6 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
  )
}
