import Image from 'next/image'
import { Block, Browser, Chip, Kicker, Slide, Split, Title } from './primitives'
import { Feature, type SlideFn } from './parts'
import { MeshDiagram } from './MeshDiagram'

export const slides3: SlideFn[] = [
  // Admin
  () => (
    <Feature bg="bg-sky" kicker="Admin command centre" title="The whole city, one inbox." src="/admin/dashboard" url="civicpulse.app/admin/dashboard"
      chips={<><Chip tone="sun">Live map</Chip><Chip tone="blush">KPIs</Chip><Chip tone="ink">AI reasoning trace</Chip></>} />
  ),
  // Admin map
  () => (
    <Feature bg="bg-olive" kicker="Admin · City map" title="Every report, on one map." src="/deck/preview/map" url="civicpulse.app/admin/dashboard"
      chips={<><Chip tone="sun">Duplicate clusters</Chip><Chip tone="blush">Colour by category</Chip><Chip tone="sky">Severity pins</Chip></>} />
  ),
  // TSP
  () => (
    <Feature bg="bg-sun" kicker="Route planner · TSP" title="Fix 10 issues, drive the least." src="/deck/preview/route" url="civicpulse.app/admin/dashboard"
      chips={<><Chip tone="ink">Waypoint optimisation</Chip><Chip>Google Routes API</Chip><Chip tone="blush">Live traffic</Chip></>} />
  ),
  // Municipality
  () => (
    <Feature kicker="Municipality workspace" title="Close the loop." src="/municipality/dashboard" url="civicpulse.app/municipality"
      chips={<><Chip tone="olive">Dept. scoped</Chip><Chip tone="sun">Proof of work</Chip><Chip tone="sky">AI-assessed evidence</Chip></>} />
  ),
  // Evidence
  () => (
    <Slide bg="bg-blush">
      <Kicker>Resolution integrity</Kicker>
      <Title className="mt-4">“Fixed” has to be proven.</Title>
      <div className="mt-12 grid grid-cols-4 gap-6">
        {[
          ['1', 'Crew submits proof', 'sun', 'Photos taken on site, stamped with GPS and time.'],
          ['2', 'AI assesses evidence', 'sky', 'Gemini compares before and after and scores the fix.'],
          ['3', 'Residents review', 'olive', 'Nearby citizens confirm it is really fixed, or dispute it.'],
          ['4', 'Admin adjudicates', 'cream', 'Admin makes the final call on any disputed fix.'],
        ].map(([n, t, tone, d]) => (
          <Block key={n} tone={tone as 'sun'} className="flex h-[540px] flex-col">
            <p className="font-mono text-2xl font-bold text-ink/60">0{n}</p>
            <p className="mt-6 font-heading text-5xl font-semibold leading-tight">{t}</p>
            <p className="mt-auto text-3xl font-medium leading-snug text-ink/75">{d}</p>
          </Block>
        ))}
      </div>
      <div className="mt-10 flex gap-4"><Chip tone="ink">Geo + time checks</Chip><Chip>Disputes reopen the issue</Chip></div>
    </Slide>
  ),
  // Mesh
  () => (
    <Slide bg="bg-olive">
      <Kicker>Neighbourhood emergency network</Kicker>
      <Title className="mt-4 !text-[76px]">No internet. Still connected.</Title>
      <p className="mt-4 text-2xl text-ink/75">An SOS moves through people’s phones — not through a server.</p>
      <div className="mt-5 flex items-center gap-8">
        <MeshDiagram />
        <div className="w-[340px] shrink-0 border-l-2 border-ink/20 pl-8">
          <p className="font-mono text-sm font-bold uppercase tracking-[0.2em] text-ink/60">Inside every hop</p>
          <div className="mt-7 space-y-7">
            {[
              ['01', 'Discover nearby', 'Google Nearby Connections with a P2P_CLUSTER topology.'],
              ['02', 'Store. Carry. Forward.', 'SQLite keeps the outbox ready for the next peer connection.'],
              ['03', 'Keep it bounded', 'Stable IDs filter duplicates. Hop limits and expiry stop endless relays.'],
            ].map(([n, title, description]) => (
              <div key={n}>
                <p className="font-heading text-[26px] font-semibold"><span className="mr-3 font-mono text-sm text-ink/50">{n}</span>{title}</p>
                <p className="mt-2 text-xl leading-snug text-ink/75">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between border-t-2 border-ink/20 pt-5">
        <div className="flex gap-3"><Chip tone="ink">No internet needed</Chip><Chip>Android · Expo / React Native</Chip></div>
        <p className="font-mono text-sm text-ink/70">Illustrative topology · Validated in simulation, not a field test</p>
      </div>
    </Slide>
  ),
  // Mobile SOS
  () => (
    <Slide bg="bg-blush">
      <div className="flex h-full items-center gap-12">
        <div className="flex w-[480px] shrink-0 flex-col gap-7">
          <Kicker>Mobile app · Offline alerts</Kicker>
          <Title className="!text-[72px]">SOS, one tap from home.</Title>
          <p className="text-2xl leading-snug text-ink/75">Turn the relay on and send an SOS or hazard alert. It is saved on the phone and passed to nearby phones, with no server needed.</p>
          <div className="flex flex-wrap gap-3"><Chip tone="ink">Relay on / off</Chip><Chip tone="sun">SOS + Hazard</Chip><Chip>Community, unverified</Chip></div>
        </div>
        <div className="flex min-w-0 flex-1 items-start justify-between gap-6">
          {[
            ['01 · Home', 'Quick access', '/deck/mobile/01-home.jpeg', 600],
            ['02 · You', 'Community menu', '/deck/mobile/02-you.jpeg', 602],
            ['03 · Offline alerts', 'Relay, SOS, Hazard', '/deck/mobile/03-offline-alerts.jpeg', 648],
          ].map(([label, caption, src, w]) => (
            <div key={src as string} className="flex flex-col items-center gap-4">
              <div className="overflow-hidden rounded-[2.5rem] border-[3px] border-ink bg-white shadow-[10px_10px_0_0_#17140f]">
                <Image src={src as string} alt={`CivicPulse mobile app: ${caption}`} width={w as number} height={1280} unoptimized className="block h-[640px] w-auto" />
              </div>
              <p className="font-mono text-base font-bold uppercase tracking-[0.15em] text-ink/70">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </Slide>
  ),
  // Receipt
  (c) => (
    <Slide bg="bg-sun">
      <Split leftW="w-[420px]"
        left={<><Kicker>Impact receipt</Kicker><Title>Share the win.</Title><div className="flex flex-wrap gap-3"><Chip tone="ink">next/og</Chip><Chip>Auto-generated</Chip></div></>}
        right={c.receiptId
          ? <div className="flex h-full items-center">
              <Browser url="civicpulse.app/receipt" className="w-full">
                <Image src={`/receipt/${c.receiptId}`} alt="CivicPulse impact receipt showing a resolved report and its estimated community impact" width={1200} height={630} unoptimized className="block h-auto w-full object-contain" />
              </Browser>
            </div>
          : <Block tone="cream" className="flex h-full items-center justify-center"><p className="font-heading text-6xl font-semibold">Resolve an issue to see its receipt</p></Block>} />
    </Slide>
  ),
]
