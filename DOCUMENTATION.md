# CivicPulse — Project Documentation

> Detailed reference for the CivicPulse codebase: what the project is, how it works, and what every file/directory contains.
> Generated from the repository state on 2026-10-10 (branch `main`, latest commit `1866e00`).

---

## 1. What This Project Is

**CivicPulse** is a full-stack, AI-powered civic issue reporting platform built for Indian cities (primarily **Nashik**), created as a hackathon submission for “Problem Statement 2: Community Hero (Hyperlocal Problem Solver).”

Citizens report infrastructure, sanitation, safety, utility, and environmental problems via **text, photo, video, or voice**. A **6-agent LangGraph pipeline** powered by **Google Gemini 2.5 Flash / Pro** then automatically:

1. **Translates** the report (any typed language → English) — Agent 0
2. **Classifies** it (category, subcategory, severity 1–10, emergency flag) — Agent 1
3. **Deduplicates** it against nearby reports (PostGIS proximity + AI semantic judge) — Agent 2
4. **Validates** credibility (live weather, web search, image evidence → score 1–10) — Agent 3
5. **Generates a resolution brief + SLA deadline** using a RAG knowledge base of municipal SOPs — Agent 4
6. **Predicts future hotspots** from historical clusters (admin-triggered, Gemini Pro) — Agent 5

Around the pipeline sit a **citizen dashboard** (realtime issue tracking, community verification queue, karma leaderboard), an **admin/municipal dashboard** (civic inbox, SLA tracker, city map, TSP-optimized field-team route planner, predictive hotspot panel), **community quorum voting**, **karma gamification**, and a shareable **OG “Impact Receipt”** image route.

It deploys to **Google Cloud Run (asia-south1)** via a GitHub Actions CI/CD pipeline with Workload Identity Federation (zero stored GCP credentials).

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Framework | **Next.js 16.2.9** (App Router, TypeScript, Turbopack, `output: 'standalone'`) |
| Package manager | **Bun** (`bun.lock`; use `bun add` / `bun run` / `bunx`) |
| UI | **Tailwind CSS v4** + **shadcn/ui** (Radix) + **Framer Motion** + Lucide/Hugeicons + `sonner` toasts |
| PWA | **next-pwa** (service worker at `public/sw.js`, disabled in dev) |
| AI models | **Google Gemini 2.5 Flash** (agents 0–4), **Gemini 2.5 Pro** (Agent 5), `gemini-embedding-001` (768-dim); optional **Ollama** (Qwen3 models) via `AI_PROVIDER=ollama` |
| AI SDKs | `@google/genai`, `openai` (Ollama-compatible), `@langchain/langgraph`, `@langchain/core`, `@langchain/google-genai`, `@langchain/openai`, `@langchain/community` |
| Database | **Supabase** (Postgres + **PostGIS** + **pgvector** + Realtime + Auth + Storage) |
| Maps | **Leaflet + react-leaflet + OpenStreetMap** for actual UI rendering; Mapbox GL installed/token present; **Google Maps Geocoding API** and **Google Maps Routes API** server-side |
| Auth | Supabase Auth — **Google OAuth** + **email magic link/OTP** (role=citizen/admin) |
| Deployment | Docker (`node:20-alpine` multi-stage) → Artifact Registry → **Cloud Run** |
| CI/CD | GitHub Actions (`.github/workflows/deploy-prod.yml`, triggered on push to `prod` branch) |
| Testing | Standalone scripts under `tests/` (no test framework configured) |
| Seeding | `@faker-js/faker` + CSV fixtures under `scripts/` |

---

## 3. How a Report Flows Through the System

```
Citizen (/report)
  │  text + optional image/video (uploaded to Supabase Storage bucket `issue-media`)
  │  + location (GPS or Leaflet map picker) + optional voice (Web Speech API)
  ▼
POST /api/reports/process
  │  1. generateEmbedding(text) → insert row into `issues` (status=open,
  │     pipeline_stage='agent0_translation', location=PostGIS POINT)
  │  2. award +10 karma (`karma_events`)
  │  3. return { issueId } immediately; run pipeline in background via next `after()`
  ▼
LangGraph StateGraph (lib/agents/pipeline.ts, MemorySaver thread_id=issueId)
  router → translate → classify → deduplicate → validate → [community_review_wait*] → resolve → save → END
  (* interruptBefore: pauses if credibility < 6 → status='community_review')
  
  Each agent writes its result + advances `issues.pipeline_stage`
  (e.g. agent1_classifier → agent2_deduplication → … → completed, or *_failed)
  ▼
Community review (if triggered)
  │  GET /api/reviews → nearby citizens (≤1 km from home) see the issue
  │  POST /api/reviews/[issueId]/vote → quorum of 3 votes
  │     confirmed → status=open, resume pipeline (/api/reports/resume → Agent 4)
  │     rejected  → status=closed, reporter −5 karma
  ▼
Admin (/admin/dashboard)
  │  triage inbox, comments, status changes (+50 karma on resolve), retry failed pipelines,
  │  city map, route planner (cluster → Google Routes `optimizeWaypointOrder`),
  │  Agent 5 predictive runs (cluster → analyze → `predictive_alerts`)
  ▼
Citizen dashboard realtime (Supabase postgres_changes on `issues`)
  + shareable Impact Receipt at /receipt/[issue_id] (edge OG image)
```

**Failure/recovery paths:**

- `POST /api/reports/retry` — reconstructs `AgentState` from the DB row and re-runs the pipeline starting at the node corresponding to the `*_failed` stage.
- `POST /api/reports/resume` — resumes an interrupted LangGraph thread (community review passed); falls back to `/api/reports/retry` if the in-memory checkpointer lost state (e.g., server restart).

---

## 4. Repository Conventions & Gotchas (read first)

- **Path alias**: `@/*` → repo root (see `tsconfig.json`).
- **No `middleware.ts`** — this Next.js version uses **`proxy.ts`** exporting `proxy()` with a `config.matcher`; it guards `/dashboard`, `/report`, `/admin` (and role-checks `/admin`).
- **No `src/` directory** — flat structure, `app/` at repo root.
- **Always use Bun**, never npm/yarn.
- There are **two auth-actions files**: `lib/auth/actions.ts` (canonical, role-aware, used by the login page) and `app/auth/actions.ts` (older duplicate without the `role` param).
- **Agent 2 deliberately sleeps up to 15 seconds** to satisfy a “15-second visual requirement” (demo timing) — expect slow dedup responses.
- The pipeline checkpointer is a **`MemorySaver`** (hackathon note in code: production should use `PostgresSaver`); resume after restart relies on the retry fallback.
- `.env.example` notes the UI actually renders maps with **Leaflet + OSM**, so a placeholder Mapbox token is fine locally.
- `AGENTS.md` in the repo root contains **stale status notes** (e.g., says Agent 5 / admin dashboard are unbuilt — both now exist). Prefer this document.

---

## 5. File Structure (annotated)

```
civic-pulse/
├── app/                          # Next.js App Router (pages + API routes)
│   ├── layout.tsx                # Root layout: Inter font, dark theme, sonner Toaster
│   ├── page.tsx                  # Landing page → redirects authed users to /dashboard; Citizen vs Municipal CTA
│   ├── globals.css               # Tailwind v4 theme (shadcn Mira/Slate tokens)
│   ├── icon.tsx                  # Dynamic 32×32 favicon (edge, next/og ImageResponse)
│   ├── dashboard/page.tsx        # Citizen dashboard (server component; admins redirect to /admin/dashboard)
│   ├── report/page.tsx           # Report submission flow (client, ~562 lines: text/image/video/webcam/voice/GPS/map)
│   ├── admin/dashboard/page.tsx  # Admin dashboard (server guard: role must be 'admin')
│   ├── receipt/[issue_id]/route.tsx  # OG “Impact Receipt” share card (edge runtime, 1200×630)
│   ├── auth/
│   │   ├── login/page.tsx        # Login UI: Google OAuth + email OTP, role=citizen/admin
│   │   ├── callback/route.ts     # OAuth/OTP code exchange; sets role=admin when requested; redirects
│   │   └── actions.ts            # ⚠ older duplicate of lib/auth/actions.ts (no role support)
│   └── api/                      # Route handlers (see §6 for details)
│       ├── reports/process|resume|retry/   # Pipeline entry / interrupt resume / failure retry
│       ├── geocode/              # Google Maps reverse geocoding → city, state address
│       ├── issues/map/           # 500 most recent non-closed issues w/ decoded PostGIS locations
│       ├── leaderboard/          # Top-10 karma citizens + current user rank
│       ├── profile/home-location/# Save home POINT for proximity review matching
│       ├── reviews/              # Nearby community-review queue (1 km) + [issueId]/vote (quorum)
│       ├── admin/
│       │   ├── clusters/         # Geographic clustering of open issues (route planner)
│       │   ├── issues/[issueId]/ # PATCH status/department (+50 karma) ; comments GET/POST
│       │   ├── predictive/       # Agent 5: cluster / analyze / run endpoints (admin-only)
│       │   └── routes/optimize/  # Google Routes API TSP waypoint optimization
│       └── test/route.ts         # Env-var health check (set/missing for key vars)
│
├── components/
│   ├── ui/                       # shadcn primitives: avatar, badge, button, card, dialog, input, textarea, sonner
│   ├── dashboard/
│   │   ├── DashboardClient.tsx   # Citizen dashboard main client (~1681 lines): issue list/status cards,
│   │   │                         #   realtime Supabase channel, community review voting, home-location setup,
│   │   │                         #   retry, embeds map + leaderboard panels
│   │   ├── IssueMapPanel|Inner|  # City-wide Leaflet map panel (fetches /api/issues/map)
│   │   │   Agent2MapInner|Visuals# Map visualizations of dedup clusters / pipeline stages
│   │   ├── MiniMapWidget.tsx     # Compact map widget with refresh
│   │   └── CitizenLeaderboardPanel.tsx # Karma leaderboard (calls /api/leaderboard)
│   ├── admin/
│   │   ├── AdminDashboardClient.tsx    # Municipal console (~1627 lines): civic inbox, issue detail + AI
│   │   │                         #   reasoning trace, comments, status/SLA triage, retry, realtime, panels
│   │   ├── RoutePlannerPanel|MapInner  # Cluster issues → optimize field-team route (Google Routes)
│   │   └── Agent5PredictivePanel|MapInner # Trigger Agent 5, show predicted hotspot alerts on map
│   └── report/
│       ├── LocationPickerPanel|Inner    # Leaflet map modal for pinning report location (+ reverse geocode)
│       └── WebcamModal.tsx       # In-browser webcam capture (image + video modes)
│
├── lib/
│   ├── agents/                   # LangGraph pipeline (see §7)
│   │   ├── pipeline.ts           # StateGraph wiring, conditional edges, MemorySaver, saveToDatabase
│   │   ├── agent0-translation.ts # Language detect + translate to English
│   │   ├── agent1-classifier.ts  # Category/severity/emergency + image analysis + department match
│   │   ├── agent2-deduplication.ts # 200 m PostGIS proximity + LLM semantic judge; cluster merge
│   │   ├── agent3-validation.ts  # ReAct agent: Open-Meteo weather + DuckDuckGo search → credibility
│   │   ├── agent4-resolution.ts  # RAG over SOPs → civic brief + SLA hours/deadline
│   │   └── agent5-predictive.ts  # DBSCAN-style clustering + Gemini Pro → predictive_alerts
│   ├── ai/client.ts              # Unified AI client (Gemini/Ollama): generateStructuredJSON,
│   │                             #   generateText, generateEmbedding, analyzeImage, getChatModel
│   ├── db/
│   │   ├── client.ts             # Browser Supabase client (@supabase/ssr createBrowserClient)
│   │   ├── server.ts             # Server client (cookies) + service-role client (bypasses RLS)
│   │   └── types.ts              # All TS types: Issue, Profile, AgentState, ClassificationResult, etc.
│   ├── auth/actions.ts           # Server actions: signInWithGoogle, signInWithEmail, signOut, getUser, getUserProfile
│   ├── utils.ts                  # cn() class merger (clsx + tailwind-merge)
│   └── utils/clustering.ts       # Geographic (Haversine) greedy clustering — replaces K-Means,
│                                 #   exports getOptimalClusters(data) with old API compatibility
│
├── data/
│   ├── KNOWLEDGE_BASE.md         # Docs for the RAG SOP knowledge base (sops table, match_sops RPC)
│   └── civic_sops.json           # 7 municipal SOPs (infrastructure/sanitation/safety/utility/environment)
│                                 #   with concrete SLA rules — source data for Agent 4 RAG
│
├── scripts/                      # One-off DB/seed utilities (run with bun/tsx; read .env.local)
│   ├── seed-india.ts             # Large multi-city synthetic issue generator (~710 lines, city clusters)
│   ├── seed-nashik-issues.ts     # Nashik-specific issues   seed-ronit-issues.ts # Developer demo issues
│   ├── seed-departments.ts       # Civic departments w/ category_scope   seed-db.ts # General CSV seed
│   ├── seed-knowledge-base.ts    # Embeds data/civic_sops.json into `sops` table (768-dim vectors)
│   ├── generate-data.ts          # Faker.js → issues.csv / karma_events.csv / profiles.csv / verifications.csv
│   ├── reset-db.ts | delete-all-users.ts  # Destructive cleanup utilities
│   ├── migrate-categories.ts     # Normalize legacy category values
│   ├── fetch-issues.ts           # Dump issues via service client
│   ├── seed.sql | apply_trigger.js | patch-admin.js | patch-agent1.js  # SQL/JS DB patches
│   ├── manage-gcloud.ps1         # Windows helper for gcloud ops
│   └── *.csv                     # Generated seed fixtures
│
├── tests/                        # Manual integration scripts (not a formal test suite)
│   ├── test-agent1..4.ts         # Invoke individual agents with a fixture AgentState
│   ├── retry-test.ts | vote-test.ts       # Exercise retry endpoint / quorum voting
│   ├── test_db.ts | test-update.ts        # DB connectivity/update checks
│   ├── test-location.mjs|test-location2.mjs # PostGIS location format probes
│   ├── test-vision.ts | test-ollama-vision.ts # Image analysis (Gemini / Ollama) checks
│
├── supabase/
│   ├── migrations/20260625082016_init_schema.sql  # Base schema (tables, indexes, RLS, signup trigger)
│   ├── config.toml               # Supabase CLI config
│   └── schema.json               # Schema snapshot (v14.5)
├── migrations/add_image_analysis.sql   # ALTER issues ADD image_analysis text
│
├── public/                       # Static assets: sw.js (PWA), icons, svgs
├── .github/workflows/deploy-prod.yml   # Cloud Run CI/CD (push to `prod`)
├── proxy.ts                      # Next.js request proxy/middleware (auth guard + admin role check)
├── middleware (legacy concept)   # — actual file is proxy.ts in this Next version
├── Dockerfile                    # 3-stage: bun install → bun build (NEXT_PUBLIC args) → node runner
├── docker-compose.yml            # Local container run; wires Ollama via host.docker.internal
├── next.config.ts                # output:'standalone', next-pwa wrapper, turbopack flag
├── eslint.config.mjs | tsconfig.json | postcss.config.mjs | components.json  # Tooling configs
├── .env.example                  # Fully commented env template
├── README.md                     # Marketing/overview readme
└── AGENTS.md                     # ⚠ AI-session context file — partially stale, see §4
```

---

## 6. API Reference (`app/api/`)

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/reports/process` | POST | none (expects `userId`) | Inserts issue + embedding, awards +10 karma, kicks off LangGraph pipeline in background via `after()` |
| `/api/reports/retry` | POST | none | Re-runs pipeline from the node matching a `*_failed` stage; reconstructs state from DB |
| `/api/reports/resume` | POST | none | Resumes graph after `community_review_wait` interrupt; falls back to retry if MemorySaver state lost |
| `/api/geocode` | GET | none | Reverse geocode `lat,lng` via Google Maps → `city, state` address (Plus Code stripped) |
| `/api/issues/map` | GET | anon user (service fallback) | Up to 500 open/clustered issues with WKB → `{lat,lng}` decoding via `wkx` |
| `/api/leaderboard` | GET | none | Top-10 non-admin karma profiles (+ names/avatars via auth.admin) and caller’s rank |
| `/api/profile/home-location` | POST | none (expects `userId`) | Saves `profiles.home_location` as PostGIS POINT + address |
| `/api/reviews` | GET | none (expects `userId`) | Community-review queue: issues in `community_review` within 1 km of home, excluding own/already-voted |
| `/api/reviews/[issueId]/vote` | POST | none (expects `userId`) | Records verification, +2 karma; quorum logic (≥3 votes: confirmed/rejected); karma ± and pipeline resume |
| `/api/admin/clusters` | GET | admin | Clusters open/in-progress issues via `getOptimalClusters` for the route planner |
| `/api/admin/issues/[issueId]` | PATCH | admin | Whitelisted updates (`status`, `department_id`); +50 karma once on resolve |
| `/api/admin/issues/[issueId]/comments` | GET/POST | admin | Admin internal comments on an issue, enriched with user metadata |
| `/api/admin/predictive/cluster` | POST | admin | Agent 5 step 1: fetch lookback window + cluster by location (optional bbox) |
| `/api/admin/predictive/analyze` | POST | admin | Agent 5 step 2: Gemini Pro predictions for one cluster → `predictive_alerts` |
| `/api/admin/predictive/run` | POST | admin | Agent 5 end-to-end (cluster + analyze) for a lookback window |
| `/api/admin/routes/optimize` | POST | admin | Google Maps Routes `computeRoutes` with `optimizeWaypointOrder: true` (TSP) → duration, polyline, waypoint order |
| `/api/test` | GET | none | Health check: reports `set`/`missing` for Supabase, Gemini, Maps, Mapbox vars |

**Auth pattern:** admin routes first `supabase.auth.getUser()` with the cookie-based server client, then check `profiles.role === 'admin'`, and use the **service-role client** for the actual mutation (RLS bypass). Note several citizen-facing routes trust a client-supplied `userId` rather than verifying the session — a known hackathon shortcut.

---

## 7. The LangGraph Agent Pipeline (`lib/agents/`)

### `pipeline.ts` — orchestration
- Builds a `StateGraph` with typed channels (reportId, rawText, translation fields, imageUrl/videoUrl, coordinates, userId, classification, deduplication, validation, resolution, error, imageAnalysis, address).
- Entry is a `router` node that branches to the requested `startNode` (`translate` by default; `classify|deduplicate|validate|resolve` for retries).
- Conditional edges: any `state.error` → `save` → END; dedup duplicate → `save`; validation needing community review → `community_review_wait` (a **`interruptBefore`** node) → later resumes into `resolve`.
- `saveToDatabase` node: if duplicate, calls RPC `increment_cluster_count`; on fatal error marks `pipeline_stage='save_failed'`.
- Compiled with a module-level **`MemorySaver`** checkpointer; `thread_id = issueId`.

### Agent 0 — Translation (`agent0-translation.ts`)
Gemini structured JSON: `thought_process`, `detected_language`, `translated_text`. Guardrails against misclassifying English text as Hindi just because it mentions Indian context. Persists `original_language`, `translation_trace`, advances stage → `agent1_classifier`.

### Agent 1 — Classifier (`agent1-classifier.ts`)
- If an image exists, first runs `analyzeImage()` (Gemini 2.5 Flash vision) with a ≤100-word civic description prompt.
- Structured JSON classification against a fixed taxonomy: categories `infrastructure | sanitation | safety | utilities | environment | miscellaneous` with constrained subcategories (e.g., `pothole`, `drainage`, `water_leakage`…), `severity 1–10`, `is_emergency`, `suggested_title`.
- Matches `department_id` by loading `departments.category_scope`.
- Writes title/category/severity/department/address/image_analysis → stage `agent2_deduplication`.

### Agent 2 — Deduplication (`agent2-deduplication.ts`)
- **Scope decision:** global `match_issues` vector search was intentionally removed — dedup only within a **200 m radius** (`issues_within_radius` RPC, same category).
- For each proximity candidate, an **LLM judge** decides “same physical problem?” (`verifyDuplicateWithAI`). On hit: creates/reuses an `issue_clusters` cluster, synthesizes a 1–2 sentence “Evolving Situation Update” appended to the parent issue, marks the new issue `status='closed'` + `cluster_id`, and the save node bumps the cluster counter.
- No duplicate → stage `agent3_validation`.
- ⚠ Sleeps up to **15 s** before returning (demo “visual requirement”).

### Agent 3 — Validation (`agent3-validation.ts`)
- A **LangGraph ReAct prebuilt agent** (`createReactAgent`) with two Zod tools:
  - `get_weather_data` — Open-Meteo current + past-3-day precipitation.
  - `web_search` — DuckDuckGo (`@langchain/community`), 3 results.
- The full message trace is flattened and fed to `generateStructuredJSON` for the final assessment: `credibility_score 1–10`, `reasoning`, `needs_community_verification` (score < 6), `weather_corroborated`. Parse failure falls back to score 5 → community review.
- Persists score/flags; sets `status='community_review'` + stage `awaiting_community_review` when needed, else stage `agent4_resolution`.
- Strong image evidence in the prompt can justify skipping community verification.

### Agent 4 — Resolution (`agent4-resolution.ts`)
- Pulls up to 3 historical issues at the location/category for context (note: compares `address` against `state.coordinates`, so this lookup effectively no-ops — see §12).
- **RAG:** embeds the (translated) report → RPC `match_sops` (threshold 0.5, top 2, category filter) over the `sops` knowledge base seeded from `data/civic_sops.json`.
- Generates the 150–200 word **civic brief** (+ translated `local_civic_brief` when the report wasn’t English) and `sla_hours` strictly derived from SOPs; computes `sla_deadline = now + sla_hours` in code (ignoring any LLM-provided date, default 72 h).
- Persists brief/deadline → stage `completed`.

### Agent 5 — Predictive (`agent5-predictive.ts`) — admin-triggered, not in the main graph
- `fetchAndClusterIssues(lookbackDays, bbox?)` — fetches recent issues, decodes PostGIS locations (WKT or hex-WKB via `wkx`), optionally bbox-filters, then clusters with `getOptimalClusters` (geographic greedy/Haversine DBSCAN-style).
- `analyzePredictiveCluster(cluster)` — summarizes the cluster (category/subcategory/severity/created_at) and asks **Gemini 2.5 Pro** (or Flash if `GEMINI_AGENT5_MODEL=flash`) for a JSON array of `{predicted_category, confidence, basis_summary}`; inserts rows into `predictive_alerts` and marks member issues `agent5_completed=true`.
- `runPredictiveAgent(lookbackDays, bbox)` — the full loop; exposed via the three `/api/admin/predictive/*` endpoints.

---

## 8. AI Client (`lib/ai/client.ts`)

Provider selected by `AI_PROVIDER`: `gemini` (default) or `ollama`.

| Export | Purpose |
|---|---|
| `generateStructuredJSON<T>(prompt, system, usePro?)` | Primary agent call; JSON with one repair retry; Flash by default, Pro when `usePro` |
| `generateText(prompt, system?, usePro?)` | Plain text completion |
| `generateEmbedding(text)` | 768-dim vector — `gemini-embedding-001` or Ollama `nomic-embed-text` (pgvector dim is fixed at 768) |
| `analyzeImage(url, prompt)` | Downloads image → base64 → Gemini 2.5 Flash vision |
| `getChatModel(usePro?)` | LangChain chat model (`ChatGoogleGenerativeAI` / `ChatOpenAI`) for the Agent 3 ReAct loop |

Ollama knobs: `OLLAMA_BASE_URL`, `OLLAMA_LOCAL_BASE_URL`, `OLLAMA_API_KEY`, `OLLAMA_FLASH_MODEL` (default `qwen3:30b-a3b`), `OLLAMA_PRO_MODEL` (default `qwen3:235b-a22b`). A custom `fetch` disables keep-alive (worked around `UND_ERR_SOCKET` issues behind ngrok).

---

## 9. Database Schema (Supabase / Postgres)

Base migration: `supabase/migrations/20260625082016_init_schema.sql` (plus later columns such as `issues.image_analysis` from `migrations/add_image_analysis.sql` and pipeline/translation columns applied out-of-band).

| Table | Key columns | Purpose |
|---|---|---|
| `profiles` | id (=auth.users), role (`citizen`/`admin`), karma_score, ward_id, push_subscription, home_location (geography), home_address | Citizen identity; auto-created by `on_auth_user_created` trigger |
| `departments` | name, `category_scope text[]`, avg_resolution_hours | Routing target for classified issues |
| `issue_clusters` | representative_issue_id, issue_count, category | Dedup groups; `issue_count` bumped via RPC |
| `issues` | user_id, title/description, category/subcategory, severity 1–10, is_emergency, status (`open, in_progress, resolved, false_closure, closed, community_review`), **location geography(point,4326)**, address, photo/video_url, **embedding vector(768)**, credibility_score, cluster_id, department_id, civic_brief, local_civic_brief, original_language, translation_trace, image_analysis, sla_deadline, pipeline_stage, reasoning, weather_checked, web_search_checked, agent5_completed, resolved_at | Core issue record + full pipeline trace |
| `verifications` | issue_id, user_id, verdict, comment, distance_meters (unique per user/issue) | Community quorum votes |
| `karma_events` | user_id, event_type, points, issue_id | Append-only gamification ledger |
| `upvotes` | issue_id, user_id, weight | Issue upvotes (unique per user/issue) |
| `predictive_alerts` | location geography, predicted_category, confidence, prediction_date, basis_summary, is_actioned, address | Agent 5 output (realtime-enabled) |
| `sops` | category, content, embedding vector(768) | RAG knowledge base for Agent 4 (seeded from `data/civic_sops.json`) |
| `issue_comments` | issue_id, user_id, comment_text | Admin triage notes |

**Indexes:** GIST on `issues.location` and `predictive_alerts.location`; IVFFlat cosine on `issues.embedding`.

**RLS:** enabled on profiles, issues, verifications, karma_events, upvotes with permissive policies (public read of issues/verifications/upvotes; insert/update scoped to `auth.uid()`; karma readable only by owner). Mutations by the pipeline/admin use the **service-role key** (bypasses RLS).

**SQL RPCs used by the app:**
- `match_issues(query_embedding, match_threshold, match_count)` — pgvector cosine search (kept, but Agent 2 no longer calls it)
- `issues_within_radius(lat, lng, radius_meters, category)` — PostGIS proximity search (Agent 2)
- `increment_cluster_count(cluster_id)` — duplicate counter (pipeline save node)
- `match_sops(query_embedding, match_threshold, match_count, filter_category)` — SOP RAG (Agent 4)

**Karma economy:** +10 issue reported · +50 issue resolved (once) · +2 community vote · +20 reporter on community confirmation · −5 reporter on rejection · +5 majority-voter bonus.

---

## 10. Frontend Pages & Components

### Pages
- **`/` (`app/page.tsx`)** — logged-out landing with **Citizen** / **Municipal** entry buttons; authed users redirect to `/dashboard`.
- **`/auth/login`** — role-aware login (Google OAuth + email OTP/magic link), passes `role` through the callback.
- **`/auth/callback`** — exchanges the OAuth code for a session; promotes the profile to `admin` when `role=admin` was requested; redirects to `/admin/dashboard` or `/dashboard`.
- **`/report`** — the richest client page: free-text with **voice input** (Web Speech API), drag-drop image, **video upload**, **webcam capture** (`WebcamModal`), location via **GPS** or **Leaflet picker** (`LocationPickerPanel`, reverse-geocoded through `/api/geocode`), media uploaded to Supabase Storage bucket `issue-media`, then POSTs `/api/reports/process` and navigates to the dashboard.
- **`/dashboard`** — server wrapper fetching profile/issues/departments → `DashboardClient`.
- **`/admin/dashboard`** — server wrapper with admin guard → `AdminDashboardClient`.
- **`/receipt/[issue_id]`** — edge route rendering a 1200×630 **Impact Receipt** OG image (fix time, address, playful “citizens improved” metric).

### Citizen dashboard (`components/dashboard/DashboardClient.tsx`, ~1681 lines)
- Personal issue list with status/severity cards, SLA/pipeline-stage display, and AI output (credibility, civic brief).
- **Realtime**: Supabase channel `issues-realtime` on `postgres_changes` so pipeline updates appear live.
- **Community review queue**: pulls `/api/reviews`, shows nearby unverified issues, casts votes via `/api/reviews/[issueId]/vote`, tracks quorum outcome.
- **Home location setup** (geocode + `/api/profile/home-location`) which gates review proximity.
- **Retry** failed pipelines (`/api/reports/retry`).
- Embeds `IssueMapPanel` (city-wide Leaflet map from `/api/issues/map`) and `CitizenLeaderboardPanel` (karma ranks).
- Map helpers `Agent2MapInner` / `Agent2MapVisuals` visualize dedup clusters/pipeline stages; `MiniMapWidget` is a compact map card.

### Admin dashboard (`components/admin/AdminDashboardClient.tsx`, ~1627 lines)
- Civic inbox of **all** issues with filters, detail drawer showing the full **AI reasoning trace** (translation, classification, credibility, civic brief, SLA).
- Status/department updates (`PATCH /api/admin/issues/[id]`), internal **comments**, failed-stage **retry**, realtime refresh.
- **`RoutePlannerPanel`**: fetches `/api/admin/clusters`, lets admin pick stops, calls `/api/admin/routes/optimize`, renders the decoded polyline in `RoutePlannerMapInner` with distance/duration and optimized waypoint order.
- **`Agent5PredictivePanel`**: choose lookback days → `/api/admin/predictive/cluster` → per-cluster `/analyze` (or `/run` for everything) → hotspot markers in `Agent5PredictiveMapInner` with confidence + basis summary.
- Shared **`IssueMapPanel`** for the city-wide map.

### UI kit
`components/ui/*` are standard shadcn/ui components (button with CVA variants, card, dialog, input, textarea, badge, avatar, sonner toaster) styled by Tailwind v4 tokens in `app/globals.css`.

---

## 11. Scripts, Data & Tests

### Seeding / DB utilities (`scripts/`) — run with `bun run <script>` (they `dotenv` `.env.local`)
| Script | What it does |
|---|---|
| `seed-india.ts` | Largest generator (~710 lines): multi-city clusters (Mumbai, Delhi, …) of realistic issues |
| `seed-nashik-issues.ts` / `seed-ronit-issues.ts` | Nashik-focused / demo dataset inserts |
| `seed-departments.ts` | Inserts municipal departments with `category_scope` arrays |
| `seed-knowledge-base.ts` | Reads `data/civic_sops.json`, generates 768-dim embeddings, upserts into `sops` |
| `seed-db.ts` / `generate-data.ts` | CSV-based seed; Faker.js generator producing `issues.csv`, `profiles.csv`, `karma_events.csv`, `verifications.csv` |
| `reset-db.ts` / `delete-all-users.ts` | Destructive wipes (issues or auth users) — dev only |
| `migrate-categories.ts` | Normalizes legacy category strings to the 6-category taxonomy |
| `fetch-issues.ts` | Dumps issues via the service client |
| `seed.sql`, `apply_trigger.js`, `patch-admin.js`, `patch-agent1.js` | Raw SQL/JS patches (triggers, admin promotion, prompt tweaks) |
| `manage-gcloud.ps1` | Windows PowerShell helper for gcloud/Artifact Registry ops |

### Tests (`tests/`)
There is **no test runner configured** (`package.json` has only `dev/build/start/lint`). `tests/` holds ad-hoc scripts executed manually (e.g., `bun run tests/test-agent1.ts`):
- `test-agent1.ts` … `test-agent4.ts` — invoke a single agent with a hardcoded `AgentState` fixture.
- `retry-test.ts` — POSTs `/api/reports/retry` for a fixed issue id.
- `vote-test.ts` — drives the quorum voting endpoint.
- `test_db.ts`, `test-update.ts` — connectivity/write smoke tests.
- `test-location.mjs` (⚠ saved as UTF-16, often unreadable), `test-location2.mjs` — inspect PostGIS location encoding.
- `test-vision.ts`, `test-ollama-vision.ts` — image analysis against Gemini/Ollama.

### Data (`data/`)
- `civic_sops.json` — 7 SOP documents with concrete SLA rules (e.g., potholes 24 h major road / 72 h residential; manhole covers 12 h; dead animals 6 h) — the factual backbone of Agent 4’s SLAs.
- `KNOWLEDGE_BASE.md` — explains the RAG design, `sops` schema, and how to refresh embeddings.

---

## 12. Environment Variables (`.env.local`, template in `.env.example`)

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase project + anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Server-side RLS bypass (pipeline, admin mutations) |
| `GEMINI_API_KEY` | ✅ | Gemini models |
| `AI_PROVIDER` | optional | `gemini` (default) or `ollama` |
| `GEMINI_AGENT5_MODEL` | optional | `flash` for cheaper Agent 5 runs (default Pro) |
| `OLLAMA_BASE_URL`, `OLLAMA_LOCAL_BASE_URL`, `OLLAMA_API_KEY`, `OLLAMA_FLASH_MODEL`, `OLLAMA_PRO_MODEL`, `OLLAMA_EMBEDDING_MODEL` | optional | Ollama cloud/local fallbacks |
| `GOOGLE_MAPS_API_KEY` | ✅ | Reverse geocoding + Routes (TSP) |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | optional | Client-side Maps (declared in Docker build args) |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | optional | Present but UI renders with Leaflet/OSM |
| `NEXT_PUBLIC_APP_URL` | ✅ | Absolute redirects (auth callback, resume fallback) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL` | optional | Web Push (infrastructure present; flow not fully built) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | ✅ for Google login | OAuth credentials |

---

## 13. Running, Building, Deploying

```bash
bun install          # dependencies
bun dev              # dev server (Turbopack) → http://localhost:3000
bun run build        # production build (output: 'standalone')
bun run lint         # eslint
GET /api/test        # verify env vars are 'set'
```

**Database setup:** apply `supabase/migrations/20260625082016_init_schema.sql` + `migrations/add_image_analysis.sql` in the Supabase SQL editor; ensure PostGIS + pgvector extensions; create Storage bucket `issue-media` (public read, authenticated write); enable Realtime on `issues` and `predictive_alerts`; seed with `scripts/seed-departments.ts` and `scripts/seed-knowledge-base.ts`.

**Docker:** multi-stage `Dockerfile` — `deps` (bun install --frozen-lockfile) → `builder` (public `NEXT_PUBLIC_*` passed as build args, `bun run build`) → `runner` (non-root `nextjs` user, `sharp` installed for standalone image optimization, `node server.js` on port 3000). `docker-compose.yml` runs it locally with Ollama reachable via `host.docker.internal`.

**CI/CD:** push to the **`prod`** branch triggers `.github/workflows/deploy-prod.yml`: authenticate via Workload Identity Federation → inject `secrets.ENV_PRODUCTION` → build/push image to Artifact Registry (`asia-south1-docker.pkg.dev/civicpulse-500507/...`) → deploy Cloud Run service `civicpulse` in `asia-south1` with env vars from the same file (`--allow-unauthenticated`).

---

## 14. Known Quirks & Tech Debt

1. **`proxy.ts` not `middleware.ts`** — this Next.js version renamed the request interceptor; the file exports `proxy()` and a `config.matcher`. Don’t add a `middleware.ts`.
2. **Duplicate auth actions** — `app/auth/actions.ts` is a legacy copy; the role-aware `lib/auth/actions.ts` is the one the login page uses. Candidates for cleanup.
3. **`MemorySaver` checkpointer** — pipeline state lives in process memory; a server restart orphans interrupts (resume endpoint falls back to retry). A Postgres checkpointer (`@langchain/langgraph-checkpoint-postgres` is already a dependency) is the intended upgrade.
4. **Agent 2’s forced 15-second sleep** — deliberate demo pacing, not a bug, but it slows the report flow.
5. **Agent 4 history query** — `.eq('address', state.coordinates)` compares an address column to a coordinates object, so “historical context” never matches (harmless, but the feature is effectively dead).
6. **Client-supplied `userId`** on citizen-facing endpoints (`/api/reports/process`, `/api/reports/retry`, votes, home location) is trusted without session verification — fine for a demo, must be fixed before production.
7. **Inconsistent dedup scoring** — similarity is hardcoded (`0.7` for proximity-confirmed duplicates); the original 0.85 cosine-threshold vector path was intentionally removed.
8. **Maps stack drift** — Mapbox packages/tokens are installed/configured but the UI actually renders Leaflet + OSM tiles; README/AGENTS.md language still mentions Mapbox.
9. **`AGENTS.md` / README staleness** — README says “6 agents” (correct) while `AGENTS.md` still lists Agent 5, admin dashboard, receipt route, and seed scripts as unbuilt — all now exist.
10. **No automated test suite** — `tests/` are manual scripts with hardcoded IDs; a runner (Vitest/Playwright) and CI test step are missing.
11. **Realtime-enabled push** — VAPID/web-push dependencies and `profiles.push_subscription` exist, but no end-to-end push notification flow (`lib/push/`) is implemented.
12. **`tests/test-location.mjs` is UTF-16 encoded** — re-save as UTF-8 if you need to run it.

---

## 15. Quick “Where do I change X?” Guide

| I want to… | Go to… |
|---|---|
| Change classification taxonomy/severity rules | `lib/agents/agent1-classifier.ts` (prompt) |
| Tune dedup radius/threshold | `lib/agents/agent2-deduplication.ts` (`PROXIMITY_METERS`, threshold) |
| Adjust credibility/community-review cutoff | `lib/agents/agent3-validation.ts` (score < 6) |
| Change SLA rules / civic brief wording | `data/civic_sops.json` (re-run `scripts/seed-knowledge-base.ts`) + `lib/agents/agent4-resolution.ts` |
| Modify pipeline branching/edge cases | `lib/agents/pipeline.ts` |
| Swap models/providers | `lib/ai/client.ts` + `AI_PROVIDER` env |
| Add an API endpoint | `app/api/**/route.ts` using `lib/db/server.ts` clients |
| Change citizen UI | `components/dashboard/DashboardClient.tsx` |
| Change municipal UI / route planner / hotspots | `components/admin/*` |
| Add DB columns/tables | `supabase/migrations/` + `lib/db/types.ts` |
| Adjust auth guards | `proxy.ts` (route protection) + `app/auth/callback/route.ts` |
| Deploy | push to `prod` branch (or `docker build` locally) |

---

*End of document. Generated by repository analysis; section numbers are referenced from the code comments above.*
