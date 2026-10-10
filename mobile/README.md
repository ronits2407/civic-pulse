# CivicPulse Mobile (React Native / Expo)

A native Android client for CivicPulse. It talks to the **existing** Next.js backend and
the **existing** Supabase project — it is not a WebView wrapper, and it does not
reimplement any server-side behaviour.

The citizen flow is complete: sign in, report an issue with photo + location, track the
six-agent pipeline in real time, verify neighbours' reports, browse the city map, and
share a resolution receipt.

---

## What it reuses

Nothing that already works on the server was rewritten.

| Concern | Where it lives |
|---|---|
| 6-agent LangGraph pipeline | `POST /api/reports/process` (web) |
| Retry / resume a stalled pipeline | `POST /api/reports/retry`, `POST /api/reports/resume` |
| Reverse geocoding | `GET /api/geocode` |
| Community verification + quorum + karma | `GET /api/reviews`, `POST /api/reviews/[issueId]/vote` |
| City-wide markers | `GET /api/issues/map` |
| Karma leaderboard | `GET /api/leaderboard` |
| Home location | `POST /api/profile/home-location` |
| Impact receipt image | `GET /receipt/[issue_id]` |
| Database, Auth, Storage, Realtime | The shared Supabase project |

Domain types are imported **directly** from the web app's `lib/db/types.ts` via
`types/civicpulse.ts`, using `export type` so the import is erased at build time and
Metro never has to resolve a path outside the project root. The pipeline state machine in
`lib/pipeline.ts` is a port of the web dashboard's `getAgentState()`, so stage names and
progress semantics cannot drift.

---

## Prerequisites

- **Bun** (the same package manager the web app uses)
- **Node 20+**
- An Android emulator or a physical device
- The web app's dependencies installed (you will run the backend locally)
- A Supabase project already migrated (see the root `README.md`)

---

## 1. Configure

```bash
cd mobile
cp .env.example .env.local
```

Fill in `.env.local`. Only `EXPO_PUBLIC_*` values reach the bundle.

| Variable | Required | Notes |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | yes | Same project as the web app |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | yes | Public anon key. **Never** the service-role key |
| `EXPO_PUBLIC_API_URL` | yes | See the table below |
| `EXPO_PUBLIC_AUTH_REDIRECT` | yes | Defaults to `civicpulse://auth-callback` |
| `EXPO_PUBLIC_GOOGLE_MAPS_KEY` | no | Optional; the map degrades gracefully without it |

`EXPO_PUBLIC_API_URL` depends on where you are running:

| Target | Value |
|---|---|
| Android emulator → backend on your machine | `http://10.0.2.2:3000` |
| Physical device → backend on your machine | `http://<your-lan-ip>:3000` |
| Production | `https://<cloud-run-service>.run.app` |

`10.0.2.2` is the emulator's alias for the host machine's loopback. `localhost` inside the
emulator refers to the emulator itself and will not reach your dev server.

### Supabase dashboard settings

1. **Authentication → URL Configuration → Redirect URLs** — add everywhere the app should
   be allowed to return to:
   ```
   civicpulse://auth-callback
   ```
2. **Authentication → Email Templates → Magic Link** — include `{{ .Token }}` in the body
   if you want the six-digit code path to work. The app supports both the code and the
   magic-link deep link.

### Android Maps key (optional)

The map screen needs an Android Maps SDK key in the build. Create one in Google Cloud
Console, **restricted to Android apps** with package `org.civicpulse.app` and your signing
SHA-1, then set `EXPO_PUBLIC_GOOGLE_MAPS_KEY`.

If you skip this, nothing breaks: `components/map/MapSurface.tsx` detects the missing key
and renders a distance-ordered list of nearby reports instead of tiles.

---

## 2. Run

Start the backend first (from the repo root):

```bash
bun dev            # http://localhost:3000
```

Then start the app:

```bash
cd mobile
bun install
bun run android    # boots Metro and opens the app on the connected device/emulator
```

Useful variants:

```bash
bun run start      # Metro only; scan the QR code with a device
bun run lint       # expo lint
npx tsc --noEmit   # typecheck
```

---

## 3. Build

The project uses Continuous Native Generation — there is no checked-in `android/`
directory.

```bash
npx expo prebuild --platform android    # generate the native project
npx expo run:android                    # build + install a development build
```

For a distributable artifact, use EAS:

```bash
npx eas build --platform android --profile production
```

`app.config.ts` injects the Maps key and the Android manifest permissions (location,
camera) at prebuild time, so re-run `prebuild` after changing
`EXPO_PUBLIC_GOOGLE_MAPS_KEY`.

---

## 4. Architecture

```
app/
  _layout.tsx              Root: fonts, safe area, auth, toasts, stack
  index.tsx                Boot gate — session restore + role routing + config errors
  auth-callback.tsx        Deep-link handler (magic link / OAuth code exchange)
  (auth)/                  login, verify
  (citizen)/               index (home), report, map, review, profile
  issue/[id].tsx           Issue detail + AI reasoning trace + realtime
  leaderboard.tsx          Karma rankings
  receipt.tsx              Impact receipt view/share
  municipality/            Admin-only boundary (see below)

components/
  ui/                      Design system: Button, Card, Chip, Input, Screen, Feedback…
  pipeline/                PipelineRail + PipelineTimeline (the signature motif)
  issues/                  IssueCard, SeverityMeter, detail building blocks
  map/                     MapSurface, IncidentMap, LocationPickerSheet, fallbacks
  report/                  MediaThumb
  dashboard/               ActivityBand, QuickLink
  feedback/                ToastHost

features/                  Feature-scoped logic (report draft, review card)
hooks/                     useMyIssues, useIssueDetail, useReviewQueue, useNearbyIssues…
lib/
  api/                     client.ts (transport) · contracts.ts · endpoints.ts · repos
  auth/                    AuthProvider (session, OTP, OAuth, role)
  supabase/                Shared Supabase client
  location/                geo.ts (permissions, GPS, geocoding) · postgis.ts (decode)
  media/                   upload.ts (compress + Storage upload)
  storage/                 Chunked SecureStore session storage
  pipeline.ts · format.ts · env.ts · haptics.ts
theme/                     tokens.ts · Typography.tsx · icons.tsx · navigation.ts
types/civicpulse.ts        Compile-time bridge to the web app's domain types
```

### Layering rules

- UI components never call `fetch` or Supabase directly.
- `lib/api/client.ts` is the only place that builds a network request.
- `lib/api/endpoints.ts` is the only place that knows URLs.
- Hooks own React state; components own presentation.

### Design language

The dark palette is lifted from the web app so the identity carries over exactly:
canvas `#0d1117`, surfaces `#161b22`, hairlines `#30363d`, brand green `#2da44e`,
navigation blue `#0969da`. Status colours are semantic and shared between chips, map pins
and severity meters — red always means emergency or failure.

**Typography:** Inter for interface text, **JetBrains Mono reserved for measured values** —
severity, SLA countdowns, coordinates, karma, issue ids. That split is deliberate: it lets
a citizen separate what the system measured from what it says about it, at a glance.

**The pipeline rail** (`components/pipeline/`) is the recurring motif. Every report is
processed by five chained agents, so that journey is drawn literally — on the login hero,
on every issue card, on the detail timeline and on the post-submit confirmation. One
visual idea, learned once, readable everywhere.

Fonts degrade safely: `FontProvider` publishes whether they loaded, and `Text` falls back
to system faces if they did not. A font failure can never block the app.

---

## 5. Authentication

The web app authenticates with Next.js server actions and stores the session in cookies.
Neither exists on a phone, so the mobile client deliberately differs:

- **Session storage** — `lib/storage/session-storage.ts` wraps the Android Keystore.
  Android caps SecureStore values at ~2 KB and a Supabase session exceeds that, so the
  session JSON is chunked, with an AsyncStorage fallback if the keystore refuses.
- **Email** — six-digit OTP, plus the magic-link deep link at `civicpulse://auth-callback`.
- **Google** — `signInWithOAuth` with `skipBrowserRedirect`, opened in an auth session and
  exchanged for a session on return (`flowType: 'pkce'`).
- **Role** — read from the `profiles` row, exactly as on the web. An `admin` account is
  routed to the municipal group and can never land in the citizen tabs; a citizen session
  is redirected out of the municipal group.

### Google sign-in lands on `localhost:3000`

This is Supabase rejecting the redirect URL, not an app bug. When `redirectTo` is not in
**Authentication → URL Configuration → Redirect URLs**, Supabase ignores it and sends the
browser to the project's **Site URL** (`http://localhost:3000` in development). The app
never gets control back.

The redirect URL depends on how the app is hosted, and **each one must be allow-listed**:

| Host | URL the app sends |
|---|---|
| Expo Go, emulator or USB-tunnelled phone (`adb reverse`) | `exp://127.0.0.1:8081/--/auth-callback` |
| Expo Go over Wi-Fi | `exp://<mac-lan-ip>:8081/--/auth-callback` |
| Dev or release build | `civicpulse://auth-callback` |

In development the login screen prints the exact URL for the device you are on. Check it
against Supabase without sending any email:

```bash
cd mobile
sh scripts/check-auth-redirect.sh                       # the usual candidates
sh scripts/check-auth-redirect.sh '<url from the login screen>'
```

It prints `ACCEPTED` or `REJECTED` per URL. Add every rejected URL you use to the
allow-list, or use the wildcards `exp://**` and `civicpulse://**`.

There is intentionally **no "sign in as municipal" toggle**. The web login promotes an
account to admin via a URL parameter; on mobile that would be a privilege escalation
reachable by anyone who can edit a link, so it is not implemented.

### Backend change that came with this work

Citizen-facing routes previously trusted a client-supplied `userId`. The native client adds
real session verification:

- `lib/auth/api-auth.ts` (new) — resolves identity from an `Authorization: Bearer` token
  (validated with Supabase), then falls back to the web app's cookie session, and only then
  to the legacy client-supplied id.
- Wired into `POST /api/reports/process`, `POST /api/profile/home-location`,
  `GET /api/reviews` and `POST /api/reviews/[issueId]/vote`.

A credential that is presented and rejected is always a **401**. A verified identity always
overrides a client-claimed one. Cookie callers are unaffected, so the web app behaves
identically.

---

## 6. Reporting

`app/(citizen)/report.tsx` follows the same contract as the web page: media goes to the
Supabase Storage bucket `issue-media`, then `POST /api/reports/process` files the issue and
starts the pipeline in the background.

- **Images** are downscaled to 1600 px and re-encoded at quality 0.7 before upload
  (`lib/media/upload.ts`). A raw phone photo is 3–6 MB, which is a ~20-second upload on
  mobile data for an image a clerk reads on a laptop.
- **Location** — GPS or a map picker (`LocationPickerSheet`). The picker also offers an
  arrow pad that nudges the pin ~55 m per tap, which is the only adjustment that works
  when the map is unavailable and is more precise than tapping at city zoom.
- **Drafts** persist to AsyncStorage on a debounce and are restored on reopen. A draft is
  never presented as submitted.
- **Failure is never silent.** If an upload or the POST fails, the draft is kept, already
  uploaded media is reused on retry, and the screen says the report was not filed.
- **Voice input is not claimed to work.** The Web Speech API used by the web app has no
  reliable React Native equivalent, so the control states plainly that it is unavailable
  rather than pretending to record.

Permissions are requested only from an explicit user action, and a denial is explained with
the alternative offered (pick on the map instead, attach from gallery instead).

---

## 7. Municipality boundary

`app/municipality/` is the extension point for a future native municipal console. It is not
a port of the web admin dashboard — that work is out of scope here.

It currently does three honest things:

1. Enforces `role === 'admin'` at the layout level and bounces citizens out.
2. Shows **live** operational counts from the database (open, in progress, overdue past
   SLA, awaiting community quorum, failed pipeline runs) via head-only `count` queries.
3. Hands over to the existing web console at `/admin/dashboard`.

Triage, internal comments, SLA management, the TSP field-crew route planner and Agent 5
predictive hotspots remain in the web app.

---

## 8. Known limitations

- **Verified on an Android emulator via Expo Go.** A standalone release APK has not been
  built here.
- **Maps need a key.** Without `EXPO_PUBLIC_GOOGLE_MAPS_KEY` the map screens render the
  nearby-list fallback. This is by design, not a failure — but real tiles are unverified in
  this environment.
- **No home-screen widgets.** Deliberately excluded from this scope.
- **`SUPABASE_SERVICE_ROLE_KEY` is a disabled legacy key in the current environment.**
  Endpoints that require the service role — `/api/reports/retry`, `/api/reports/resume`,
  and the vote route's verification insert — return 500 until that key is rotated. Reads
  and inserts done through the anon key (issues, profile, home location) work normally.
- **Voice reporting** is not implemented (see above).
- **Videos** are uploaded and stored, but there is no in-app playback.

---

## 9. Verification status

| Check | Result |
|---|---|
| `tsc --noEmit` (mobile) | pass |
| `tsc --noEmit` (web) | pass |
| `expo export --platform android` | pass — 2074 modules, 5.1 MB Hermes bundle |
| Metro bundle + launch in Expo Go | pass |
| Web `next build` unaffected | pass (31 routes) |
| `POST /api/reports/process` rejects a bad bearer token | 401 |
| `POST /api/reports/process` with no credential | 401 |
| `GET /api/geocode` returns `{ address }` | verified against a live provider |
| End-to-end report → pipeline → detail | manual; requires Supabase sign-in |

To reproduce the automated checks:

```bash
cd mobile && npx tsc --noEmit && npx expo export --platform android --output-dir /tmp/verify
cd .. && npx tsc --noEmit && bun run build
```
