import { Block, Chip, Kicker, Slide, Title } from './primitives'
import { Arrow, Feature, Node, type SlideFn } from './parts'

export const slides1: SlideFn[] = [
  // Title
  () => (
    <Slide bg="bg-sun">
      <div className="absolute -right-24 -top-24 h-[520px] w-[520px] rotate-12 rounded-[5rem] bg-blush" />
      <div className="absolute -bottom-32 right-60 h-[420px] w-[420px] rounded-full bg-sky" />
      <div className="absolute bottom-24 right-16 h-60 w-60 -rotate-12 rounded-[3rem] bg-olive" />
      <div className="relative flex h-full flex-col justify-center gap-8">
        <Kicker>Hackathon build · Nashik, India</Kicker>
        <h1 className="font-heading text-[190px] font-semibold leading-[0.85] tracking-tighter text-ink">
          civicpulse<span className="text-blush-deep">.</span>
        </h1>
        <p className="max-w-[900px] text-5xl leading-tight text-ink">Report it. Six AI agents route it. The city fixes it. You get the receipt.</p>
        <div className="flex gap-4"><Chip tone="ink">Cline SDK</Chip><Chip tone="cream">Gemini</Chip><Chip tone="cream">Google Cloud</Chip></div>
      </div>
    </Slide>
  ),
  // Problem
  () => (
    <Slide>
      <Kicker>The problem</Kicker>
      <Title className="mt-4">Civic reports go to die.</Title>
      <div className="mt-14 grid grid-cols-3 gap-8">
        <Block tone="sun" className="h-[420px]"><p className="font-heading text-[150px] font-semibold leading-none">∞</p><p className="mt-6 text-4xl font-semibold">duplicate complaints for one pothole</p></Block>
        <Block tone="blush" className="h-[420px]"><p className="font-heading text-[150px] font-semibold leading-none">?</p><p className="mt-6 text-4xl font-semibold">who owns it, and how urgent is it</p></Block>
        <Block tone="sky" className="h-[420px]"><p className="font-heading text-[150px] font-semibold leading-none">0</p><p className="mt-6 text-4xl font-semibold">proof it was ever really fixed</p></Block>
      </div>
    </Slide>
  ),
  // Solution
  () => (
    <Slide bg="bg-sky">
      <Kicker>The answer</Kicker>
      <Title className="mt-4">One pipeline, citizen to proof.</Title>
      <div className="mt-24 flex items-center justify-between">
        <Node n="01" label="Citizen reports" tone="sun" /><Arrow />
        <Node n="02" label="6 AI agents" tone="blush" /><Arrow />
        <Node n="03" label="Municipality acts" tone="olive" /><Arrow />
        <Node n="04" label="Community verifies" tone="cream" /><Arrow />
        <Node n="05" label="Impact receipt" tone="sun" />
      </div>
      <div className="mt-14 grid grid-cols-3 gap-6">
        <Block tone="cream" className="h-[170px]"><p className="font-heading text-6xl font-semibold leading-none">1 report</p><p className="mt-3 text-2xl font-semibold">photo, GPS pin, any language</p></Block>
        <Block tone="sun" className="h-[170px]"><p className="font-heading text-6xl font-semibold leading-none">0 duplicates</p><p className="mt-3 text-2xl font-semibold">nearby matches merge into one</p></Block>
        <Block tone="olive" className="h-[170px]"><p className="font-heading text-6xl font-semibold leading-none">1 receipt</p><p className="mt-3 text-2xl font-semibold">shareable proof of the fix</p></Block>
      </div>
      <div className="mt-10 flex justify-center"><Chip tone="ink">Every AI step runs on Cline SDK</Chip></div>
    </Slide>
  ),
  // Landing
  () => (
    <Feature kicker="Landing page" title="Hello, city." src="/" url="civicpulse.app"
      chips={<><Chip tone="sun">Live ticker</Chip><Chip tone="blush">Bento stats</Chip><Chip tone="sky">Pastel UI</Chip></>} />
  ),
  // Login
  () => (
    <Feature bg="bg-blush" kicker="Access" title="Sign in, no passwords." src="/auth/login" url="civicpulse.app/auth/login"
      chips={<><Chip>Google OAuth</Chip><Chip>Magic link</Chip><Chip tone="ink">Role-aware</Chip></>} />
  ),
  // Report
  () => (
    <Feature kicker="Citizen reporting" title="Report in 30 seconds." src="/deck/preview/report" url="civicpulse.app/report"
      chips={<><Chip tone="sun">Camera</Chip><Chip tone="olive">GPS + map pin</Chip><Chip tone="sky">Any language</Chip></>} />
  ),
  // Pipeline
  () => (
    <Slide bg="bg-ink">
      <p className="font-mono text-lg font-bold uppercase tracking-[0.25em] text-cream/60">LangGraph pipeline</p>
      <h2 className="mt-4 font-heading text-[84px] font-semibold leading-[0.95] tracking-tight text-cream">Six agents. One graph.</h2>
      <div className="mt-20 flex items-center justify-between">
        <Node n="A0" label="Translate" tone="sky" /><span className="text-5xl text-cream">→</span>
        <Node n="A1" label="Classify" tone="sun" /><span className="text-5xl text-cream">→</span>
        <Node n="A2" label="Dedupe" tone="blush" /><span className="text-5xl text-cream">→</span>
        <Node n="A3" label="Validate" tone="olive" /><span className="text-5xl text-cream">→</span>
        <Node n="A4" label="Resolve" tone="sun" />
      </div>
      <div className="mt-8 flex justify-between" style={{ paddingInline: 0 }}>
        {[
          ['sky', 'Any language to English'],
          ['sun', 'Category, severity, emergency flag'],
          ['blush', 'Merge nearby look-alikes'],
          ['olive', 'Weather + credibility check'],
          ['sun', 'Action brief + SLA deadline'],
        ].map(([tone, text], i) => (
          <Block key={i} tone={tone as 'sky'} className="h-[190px] w-52 shrink-0 !rounded-[2rem] !p-5"><p className="text-[28px] font-semibold leading-tight">{text}</p></Block>
        ))}
      </div>
      <div className="mt-10 flex items-center justify-center gap-6">
        <Chip tone="blush">A5 · Predictive, async</Chip><Chip>Conditional edges</Chip><Chip>Human-in-the-loop interrupt</Chip>
      </div>
    </Slide>
  ),
]
