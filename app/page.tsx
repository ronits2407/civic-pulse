import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/db/server'
import HeroThreads from '@/components/landing/HeroThreads'
import CityFeatureCards from '@/components/landing/CityFeatureCards'
import { ArrowUpRight, Camera, GitMerge, ShieldCheck, Sparkles } from 'lucide-react'

const AGENTS = [
  { n: '01', name: 'Classifier', body: 'Reads your photo and words, tags the category and scores severity 1–10.', bg: 'bg-sun', icon: Camera },
  { n: '02', name: 'Deduplicator', body: 'Matches your report against neighbours within 200 m so one pothole is one case.', bg: 'bg-blush', icon: GitMerge },
  { n: '03', name: 'Validator', body: 'Cross-checks weather and context, then asks nearby residents when unsure.', bg: 'bg-olive', icon: ShieldCheck },
  { n: '04', name: 'Resolver', body: 'Writes the civic brief, routes to the right department and sets the SLA clock.', bg: 'bg-sky', icon: Sparkles },
]

const STEPS = [
  { t: 'Snap it', d: 'Photo, voice or text, in any language.' },
  { t: 'AI triages', d: 'Four agents classify, dedupe, validate and route.' },
  { t: 'City acts', d: 'The right department gets a brief with a deadline.' },
  { t: 'Neighbours verify', d: 'Residents confirm the fix before it closes.' },
]

const TICKER = ['Potholes', 'Streetlights', 'Garbage', 'Water leaks', 'Open drains', 'Fallen trees', 'Broken signals', 'Illegal dumping']

export default async function HomePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Nav */}
      <header className="sticky top-0 z-40 px-4 pt-4">
        <nav className="mx-auto flex max-w-6xl items-center justify-between rounded-full border border-black/10 bg-[#fbf8ef]/80 px-3 py-2 pl-5 backdrop-blur-xl">
          <Link href="/" className="font-heading text-xl font-semibold tracking-tight">
            civicpulse<span className="text-[#e898c6]">.</span>
          </Link>
          <div className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
            <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#agents" className="hover:text-foreground transition-colors">The agents</a>
            <a href="#cities" className="hover:text-foreground transition-colors">For cities</a>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/auth/login?role=admin" className="hidden rounded-full px-4 py-2 text-sm font-semibold hover:bg-black/5 transition-colors sm:inline-block">
              Municipal
            </Link>
            <Link href="/auth/login?role=citizen" className="inline-flex items-center gap-1.5 rounded-full bg-[#17140f] px-5 py-2 text-sm font-semibold text-[#f5f0e1] hover:bg-black transition-colors">
              Citizen login <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative isolate mx-auto max-w-6xl px-4 pb-10 pt-16 sm:pt-24">
        <HeroThreads />
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-[#fbf8ef] px-3.5 py-1.5 text-xs font-semibold">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-olive-deep opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-olive-deep" />
            </span>
            Live in Nashik · 5 AI agents on duty
          </span>
          <h1 className="mt-6 font-heading text-5xl font-semibold leading-[1.02] tracking-tight sm:text-7xl">
            Fix your city,<br />one report at a time.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Report a problem in seconds. Our AI agents classify it, merge duplicates, verify it and route it to the right department, then your neighbours confirm it&apos;s actually fixed.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/auth/login?role=citizen" className="inline-flex h-12 items-center gap-2 rounded-full bg-[#17140f] px-7 text-sm font-semibold text-[#f5f0e1] transition-all hover:-translate-y-0.5 hover:bg-black">
              Report as a citizen <ArrowUpRight className="h-4 w-4" />
            </Link>
            <Link href="/auth/login?role=admin" className="inline-flex h-12 items-center gap-2 rounded-full border border-black/20 px-7 text-sm font-semibold transition-all hover:-translate-y-0.5 hover:bg-black/5">
              I&apos;m from the municipality
            </Link>
          </div>
        </div>

        {/* Product collage */}
        <div className="relative mx-auto mt-16 max-w-5xl rounded-[2rem] border border-black/10 bg-[#fbf8ef] p-3 shadow-[0_40px_80px_-30px_rgba(23,20,15,0.3)]">
          <div className="grid gap-3 rounded-[1.5rem] bg-background p-3 md:grid-cols-5 md:grid-rows-2">
            <div className="relative overflow-hidden rounded-3xl bg-sun p-6 md:col-span-2 md:row-span-2">
              <div className="absolute -right-6 -top-6 h-28 w-28 rotate-12 rounded-3xl bg-sun-deep/70" />
              <p className="relative text-xs font-bold uppercase tracking-wider">Reports this month</p>
              <p className="relative mt-2 font-heading text-6xl font-semibold tracking-tight">1,284</p>
              <div className="relative mt-8 flex h-24 items-end gap-1.5">
                {[40, 62, 35, 80, 55, 92, 48, 70, 60, 85].map((h, i) => (
                  <div key={i} className="flex-1 rounded-full bg-[#17140f]" style={{ height: `${h}%`, opacity: i === 5 ? 1 : 0.85 }} />
                ))}
              </div>
            </div>
            <div className="relative overflow-hidden rounded-3xl bg-blush p-6 md:col-span-3">
              <div className="absolute -right-4 top-2 h-20 w-20 rounded-full bg-blush-deep/60" />
              <p className="relative text-xs font-bold uppercase tracking-wider">Median time to resolve</p>
              <div className="relative mt-2 flex items-end gap-6">
                <p className="font-heading text-5xl font-semibold tracking-tight">3.2 days</p>
                <svg viewBox="0 0 200 50" className="h-12 flex-1" fill="none" stroke="#17140f" strokeWidth="2" strokeLinecap="round">
                  <path d="M0 40 C20 10 35 45 55 25 S90 5 110 28 S150 42 170 15 S190 20 200 8" />
                </svg>
              </div>
            </div>
            <div className="rounded-3xl bg-olive p-6 md:col-span-1">
              <p className="text-xs font-bold uppercase tracking-wider">Verified</p>
              <p className="mt-2 font-heading text-4xl font-semibold tracking-tight">92%</p>
              <p className="mt-1 text-xs font-medium text-black/60">by residents</p>
            </div>
            <div className="rounded-3xl bg-sky p-6 md:col-span-2">
              <p className="text-xs font-bold uppercase tracking-wider">Departments</p>
              <p className="mt-2 font-heading text-4xl font-semibold tracking-tight">12 routed</p>
              <p className="mt-1 text-xs font-medium text-black/60">automatically, with SLA</p>
            </div>
          </div>
        </div>
        <p className="mt-3 text-center text-[11px] text-muted-foreground">Illustrative figures shown for demonstration.</p>
      </section>

      {/* Ticker */}
      <div className="border-y border-black/10 bg-[#17140f] py-4 text-[#f5f0e1]">
        <div className="flex w-[200%] animate-marquee gap-10 whitespace-nowrap">
          {[...TICKER, ...TICKER, ...TICKER, ...TICKER].map((t, i) => (
            <span key={i} className="flex items-center gap-10 font-heading text-lg font-medium">
              {t} <span className="text-[#f2b5d9]">✺</span>
            </span>
          ))}
        </div>
      </div>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-4 py-24">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">How it works</p>
        <h2 className="mt-3 max-w-2xl font-heading text-4xl font-semibold tracking-tight sm:text-5xl">From a blurry photo to a closed case.</h2>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <div key={s.t} className="group rounded-3xl border border-black/10 bg-[#fbf8ef] p-6 transition-all hover:-translate-y-1 hover:shadow-[0_20px_40px_-20px_rgba(23,20,15,0.25)]">
              <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
              <h3 className="mt-10 font-heading text-2xl font-semibold tracking-tight">{s.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Agents */}
      <section id="agents" className="mx-auto max-w-6xl px-4 pb-24">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">The agents</p>
        <h2 className="mt-3 max-w-2xl font-heading text-4xl font-semibold tracking-tight sm:text-5xl">Four agents on every report. A fifth watching the map.</h2>
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {AGENTS.map(({ n, name, body, bg, icon: Icon }) => (
            <div key={n} className={`relative overflow-hidden rounded-[2rem] p-8 transition-transform hover:-translate-y-1 ${bg}`}>
              <div className="absolute -right-8 -top-8 h-32 w-32 rotate-12 rounded-[2rem] bg-black/[0.07]" />
              <div className="relative flex items-center justify-between">
                <span className="font-mono text-xs font-semibold">AGENT {n}</span>
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#17140f] text-[#f5f0e1]"><Icon className="h-5 w-5" /></span>
              </div>
              <h3 className="relative mt-12 font-heading text-3xl font-semibold tracking-tight">{name}</h3>
              <p className="relative mt-2 max-w-sm text-sm font-medium leading-relaxed text-black/70">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* For cities */}
      <section id="cities" className="mx-auto max-w-6xl px-4 pb-24">
        <div className="grid items-center gap-10 rounded-[2.5rem] bg-[#17140f] p-8 text-[#f5f0e1] sm:p-14 md:grid-cols-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#f2b5d9]">For municipalities</p>
            <h2 className="mt-3 font-heading text-4xl font-semibold tracking-tight sm:text-5xl">An inbox that triages itself.</h2>
            <p className="mt-4 max-w-md text-[#f5f0e1]/70">Severity-ranked reports, SLA clocks, department routing and predictive hotspots. Closure needs photo proof and resident confirmation.</p>
            <Link href="/auth/login?role=admin" className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-[#f2b5d9] px-7 text-sm font-semibold text-[#17140f] transition-all hover:-translate-y-0.5 hover:bg-[#f7c6e3]">
              Open the municipal portal <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
          <CityFeatureCards />
        </div>
      </section>

      <footer className="border-t border-black/10 py-8 text-center text-xs text-muted-foreground">
        <span className="font-heading text-base font-semibold text-foreground">civicpulse<span className="text-[#e898c6]">.</span></span>
        <p className="mt-1">Report problems. Track resolutions. Build a better city.</p>
      </footer>
    </div>
  )
}
