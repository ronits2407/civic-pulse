import { Star, ThumbsDown, ThumbsUp, Users } from 'lucide-react'
import { Block, Chip, ClineBadge, Kicker, Slide, Title } from './primitives'
import { Agent, Arrow, Feature, type SlideFn } from './parts'

export const slides2: SlideFn[] = [
  // Agents 0 + 1
  () => (
    <Agent n="0 + 1" name="Understand it." line="Any language in, a clean structured report out." tone="sun">
      <div className="flex items-center gap-4">
        <Block tone="cream" className="flex-1 !rounded-3xl !p-7"><p className="font-mono text-sm font-bold uppercase tracking-widest text-ink/50">Citizen types</p><p className="mt-3 text-4xl font-semibold">पाणी साचले आहे</p><p className="mt-1 text-xl text-ink/60">Marathi</p></Block>
        <Arrow />
        <Block tone="blush" className="flex-1 !rounded-3xl !p-7"><p className="font-mono text-sm font-bold uppercase tracking-widest text-ink/50">A0 Translate</p><p className="mt-2 text-3xl font-semibold">Water is logged</p><p className="mt-1 text-xl text-ink/60">English for the agents</p></Block>
      </div>
      <div className="text-center font-heading text-4xl">↓ A1 Classify</div>
      <Block tone="ink" className="!rounded-3xl !p-8">
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-3xl">
          <div><p className="font-mono text-sm uppercase tracking-widest text-cream/50">category</p><p className="mt-1 font-semibold">Waterlogging</p></div>
          <div><p className="font-mono text-sm uppercase tracking-widest text-cream/50">is_emergency</p><p className="mt-1 font-semibold text-sun">false</p></div>
        </div>
        <p className="mt-5 font-mono text-sm uppercase tracking-widest text-cream/50">severity 1–10 (example: 6)</p>
        <div className="mt-2 flex gap-2">{Array.from({ length: 10 }).map((_, i) => <span key={i} className={`h-9 flex-1 rounded-md ${i < 6 ? 'bg-sun' : 'bg-cream/20'}`} />)}</div>
        <p className="mt-3 text-lg text-cream/60">Severity 8 or above, or immediate danger, flags an emergency.</p>
      </Block>
    </Agent>
  ),
  // Agent 2
  () => (
    <Agent n="2" name="Kill the duplicates." line="Same problem, one cluster." tone="blush">
      <div className="flex items-center gap-6">
        <svg viewBox="0 0 320 350" className="h-[360px] w-[330px] shrink-0">
          <circle cx="160" cy="160" r="140" fill="#f5f0e1" stroke="#17140f" strokeWidth="4" strokeDasharray="10 8" />
          <circle cx="160" cy="160" r="70" fill="none" stroke="#17140f" strokeOpacity=".2" strokeWidth="3" />
          {[[120, 120], [205, 135], [135, 205], [200, 200]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="13" fill="#f3d15c" stroke="#17140f" strokeWidth="3.5" />)}
          <circle cx="160" cy="160" r="20" fill="#17140f" />
          <circle cx="160" cy="160" r="8" fill="#f5f0e1" />
          <circle cx="290" cy="260" r="13" fill="#b1c1ec" stroke="#17140f" strokeWidth="3.5" />
          <text x="160" y="340" textAnchor="middle" fontSize="22" fontWeight="700" fill="#17140f">200 m radius</text>
        </svg>
        <div className="flex flex-col gap-4">
          <Chip tone="sun">● same issue → merged</Chip>
          <Chip tone="sky">● too far → new issue</Chip>
          <Chip tone="ink">● new report</Chip>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Block tone="cream" className="flex-1 !rounded-3xl !p-5 text-center"><p className="font-heading text-4xl font-semibold">pgvector</p><p className="mt-1 text-xl text-ink/70">cosine ≥ 0.85</p></Block>
        <span className="font-heading text-4xl">+</span>
        <Block tone="cream" className="flex-1 !rounded-3xl !p-5 text-center"><p className="font-heading text-4xl font-semibold">PostGIS</p><p className="mt-1 text-xl text-ink/70">within 200 m</p></Block>
        <Arrow />
        <Block tone="ink" className="!rounded-3xl !p-5 text-center"><p className="font-heading text-4xl font-semibold">1 cluster</p></Block>
      </div>
    </Agent>
  ),
  // Agent 3
  () => (
    <Agent n="3" name="Trust, then verify." line="Is this real? Evidence decides, not vibes." tone="olive">
      <div className="flex items-end justify-between">
        <div className="flex items-end gap-3"><p className="font-heading text-[150px] font-semibold leading-none">82</p><p className="pb-5 text-3xl font-semibold">/100<br />Confidence Index</p></div>
        <Chip tone="cream">example</Chip>
      </div>
      <div className="space-y-3">
        {[
          ['Photo evidence', 'Vision model checks the image', 'Supports', 90],
          ['Location', 'Pin matches the reported place', 'Supports', 85],
          ['Weather', 'Open-Meteo, last 3 days of rain', 'Supports', 75],
          ['Local news', 'Web search for related events', 'Unknown', 30],
        ].map(([k, d, o, v]) => (
          <div key={k as string} className="flex items-center gap-4 rounded-3xl border-[3px] border-ink bg-cream px-5 py-3">
            <div className="w-[300px]"><p className="text-2xl font-semibold leading-tight">{k}</p><p className="text-base text-ink/60">{d}</p></div>
            <div className="h-5 flex-1 overflow-hidden rounded-full bg-ink/10"><div className={`h-full rounded-full ${o === 'Supports' ? 'bg-olive-deep' : 'bg-sun'}`} style={{ width: `${v}%` }} /></div>
            <span className="w-[110px] text-right text-xl font-bold">{o}</span>
          </div>
        ))}
      </div>
    </Agent>
  ),
  // Agent 4
  () => (
    <Agent n="4" name="Write the brief." line="Department, deadline, action plan." tone="sky">
      <div className="flex items-center gap-3">
        <Block tone="cream" className="flex-1 !rounded-3xl !p-4 text-center"><p className="text-2xl font-semibold">Verified issue</p></Block>
        <Arrow />
        <Block tone="sun" className="flex-1 !rounded-3xl !p-4 text-center"><p className="text-2xl font-semibold">SOP lookup</p><p className="text-base text-ink/60">knowledge base</p></Block>
        <Arrow />
        <Block tone="blush" className="flex-1 !rounded-3xl !p-4 text-center"><p className="text-2xl font-semibold">Gemini</p><p className="text-base text-ink/60">writes the brief</p></Block>
      </div>
      <Block tone="cream" className="!rounded-3xl !p-8">
        <div className="flex items-center justify-between">
          <p className="font-mono text-sm font-bold uppercase tracking-widest text-ink/50">Civic action brief</p>
          <Chip tone="ink">SLA · hours from the SOP</Chip>
        </div>
        <div className="mt-6 space-y-4">{[100, 92, 96, 84, 60].map((w, i) => <div key={i} className="h-5 rounded-full bg-ink/15" style={{ width: `${w}%` }} />)}</div>
        <div className="mt-8 grid grid-cols-3 gap-3"><Chip tone="sky">Department</Chip><Chip tone="sun">Action plan</Chip><Chip tone="olive">Deadline</Chip></div>
      </Block>
      <p className="text-center text-xl text-ink/70">Deadline = now + SLA hours (72 h default when no SOP matches)</p>
    </Agent>
  ),
  // Agent 5
  () => (
    <Feature bg="bg-sun" kicker="Agent 5 · Predictive" title="See problems before they happen." src="/admin/dashboard" url="civicpulse.app/admin"
      chips={<><Chip tone="ink">k-means hotspots</Chip><Chip>Gemini Pro</Chip><Chip tone="blush">Async job</Chip></>} />
  ),
  // Cline SDK
  () => (
    <Slide bg="bg-ink">
      <p className="font-mono text-lg font-bold uppercase tracking-[0.25em] text-cream/60">The AI backbone</p>
      <h2 className="mt-4 font-heading text-[110px] font-semibold leading-[0.95] tracking-tight text-cream">Cline SDK, <span className="text-sun">everywhere.</span></h2>
      <div className="mt-14 flex items-center gap-6">
        <Block tone="sun" className="w-[300px] text-center"><p className="font-heading text-5xl font-semibold">Agents</p><p className="mt-2 text-2xl">0 → 5</p></Block><span className="text-5xl text-cream">→</span>
        <Block tone="cream" className="w-[360px] text-center"><p className="font-mono text-3xl font-bold">lib/ai/client.ts</p><p className="mt-2 text-2xl">one AI gateway</p></Block><span className="text-5xl text-cream">→</span>
        <Block tone="blush" className="w-[360px] text-center"><p className="font-heading text-5xl font-semibold">@cline/sdk</p><p className="mt-2 text-2xl">Llms.createHandler</p></Block><span className="text-5xl text-cream">→</span>
        <Block tone="sky" className="w-[300px] text-center"><p className="font-heading text-5xl font-semibold">Gemini</p><p className="mt-2 text-2xl">Flash · Pro</p></Block>
      </div>
      <div className="mt-12 flex flex-wrap gap-4">
        <Chip tone="sun">Structured JSON</Chip><Chip tone="sun">Text generation</Chip><Chip tone="sun">Vision / image analysis</Chip><Chip tone="olive">Streaming + error capture</Chip><Chip tone="cream">Auto-fallback to @google/genai</Chip>
      </div>
      <div className="mt-10 grid grid-cols-3 gap-6">
        <Block tone="cream" className="!rounded-3xl !p-6"><p className="font-heading text-4xl font-semibold">Flash + Pro</p><p className="mt-2 text-2xl font-semibold text-ink/70">two handlers, one gateway</p></Block>
        <Block tone="sun" className="!rounded-3xl !p-6"><p className="font-mono text-3xl font-bold">USE_CLINE_SDK</p><p className="mt-2 text-2xl font-semibold text-ink/70">on/off switch</p></Block>
        <Block tone="olive" className="!rounded-3xl !p-6"><p className="font-mono text-3xl font-bold">/api/test</p><p className="mt-2 text-2xl font-semibold text-ink/70">health check</p></Block>
      </div>
    </Slide>
  ),
  // Citizen dashboard
  () => (
    <Feature kicker="Citizen dashboard" title="Watch the agents work." src="/deck/preview/dashboard" url="civicpulse.app/dashboard"
      chips={<><Chip tone="sun">Realtime</Chip><Chip tone="olive">Karma</Chip><Chip tone="sky">Pipeline trace</Chip></>} />
  ),
  // Community
  () => (
    <Slide bg="bg-olive">
      <Kicker>Community verification</Kicker>
      <Title className="mt-4">Neighbours are the final check.</Title>
      <div className="mt-10 grid grid-cols-5 gap-8">
        <div className="col-span-2 flex flex-col gap-6">
          <Block tone="cream" className="!p-7">
            <div className="flex items-center gap-4">
              <span className="flex h-20 w-20 items-center justify-center rounded-full border-[3px] border-ink bg-olive"><ThumbsUp className="h-10 w-10" strokeWidth={2.5} /></span>
              <span className="flex h-20 w-20 items-center justify-center rounded-full border-[3px] border-ink bg-blush"><ThumbsDown className="h-10 w-10" strokeWidth={2.5} /></span>
            </div>
            <p className="mt-5 font-heading text-5xl font-semibold">Vote with proof</p>
            <p className="mt-1 text-2xl font-semibold text-ink/70">Neighbours confirm or reject</p>
          </Block>
          <Block tone="sun" className="!p-7">
            <div className="flex items-center gap-4">
              <span className="flex h-20 w-20 items-center justify-center rounded-full border-[3px] border-ink bg-cream"><Users className="h-10 w-10" strokeWidth={2.5} /></span>
              <p className="font-heading text-5xl font-semibold">Majority wins</p>
            </div>
            <p className="mt-4 text-2xl font-semibold text-ink/70">The verdict decides the issue status</p>
          </Block>
        </div>
        <Block tone="cream" className="col-span-3 !p-8">
          <div className="flex items-center justify-between">
            <p className="font-mono text-base font-bold uppercase tracking-widest text-ink/50">Karma panel</p>
            <Chip tone="ink">example</Chip>
          </div>
          <div className="mt-5 flex items-center gap-6">
            <div className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-3xl border-[3px] border-ink bg-sun"><span className="font-mono text-sm font-bold uppercase">Rank</span><span className="font-heading text-4xl font-semibold">#4</span></div>
            <div className="flex-1">
              <div className="flex items-end justify-between"><p className="font-heading text-4xl font-semibold">Civic Champion</p><p className="flex items-center gap-2 text-3xl font-bold">240 <Star className="h-7 w-7 fill-sun" strokeWidth={2.5} /></p></div>
              <div className="mt-3 h-5 overflow-hidden rounded-full border-[3px] border-ink bg-ink/10"><div className="h-full rounded-full bg-sky" style={{ width: '60%' }} /></div>
              <p className="mt-2 text-xl font-semibold text-ink/70">60 to Civic Ambassador</p>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-4 gap-3">
            {[['Observer', '0', 'bg-cream'], ['Guardian', '50', 'bg-olive'], ['Champion', '150', 'bg-sky'], ['Ambassador', '300', 'bg-blush']].map(([n, v, c]) => (
              <div key={n} className={`rounded-2xl border-[3px] border-ink px-3 py-3 text-center ${c}`}><p className="text-xl font-bold">{n}</p><p className="font-mono text-lg font-bold text-ink/60">{v}+</p></div>
            ))}
          </div>
          <p className="mt-6 font-mono text-base font-bold uppercase tracking-widest text-ink/50">How you earn</p>
          <div className="mt-3 flex flex-wrap gap-3"><Chip tone="sun">+2 vote</Chip><Chip tone="olive">+5 majority</Chip><Chip tone="sky">+20 confirmed</Chip><Chip tone="blush">+50 resolved</Chip></div>
        </Block>
      </div>
    </Slide>
  ),
]
