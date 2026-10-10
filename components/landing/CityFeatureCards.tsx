import { Camera, Check, MapPin, ShieldCheck, Sparkles, Users } from 'lucide-react'

function RoadPreview({ repaired }: { repaired: boolean }) {
  return (
    <svg viewBox="0 0 100 64" className="h-16 w-full" aria-hidden="true">
      <path d="M0 0H100V64H0Z" fill="#d8d0b8" />
      <path d="M26 0H74L96 64H4Z" fill="#6b6554" />
      <path d="M50 0V64" stroke="#f5f0e1" strokeWidth="2" strokeDasharray="8 7" />
      {repaired ? (
        <path d="M28 33L62 30L74 52L22 54Z" fill="#403c32" />
      ) : (
        <>
          <path d="M27 34L39 29L60 32L69 43L61 52L35 54L22 45Z" fill="#17140f" />
          <path d="M30 39L44 35L58 39L60 46L37 48Z" fill="#b4c3ec" />
        </>
      )}
    </svg>
  )
}

const FEATURES = [
  { title: 'Hotspot map', description: 'See where reports cluster, before small issues grow.', color: 'bg-sky', icon: MapPin },
  { title: 'Resident review', description: 'Neighbours confirm the fix. Not just a status update.', color: 'bg-olive', icon: Users },
  { title: 'Proof of work', description: 'Before-and-after evidence makes every repair accountable.', color: 'bg-sun', icon: ShieldCheck },
  { title: 'AI briefs', description: 'The right team gets a clear action plan and a deadline.', color: 'bg-blush', icon: Sparkles },
]

export default function CityFeatureCards() {
  return (
    <div>
      <div className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
        {FEATURES.map(({ title, description, color, icon: Icon }, index) => (
          <article key={title} className={`flex min-w-0 flex-col rounded-3xl p-4 text-ink ${color}`}>
            <div className="mb-4 flex items-center justify-between">
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="font-mono text-[10px] font-semibold tracking-wider text-black/55">0{index + 1}</span>
            </div>

            {index === 0 && (
              <div className="relative h-28 overflow-hidden rounded-xl border border-black/10 bg-cream/50" aria-hidden="true">
                <svg viewBox="0 0 200 112" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
                  <path d="M0 24H200M0 78H200M42 0V112M145 0V112M-10 110L210 0" stroke="#fbf8ef" strokeWidth="9" />
                  <path d="M170 -10Q110 40 175 65T170 125" fill="none" stroke="#8c9fdb" strokeWidth="13" />
                  <circle cx="69" cy="49" r="29" fill="#e898c6" opacity=".35" />
                  <circle cx="69" cy="49" r="18" fill="#e898c6" opacity=".5" />
                  <circle cx="69" cy="49" r="6" fill="#17140f" />
                  <circle cx="121" cy="83" r="18" fill="#e6bd35" opacity=".5" />
                  <circle cx="121" cy="83" r="5" fill="#17140f" />
                  <circle cx="32" cy="89" r="4" fill="#7f9145" />
                </svg>
                <span className="absolute right-2 top-2 rounded-full bg-cream px-2 py-1 text-[9px] font-bold">Priority zones</span>
              </div>
            )}

            {index === 1 && (
              <div className="flex h-28 flex-col justify-between rounded-xl border border-black/10 bg-cream/65 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex -space-x-2" aria-hidden="true">
                    {['bg-blush', 'bg-sky', 'bg-sun'].map((color, i) => (
                      <span key={color} className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-cream text-[10px] font-bold ${color}`}>
                        {['AS', 'PK', 'RM'][i]}
                      </span>
                    ))}
                  </div>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-cream"><Check className="h-3.5 w-3.5" aria-hidden="true" /></span>
                </div>
                <p className="text-[11px] font-semibold">“Streetlight is working again.”</p>
                <p className="text-[10px] text-black/65">3 neighbours confirmed</p>
              </div>
            )}

            {index === 2 && (
              <div className="h-28 rounded-xl border border-black/10 bg-cream/60 p-2">
                <div className="grid grid-cols-2 gap-2">
                  {[false, true].map((repaired) => (
                    <div key={String(repaired)} className="overflow-hidden rounded-lg bg-cream">
                      <RoadPreview repaired={repaired} />
                      <p className="py-1 text-center text-[9px] font-bold uppercase tracking-wide">{repaired ? 'After' : 'Before'}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-1 flex items-center justify-center gap-1 text-[9px] font-medium"><Camera className="h-3 w-3" aria-hidden="true" /> Repair evidence</p>
              </div>
            )}

            {index === 3 && (
              <div className="flex h-28 flex-col justify-between rounded-xl border border-black/10 bg-cream/70 p-3">
                <div className="flex items-center justify-between gap-1 text-[9px] font-bold uppercase tracking-wide">
                  <span>Action brief</span>
                  <span className="rounded-full bg-blush px-2 py-0.5">High priority</span>
                </div>
                <p className="text-[11px] font-semibold leading-snug">Repair damaged road surface near the crossing.</p>
                <div className="flex justify-between gap-2 border-t border-black/10 pt-1.5 text-[9px] font-medium">
                  <span>Roads dept.</span><span>Due in 48h</span>
                </div>
              </div>
            )}

            <h3 className="mt-4 font-heading text-lg font-semibold leading-tight">{title}</h3>
            <p className="mt-2 text-xs leading-relaxed text-black/70">{description}</p>
          </article>
        ))}
      </div>
      <p className="mt-3 text-center text-[10px] text-cream/60">Illustrative previews · not live reports</p>
    </div>
  )
}