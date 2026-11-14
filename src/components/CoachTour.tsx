import { useEffect, useState } from 'preact/hooks'

const STEPS = [
  { selector: '.field-frame', text: 'Orange players are your team. Drag one to move it.' },
  { selector: '[data-tour="draw"]', text: 'Tap Draw. Then drag from a player to draw a route.' },
  { selector: '[data-tour="plays"]', text: 'Your plays are in Plays. You can add one any time.' },
]

export function CoachTour(props: { onDone: () => void }) {
  const [step, setStep] = useState(0)
  const [box, setBox] = useState<{ top: number; left: number; width: number; height: number } | null>(null)

  useEffect(() => {
    let frame = 0
    const measure = () => {
      const current = STEPS[step]
      const el = current ? document.querySelector(current.selector) : null
      if (!(el instanceof HTMLElement)) {
        setBox(null)
        return
      }
      const rect = el.getBoundingClientRect()
      setBox({ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 })
    }
    measure()
    frame = window.requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', measure)
    }
  }, [step])

  const current = STEPS[step]
  if (!current) return null
  const below = !box || box.top < window.innerHeight * 0.45
  const cardTop = box ? (below ? box.top + box.height + 12 : Math.max(12, box.top - 132)) : 80

  function next() {
    if (step >= STEPS.length - 1) props.onDone()
    else setStep((value) => value + 1)
  }

  return (
    <div class="tour-scrim">
      {box ? <div class="tour-ring" style={{ top: `${box.top}px`, left: `${box.left}px`, width: `${box.width}px`, height: `${box.height}px` }} /> : null}
      <div class="tour-card" role="dialog" aria-label="Tip" style={{ top: `${cardTop}px` }}>
        <p class="tour-count">
          {step + 1} of {STEPS.length}
        </p>
        <p class="tour-copy">{current.text}</p>
        <div class="tour-actions">
          <button type="button" class="text-btn" onClick={props.onDone}>
            Skip
          </button>
          <button type="button" class="primary" onClick={next}>
            {step >= STEPS.length - 1 ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
