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
            <strong>Tap the menu button</strong>
            <span class="install-hint">Next to the web address, at the bottom.</span>
            <span class="install-phone" aria-hidden="true">
              <span class="install-bar">
                <span class="install-bar-url">nightyard</span>
                <span class="install-menu">
                  <MenuIcon />
                </span>
              </span>
            </span>
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

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
    </svg>
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
