'use client'

import { useEffect, useRef } from 'react'
import styles from './HeroThreads.module.css'

const THREADS = Array.from({ length: 36 }, (_, index) => ({
  index: index % 18,
  side: index < 18 ? 'left' : 'right',
  color: ['#7f9145', '#cf85b0', '#8c9fdb'][Math.floor(index / 6) % 3],
}))

function threadPath(index: number, side: string, progress: number) {
  const gap = index * 13
  const bend = progress * 180

  return side === 'left'
    ? `M ${-280 + gap} -80 C ${620 + gap - bend} ${90 + bend}, ${-470 + gap} ${290 - bend}, ${60 + gap + bend} 510 S ${640 + gap} ${740 - bend}, ${320 + gap - bend} 980`
    : `M ${1520 - gap} -80 C ${780 - gap + bend} ${150 - bend}, ${1930 - gap} ${320 + bend}, ${1330 - gap - bend} 530 S ${850 - gap} ${760 + bend}, ${1270 - gap + bend} 980`
}

export default function HeroThreads() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const paths = container.querySelectorAll('path')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0

    const paint = () => {
      frame = 0
      const bounds = container.getBoundingClientRect()
      const progress = reducedMotion.matches
        ? 0
        : Math.min(1, Math.max(0, -bounds.top / bounds.height))

      paths.forEach((path, index) => {
        const thread = THREADS[index]
        path.setAttribute('d', threadPath(thread.index, thread.side, progress))
      })
    }

    const schedulePaint = () => {
      if (!frame) frame = window.requestAnimationFrame(paint)
    }

    const syncMotionPreference = () => {
      window.removeEventListener('scroll', schedulePaint)
      window.removeEventListener('resize', schedulePaint)
      if (!reducedMotion.matches) {
        window.addEventListener('scroll', schedulePaint, { passive: true })
        window.addEventListener('resize', schedulePaint)
      }
      schedulePaint()
    }

    syncMotionPreference()
    reducedMotion.addEventListener('change', syncMotionPreference)

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedulePaint)
      window.removeEventListener('resize', schedulePaint)
      reducedMotion.removeEventListener('change', syncMotionPreference)
    }
  }, [])

  return (
    <div ref={containerRef} className={styles.threads} aria-hidden="true">
      <svg viewBox="0 0 1440 900" preserveAspectRatio="none" fill="none" focusable="false">
        {['left', 'right'].map((side) => (
          <g key={side} className={side === 'left' ? styles.left : styles.right}>
            {THREADS.filter((thread) => thread.side === side).map((thread) => (
              <path
                key={`${side}-${thread.index}`}
                d={threadPath(thread.index, side, 0)}
                stroke={thread.color}
                strokeWidth={thread.index % 6 === 0 ? 1.5 : 0.8}
                strokeOpacity={thread.index % 6 === 0 ? 0.55 : 0.32}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        ))}
      </svg>
    </div>
  )
}