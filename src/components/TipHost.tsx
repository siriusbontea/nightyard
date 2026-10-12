import { useEffect, useState } from 'preact/hooks'

interface TipState {
  text: string
  x: number
  y: number
  below: boolean
}

function tipTarget(node: EventTarget | null): HTMLElement | null {
  if (!(node instanceof Element)) return null
  const el = node.closest('button, a, [data-tip]')
  return el instanceof HTMLElement ? el : null
}

function confirmOpen(): boolean {
  return document.querySelector('.confirm-scrim, .no-tip') !== null
}

function blocksTips(node: EventTarget | null): boolean {
  if (confirmOpen()) return true
  return node instanceof Element && Boolean(node.closest('.confirm-scrim, .confirm-card, .no-tip'))
}

function tipLabel(el: HTMLElement): string | null {
  if (el.dataset.tip) return el.dataset.tip
  const aria = el.getAttribute('aria-label')
  if (aria) return aria
  const line = (el.innerText || '')
    .split('\n')
    .map((part) => part.trim())
    .find(Boolean)
  if (!line || line.length > 48) return null
  return line
}

/** Hover on a desktop. A long press on a phone. A quick tap still runs the button. */
export function TipHost() {
  const [tip, setTip] = useState<TipState | null>(null)

  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)')
    let hoverTimer = 0
    let pressTimer = 0
    let hideTimer = 0
    let suppressClick = false
    let lastTouch = 0

    function mouseLike(event: PointerEvent): boolean {
      if (event.pointerType === 'touch') return false
      if (event.pointerType === 'mouse' || event.pointerType === 'pen') return true
      return fine.matches
    }

    function place(el: HTMLElement) {
      if (blocksTips(el)) {
        setTip(null)
        return
      }
      const text = tipLabel(el)
      if (!text) {
        setTip(null)
        return
      }
      const rect = el.getBoundingClientRect()
      const below = rect.top < 72
      const x = Math.min(window.innerWidth - 16, Math.max(16, rect.left + rect.width / 2))
      setTip({ text, x, y: below ? rect.bottom : rect.top, below })
    }

    function onOver(event: PointerEvent) {
      if (!mouseLike(event)) return
      if (blocksTips(event.target)) {
        window.clearTimeout(hoverTimer)
        setTip(null)
        return
      }
      if (Date.now() - lastTouch < 700) return
      const el = tipTarget(event.target)
      window.clearTimeout(hoverTimer)
      if (!el) return
      hoverTimer = window.setTimeout(() => place(el), 350)
    }

    function onOut(event: PointerEvent) {
      if (!mouseLike(event)) return
      window.clearTimeout(hoverTimer)
      const next = event.relatedTarget instanceof Node ? tipTarget(event.relatedTarget) : null
      if (next) return
      setTip(null)
    }

    function onDown(event: PointerEvent) {
      if (event.pointerType === 'touch') lastTouch = Date.now()
      if (mouseLike(event)) return
      window.clearTimeout(pressTimer)
      window.clearTimeout(hideTimer)
      const el = tipTarget(event.target)
      if (!el || el.closest('.tour-card') || blocksTips(el)) return
      pressTimer = window.setTimeout(() => {
        place(el)
        suppressClick = true
      }, 550)
    }

    function onUp() {
      window.clearTimeout(pressTimer)
      if (!suppressClick) return
      window.clearTimeout(hideTimer)
      hideTimer = window.setTimeout(() => {
        setTip(null)
        suppressClick = false
      }, 1600)
    }

    function onClick(event: MouseEvent) {
      if (!suppressClick) return
      event.preventDefault()
      event.stopPropagation()
      suppressClick = false
    }

    const observer = new MutationObserver(() => {
      if (confirmOpen()) setTip(null)
    })
    observer.observe(document.body, { childList: true, subtree: true })

    document.addEventListener('pointerover', onOver)
    document.addEventListener('pointerout', onOut)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('pointerup', onUp)
    document.addEventListener('pointercancel', onUp)
    document.addEventListener('click', onClick, true)
    return () => {
      window.clearTimeout(hoverTimer)
      window.clearTimeout(pressTimer)
      window.clearTimeout(hideTimer)
      document.removeEventListener('pointerover', onOver)
      document.removeEventListener('pointerout', onOut)
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointercancel', onUp)
      document.removeEventListener('click', onClick, true)
      observer.disconnect()
    }
  }, [])

  if (!tip) return null
  return (
    <div
      class={tip.below ? 'tip-pop below' : 'tip-pop'}
      role="tooltip"
      style={{ left: `${tip.x}px`, top: `${tip.y}px` }}
    >
      {tip.text}
    </div>
  )
}
