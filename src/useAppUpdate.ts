import { useEffect, useRef, useState } from 'preact/hooks'
import { subscribeUpdateGate, updateWouldLoseWork } from './updateGate'

/** Prompt for a new build. Reload immediately when this visit has nothing to lose. */
export function useAppUpdate() {
  const [show, setShow] = useState(false)
  const reloadRef = useRef<(() => Promise<void>) | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (!import.meta.env.PROD) return
    let stop = () => {}
    let disposed = false
    void import('./pwaRegister').then(({ watchUpdates }) => {
      if (disposed) return
      stop = watchUpdates({
        onReady(reload) {
          reloadRef.current = reload
          if (!updateWouldLoseWork()) {
            if (started.current) return
            started.current = true
            void reload()
            return
          }
          setShow(true)
        },
      })
    })
    return () => {
      disposed = true
      stop()
    }
  }, [])

  useEffect(() => {
    if (!show) return
    return subscribeUpdateGate(() => {
      if (updateWouldLoseWork() || started.current) return
      const reload = reloadRef.current
      if (!reload) return
      started.current = true
      void reload()
    })
  }, [show])

  function apply() {
    if (started.current) return
    const reload = reloadRef.current
    if (!reload) return
    started.current = true
    void reload()
  }

  return { show, apply }
}
