import { registerSW } from 'virtual:pwa-register'

/** Register the worker, ask for an update on load and when the kid comes back, then hand the waiting build to the app. */
export function watchUpdates(options: { onReady: (reload: () => Promise<void>) => void }): () => void {
  let registration: ServiceWorkerRegistration | undefined
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      options.onReady(() => updateSW(true))
    },
    onRegisteredSW(_url, next) {
      registration = next
      void next?.update()
    },
  })

  const check = () => {
    void registration?.update()
  }
  const onVisible = () => {
    if (document.visibilityState === 'visible') check()
  }
  window.addEventListener('focus', check)
  document.addEventListener('visibilitychange', onVisible)
  return () => {
    window.removeEventListener('focus', check)
    document.removeEventListener('visibilitychange', onVisible)
  }
}
