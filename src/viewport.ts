/** Pin the app to the visible viewport. iOS Safari's `dvh` can stay as tall as the
 *  hidden-toolbar screen, so the bottom bar sits under the address bar. */
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
  return () => {
    frame?.removeEventListener('resize', apply)
    frame?.removeEventListener('scroll', apply)
    window.removeEventListener('resize', apply)
    window.removeEventListener('orientationchange', apply)
  }
}
