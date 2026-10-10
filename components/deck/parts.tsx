import type { ReactNode } from 'react'
import { Block, ClineBadge, Kicker, Slide, Split, Title } from './primitives'

export type DeckCtx = { receiptId: string | null }
export type SlideFn = (c: DeckCtx) => ReactNode

export const Node = ({ n, label, tone }: { n: string; label: string; tone: 'sun' | 'blush' | 'olive' | 'sky' | 'cream' }) => (
  <Block tone={tone} className="flex h-44 w-52 shrink-0 flex-col items-center justify-center gap-2 text-center">
    <span className="font-mono text-xl font-bold text-ink/60">{n}</span>
    <span className="font-heading text-3xl font-semibold leading-tight">{label}</span>
  </Block>
)

export const Arrow = () => <span className="font-heading text-5xl text-ink">→</span>

export const Agent = ({ n, name, line, tone, children }: { n: string; name: string; line: string; tone: 'sun' | 'blush' | 'olive' | 'sky'; children: ReactNode }) => (
  <Slide>
    <Split
      left={
        <>
          <Kicker>Agent {n}</Kicker>
          <Title>{name}</Title>
          <p className="text-3xl leading-snug text-ink/75">{line}</p>
          <ClineBadge className="self-start" />
        </>
      }
      right={<Block tone={tone} className="flex h-full flex-col justify-center gap-6">{children}</Block>}
    />
  </Slide>
)

/** Browser-frame feature slide: copy on the left, live iframe on the right. */
export const Feature = ({ bg, kicker, title, chips, src, url, leftW = 'w-[420px]' }: {
  bg?: string; kicker: string; title: string; chips: ReactNode; src: string; url: string; leftW?: string
}) => (
  <Slide bg={bg}>
    <Split
      leftW={leftW}
      left={<><Kicker>{kicker}</Kicker><Title>{title}</Title><div className="flex flex-wrap gap-3">{chips}</div></>}
      right={<BrowserFill src={src} url={url} />}
    />
  </Slide>
)

import { Browser } from './primitives'
const BrowserFill = ({ src, url }: { src: string; url: string }) => <Browser src={src} url={url} className="h-full" />
