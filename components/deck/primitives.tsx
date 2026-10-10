'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

export function ScaledIframe({ src, width = 1440 }: { src: string; width?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setBox({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])
  const scale = box.w ? box.w / width : 1
  return (
    <div ref={ref} className="relative h-full w-full overflow-hidden bg-cream">
      {box.w > 0 && (
        <iframe
          src={src}
          title={src}
          loading="eager"
          style={{ width, height: box.h / scale, transform: `scale(${scale})`, transformOrigin: '0 0', border: 0 }}
        />
      )}
    </div>
  )
}

type BrowserProps = { url: string; className?: string } & (
  | { src: string; children?: never }
  | { src?: never; children: ReactNode }
)

export function Browser({ src, children, url, className = '' }: BrowserProps) {
  return (
    <div className={`flex flex-col overflow-hidden rounded-[2rem] border-[3px] border-ink bg-white shadow-[10px_10px_0_0_#17140f] ${className}`}>
      <div className="flex items-center gap-3 border-b-[3px] border-ink bg-cream px-5 py-3">
        <span className="h-3.5 w-3.5 rounded-full bg-blush-deep" />
        <span className="h-3.5 w-3.5 rounded-full bg-sun-deep" />
        <span className="h-3.5 w-3.5 rounded-full bg-olive-deep" />
        <span className="ml-3 flex-1 truncate rounded-full border-2 border-ink/20 bg-white px-4 py-1 font-mono text-sm text-ink/70">{url}</span>
      </div>
      <div className="min-h-0 flex-1">
        {src !== undefined ? <ScaledIframe src={src} /> : children}
      </div>
    </div>
  )
}

export function Chip({ children, tone = 'cream', className = '' }: { children: ReactNode; tone?: 'cream' | 'sun' | 'blush' | 'olive' | 'sky' | 'ink'; className?: string }) {
  const tones = {
    cream: 'bg-cream text-ink',
    sun: 'bg-sun text-ink',
    blush: 'bg-blush text-ink',
    olive: 'bg-olive text-ink',
    sky: 'bg-sky text-ink',
    ink: 'bg-ink text-cream',
  }
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border-2 border-ink px-5 py-2 text-xl font-bold ${tones[tone]} ${className}`}>
      {children}
    </span>
  )
}

export function Kicker({ children }: { children: ReactNode }) {
  return <p className="font-mono text-lg font-bold uppercase tracking-[0.25em] text-ink/60">{children}</p>
}

export function Title({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <h2 className={`font-heading text-[84px] font-semibold leading-[0.95] tracking-tight text-ink ${className}`}>{children}</h2>
}

export function Block({ tone, children, className = '' }: { tone: 'sun' | 'blush' | 'olive' | 'sky' | 'ink' | 'cream'; children: ReactNode; className?: string }) {
  const tones = { sun: 'bg-sun', blush: 'bg-blush', olive: 'bg-olive', sky: 'bg-sky', ink: 'bg-ink text-cream', cream: 'bg-cream' }
  return <div className={`rounded-[2.5rem] border-[3px] border-ink p-8 ${tones[tone]} ${className}`}>{children}</div>
}

export function ClineBadge({ className = '' }: { className?: string }) {
  return <Chip tone="ink" className={className}><span className="text-sun">⚡</span> Powered by Cline SDK</Chip>
}

export function Slide({ bg = 'bg-cream', children }: { bg?: string; children: ReactNode }) {
  return <div className={`relative h-[900px] w-[1600px] overflow-hidden p-16 ${bg}`}>{children}</div>
}

/** Left copy + right visual layout */
export function Split({ left, right, leftW = 'w-[560px]' }: { left: ReactNode; right: ReactNode; leftW?: string }) {
  return (
    <div className="flex h-full items-center gap-14">
      <div className={`flex shrink-0 flex-col gap-7 ${leftW}`}>{left}</div>
      <div className="h-full min-w-0 flex-1 py-2">{right}</div>
    </div>
  )
}
