'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { slides1 } from './slides-1'
import { slides2 } from './slides-2'
import { slides3 } from './slides-3'
import { slides4 } from './slides-4'

const W = 1600
const H = 900

export function DeckClient({ receiptId }: { receiptId: string | null }) {
  const slides = [...slides1, ...slides2, ...slides3, ...slides4]
  const [i, setI] = useState(0)
  const [scale, setScale] = useState(1)
  const touch = useRef<number | null>(null)

  const go = useCallback((d: number) => setI(v => Math.min(slides.length - 1, Math.max(0, v + d))), [slides.length])

  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / W, window.innerHeight / H))
    fit()
    window.addEventListener('resize', fit)
    const key = (e: KeyboardEvent) => {
      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) go(1)
      if (['ArrowLeft', 'PageUp'].includes(e.key)) go(-1)
      if (e.key === 'f') document.documentElement.requestFullscreen?.()
    }
    window.addEventListener('keydown', key)
    const hash = Number(window.location.hash.replace('#', ''))
    if (hash > 0 && hash <= slides.length) setI(hash - 1)
    return () => { window.removeEventListener('resize', fit); window.removeEventListener('keydown', key) }
  }, [go, slides.length])

  useEffect(() => { window.history.replaceState(null, '', `#${i + 1}`) }, [i])

  return (
    <div
      className="fixed inset-0 flex items-center justify-center overflow-hidden bg-ink"
      onTouchStart={e => { touch.current = e.touches[0].clientX }}
      onTouchEnd={e => {
        if (touch.current === null) return
        const dx = e.changedTouches[0].clientX - touch.current
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
        touch.current = null
      }}
    >
      <div style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: 'center' }} className="relative shrink-0">
        {slides.map((s, idx) => (
          // Every slide stays mounted so its iframe is already loaded; only the active one is visible.
          <div key={idx} className="absolute inset-0" style={{ visibility: idx === i ? 'visible' : 'hidden', pointerEvents: idx === i ? 'auto' : 'none' }}>
            {s({ receiptId })}
          </div>
        ))}
      </div>

      <div className="fixed bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full border-2 border-ink bg-cream px-3 py-2 shadow-[4px_4px_0_0_#17140f]">
        <button onClick={() => go(-1)} className="h-9 w-9 rounded-full bg-ink font-bold text-cream hover:bg-black" aria-label="Previous slide">←</button>
        <span className="min-w-[70px] text-center font-mono text-sm font-bold text-ink">{i + 1} / {slides.length}</span>
        <button onClick={() => go(1)} className="h-9 w-9 rounded-full bg-sun font-bold text-ink hover:bg-sun-deep" aria-label="Next slide">→</button>
      </div>
    </div>
  )
}
