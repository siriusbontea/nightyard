import { describe, expect, it } from 'vitest'
import { installKind, installedNow, isIosDevice, menuInstallText, shouldShowInstallTip } from './install'

describe('add to home screen', () => {
  it('hides the offer when the app is already installed', () => {
    expect(installedNow({ displayModeStandalone: true, navigatorStandalone: false })).toBe(true)
    expect(installedNow({ displayModeStandalone: false, navigatorStandalone: true })).toBe(true)
    expect(installedNow({ displayModeStandalone: false, navigatorStandalone: false })).toBe(false)
    expect(
      shouldShowInstallTip({
        installed: true,
        dismissed: false,
        welcome: false,
        tourOpen: false,
        hasPlay: true,
        tourDone: true,
      }),
    ).toBe(false)
  })

  it('shows the tip once the first play is open and the tour is done', () => {
    const ready = {
      installed: false,
      dismissed: false,
      welcome: false,
      tourOpen: false,
      hasPlay: true,
      tourDone: true,
    }
    expect(shouldShowInstallTip(ready)).toBe(true)
    expect(shouldShowInstallTip({ ...ready, tourOpen: true })).toBe(false)
    expect(shouldShowInstallTip({ ...ready, tourDone: false })).toBe(false)
    expect(shouldShowInstallTip({ ...ready, dismissed: true })).toBe(false)
    expect(shouldShowInstallTip({ ...ready, welcome: true })).toBe(false)
  })

  it('uses one tap on Android, a picture guide on iPhone, and a short menu note on a computer', () => {
    expect(installKind({ ios: false, canPrompt: true })).toBe('prompt')
    expect(installKind({ ios: true, canPrompt: true })).toBe('ios')
    expect(installKind({ ios: true, canPrompt: false })).toBe('ios')
    expect(installKind({ ios: false, canPrompt: false })).toBe('menu')
    expect(isIosDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', false)).toBe(true)
    expect(isIosDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) CriOS/120.0.0.0', false)).toBe(true)
    expect(isIosDevice('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)', false)).toBe(true)
    expect(isIosDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X)', true)).toBe(true)
    expect(isIosDevice('Mozilla/5.0 Chrome/120.0.0.0', false)).toBe(false)
    expect(menuInstallText('Mozilla/5.0 Chrome/120.0.0.0')).toBe('Open the browser menu. Then choose Install Night Yard.')
    expect(menuInstallText('Mozilla/5.0 Safari/605')).toBe('Open the Share menu. Then choose Add to Dock.')
    expect(menuInstallText('Mozilla/5.0 Firefox/120')).toContain('Chrome or Edge')
  })
})
