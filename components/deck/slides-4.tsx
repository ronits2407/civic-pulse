import { Block, Chip, Kicker, Slide, Title } from './primitives'
import type { SlideFn } from './parts'

const Stack = ({ tone, title, items }: { tone: 'sun' | 'blush' | 'olive' | 'sky' | 'cream'; title: string; items: string }) => (
  <Block tone={tone} className="flex flex-col gap-3 !p-6">
    <p className="font-heading text-4xl font-semibold">{title}</p>
    <p className="text-2xl leading-snug text-ink/80">{items}</p>
  </Block>
)

export const slides4: SlideFn[] = [
  // Stack
  () => (
    <Slide>
      <Kicker>Under the hood</Kicker>
      <Title className="mt-3 !text-[72px]">Built on Google, powered by Cline.</Title>
      <div className="mt-8 grid grid-cols-3 gap-5">
        <Stack tone="sun" title="Google" items="Gemini 2.5 Flash + Pro · Embeddings · Maps Geocoding · Routes API · Cloud Run · Artifact Registry · Google OAuth" />
        <Stack tone="blush" title="AI orchestration" items="Cline SDK · LangGraph · LangChain · @google/genai · Ollama (OpenAI client)" />
        <Stack tone="olive" title="Data" items="Supabase · Postgres · PostGIS · pgvector · Realtime · Auth · Storage" />
        <Stack tone="sky" title="Web" items="Next.js 16 · React 19 · TypeScript · Tailwind · shadcn/ui · Framer Motion · PWA · Web Push" />
        <Stack tone="cream" title="Maps" items="Leaflet · react-leaflet · Mapbox GL · @mapbox/polyline · ml-kmeans clustering" />
        <Stack tone="sun" title="Mobile + tooling" items="Expo · React Native · expo-nearby-connections · SQLite · Bun · Docker" />
      </div>
    </Slide>
  ),
  // Closing
  () => (
    <Slide bg="bg-ink">
      <div className="absolute -right-20 -top-20 h-[460px] w-[460px] rotate-12 rounded-[5rem] bg-sun" />
      <div className="absolute bottom-10 right-72 h-72 w-72 rounded-full bg-blush" />
      <div className="absolute bottom-24 right-10 h-52 w-52 -rotate-12 rounded-[3rem] bg-sky" />
      <div className="relative flex h-full flex-col justify-center gap-8">
        <h2 className="font-heading text-[170px] font-semibold leading-[0.85] tracking-tighter text-cream">Thank you<span className="text-blush-deep">.</span></h2>
        <p className="text-5xl text-cream/80">civicpulse — a city that answers back.</p>
        <div className="flex gap-4"><Chip tone="sun">Cline SDK</Chip><Chip>Gemini</Chip><Chip>Google Cloud</Chip></div>
      </div>
    </Slide>
  ),
]
