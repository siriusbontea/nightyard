import { useEffect, useState } from 'preact/hooks'

const TIP_KEY = 'night-yard-install-tip'

export interface InstallPrompt extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let waiting: InstallPrompt | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function startInstallCapture() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    waiting = event as InstallPrompt
    emit()
  })
  window.addEventListener('appinstalled', () => {
    waiting = null
    emit()
  })
  const mode = window.matchMedia('(display-mode: standalone)')
  mode.addEventListener?.('change', emit)
}

export function subscribeInstall(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function canPromptInstall(): boolean {
  return waiting !== null
}

export function isIosDevice(ua = navigator.userAgent, touchMac = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1): boolean {
  if (/iPad|iPhone|iPod/.test(ua)) return true
  return touchMac
}

/** Chrome, Edge, and Android can install in one tap. iPhone and iPad get the picture guide. */
export function installKind(input: { ios: boolean; canPrompt: boolean }): 'prompt' | 'ios' | 'menu' {
  if (input.ios) return 'ios'
  if (input.canPrompt) return 'prompt'
  return 'menu'
}

export function installedNow(input: { displayModeStandalone: boolean; navigatorStandalone: boolean }): boolean {
  return input.displayModeStandalone || input.navigatorStandalone
}

export function isInstalled(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean }
  return installedNow({
    displayModeStandalone: window.matchMedia('(display-mode: standalone)').matches,
    navigatorStandalone: nav.standalone === true,
  })
}

export function installTipDismissed(): boolean {
  try {
    return globalThis.localStorage?.getItem(TIP_KEY) === '1'
  } catch {
    return false
  }
}

export function dismissInstallTip(): void {
  try {
    globalThis.localStorage?.setItem(TIP_KEY, '1')
  } catch {
    /* Private mode can block storage. The tip can show again next time. */
  }
}

/** After the first play is on screen and the tour is finished. Never while installed. */
export function shouldShowInstallTip(input: {
  installed: boolean
  dismissed: boolean
  welcome: boolean
  tourOpen: boolean
  hasPlay: boolean
  tourDone: boolean
}): boolean {
  if (input.installed || input.dismissed || input.welcome || input.tourOpen) return false
  return input.hasPlay && input.tourDone
}

export function menuInstallText(ua: string): string {
  const safari = /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|Android|Firefox/i.test(ua)
  if (safari) return 'Open the Share menu. Then choose Add to Dock.'
  if (/Firefox/i.test(ua)) return 'Open Night Yard in Chrome or Edge. Then choose Install Night Yard.'
  return 'Open the browser menu. Then choose Install Night Yard.'
}

export async function promptInstall(): Promise<boolean> {
  const event = waiting
  if (!event) return false
  waiting = null
  emit()
  await event.prompt()
  const choice = await event.userChoice
  return choice.outcome === 'accepted'
}

export function useInstallOffer() {
  const [rev, setRev] = useState(0)
  useEffect(() => subscribeInstall(() => setRev((value) => value + 1)), [])
  void rev
  const installed = isInstalled()
  return {
    installed,
    ios: isIosDevice(),
    canPrompt: canPromptInstall(),
    kind: installed ? 'hidden' : installKind({ ios: isIosDevice(), canPrompt: canPromptInstall() }),
  }
}
