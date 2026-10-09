import { isDoubleTap, isPinch, type TapPoint } from './zoom'

/** Pin the app to the visible viewport. iOS Safari's `dvh` can stay as tall as the
 *  hidden-toolbar screen, so the bottom bar sits under the address bar.
 *  Rotation and the keyboard both fire resize, so the field refits. */
export function bindVisibleViewport(target: HTMLElement = document.documentElement): () => void {
  const apply = () => {
    const frame = window.visualViewport
    const height = frame?.height ?? window.innerHeight
    const top = frame?.offsetTop ?? 0
    target.style.setProperty('--app-height', `${height}px`)
    target.style.setProperty('--app-top', `${top}px`)
  }
  apply()
  const frame = window.visualViewport
  frame?.addEventListener('resize', apply)
  frame?.addEventListener('scroll', apply)
  window.addEventListener('resize', apply)
  window.addEventListener('orientationchange', apply)
  const unlockZoom = lockPageZoom()
  return () => {
    frame?.removeEventListener('resize', apply)
    frame?.removeEventListener('scroll', apply)
    window.removeEventListener('resize', apply)
    window.removeEventListener('orientationchange', apply)
    unlockZoom()
  }
}

/** Stop pinch and double-tap from scaling the page. One-finger pans in sheets still scroll.
 *  iOS ignores `user-scalable=no` for the system accessibility zoom. */
export function lockPageZoom(target: Document = document): () => void {
  const prevent = (event: Event) => {
    event.preventDefault()
  }
  target.addEventListener('gesturestart', prevent, { passive: false })
  target.addEventListener('gesturechange', prevent, { passive: false })
  target.addEventListener('gestureend', prevent, { passive: false })

  const onTouchStart = (event: TouchEvent) => {
    if (isPinch(event.touches.length)) event.preventDefault()
  }
  const onTouchMove = (event: TouchEvent) => {
    if (isPinch(event.touches.length)) event.preventDefault()
  }
  let lastTap: TapPoint | null = null
  const onTouchEnd = (event: TouchEvent) => {
    if (event.touches.length > 0) return
    const touch = event.changedTouches[0]
    if (!touch) return
    const now = Date.now()
    if (isDoubleTap(lastTap, now, touch.clientX, touch.clientY)) event.preventDefault()
    lastTap = { t: now, x: touch.clientX, y: touch.clientY }
  }

  target.addEventListener('touchstart', onTouchStart, { passive: false })
  target.addEventListener('touchmove', onTouchMove, { passive: false })
  target.addEventListener('touchend', onTouchEnd, { passive: false })
  return () => {
    target.removeEventListener('gesturestart', prevent)
    target.removeEventListener('gesturechange', prevent)
    target.removeEventListener('gestureend', prevent)
    target.removeEventListener('touchstart', onTouchStart)
    target.removeEventListener('touchmove', onTouchMove)
    target.removeEventListener('touchend', onTouchEnd)
  }
}
