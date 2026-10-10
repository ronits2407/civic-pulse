# Implementation log — CivicPulse mobile client

Scope: a native Android citizen client, reusing the existing Next.js backend, Supabase
project, AI pipeline and domain types. Home-screen widgets excluded.

---

## Key decisions

| # | Decision | Why |
|---|---|---|
| 1 | Placed the app in `mobile/` rather than restructuring into `apps/web` + `apps/mobile` | The web app stays independently runnable and its `bun.lock` is untouched. No monorepo migration was needed to share anything. |
| 2 | Imported web domain types with `export type` only | `lib/db/types.ts` is pure TypeScript, so it is safe to reuse — and `export type` is erased by Babel, so Metro never resolves a path outside the project root at runtime. The coupling is compile-time only. |
| 3 | Ported the dashboard's `getAgentState()` into `lib/pipeline.ts` rather than re-deriving progress | The stage strings are written by the LangGraph nodes. Duplicating the mapping would let the two clients drift. |
| 4 | Hand-rolled a Point-only PostGIS decoder instead of using `wkx` | `wkx` is Node-oriented. The app only ever decodes `geography(point,4326)`, so a focused reader avoids a Node polyfill in the bundle. |
| 5 | Chunked SecureStore session storage | Android rejects SecureStore values above ~2 KB; a Supabase session exceeds that. AsyncStorage is the documented fallback. |
| 6 | Hand-rolled `useAsync` + a small toast host | Six read paths and one toast shape do not justify React Query or a UI library. Kept the dependency graph honest. |
| 7 | Map colours reuse the same status semantics as chips and severity meters | A red pin, a red pill and a red meter must mean the same thing. |
| 8 | JetBrains Mono reserved for measured values | Separates machine output (severity, SLA, coordinates) from prose at a glance. |
| 9 | The pipeline rail is the recurring visual motif | The five-agent journey is the product's distinguishing idea, so it is drawn literally on the login hero, issue cards, the detail timeline and the post-submit confirmation. |
| 10 | Removed the web's `?role=admin` login promotion | On mobile it would be a privilege escalation reachable by editing a link. Role is read from `profiles` after authentication instead. |
| 11 | Voice input is reported as unavailable, not faked | The Web Speech API has no reliable React Native equivalent. Silently recording nothing would be worse than saying so. |
| 12 | Upload progress reported in named stages, not a fake percentage | Supabase's upload API exposes no byte-level callback. Inventing a number would be a lie. |
| 13 | Location picker includes an arrow-nudge pad | Tapping a small screen at city zoom can be hundreds of metres off, and the pad still works when map tiles are unavailable. |

---

## Backend changes

Minimal, and additive — the web app's behaviour is unchanged.

| File | Change |
|---|---|
| `lib/auth/api-auth.ts` | **New.** Resolves identity from a bearer token (validated via Supabase), then the cookie session, then the legacy client-supplied id. |
| `app/api/reports/process/route.ts` | Uses the resolved identity; a rejected credential is a 401. |
| `app/api/profile/home-location/route.ts` | Same. |
| `app/api/reviews/route.ts` | Same. |
| `app/api/reviews/[issueId]/vote/route.ts` | Same. |
| `tsconfig.json` | Added `mobile` to `exclude` so the web typecheck does not walk the RN project. |

No schema migrations. No changes to the AI pipeline.

---

## Verification executed

| Command | Result |
|---|---|
| `mobile: npx tsc --noEmit` | clean |
| `web: npx tsc --noEmit` | clean |
| `mobile: npx expo export --platform android` | success — 2074 modules, 5.1 MB Hermes bundle, 15 MB output |
| `mobile: expo start --android` | Metro bundled (`Android Bundled 5983ms … 2074 modules`) |
| `web: bun run build` | success, 31 routes |
| `POST /api/reports/process` + bad bearer token | `401 {"error":"Your session could not be verified. Sign in again."}` |
| `POST /api/reports/process` + no credential | `401 {"error":"Authentication required."}` |
| `GET /api/geocode?lat=19.9975&lng=73.7898` | `200 {"address":"Lokhand Bazar, Kolhapur, Maharashtra"}` |
| `GET /api/issues/map` | 200 with decoded `{lat,lng}` markers |

---

## Unresolved / unverified

1. **`SUPABASE_SERVICE_ROLE_KEY` is a disabled legacy key in this environment.**
   `{"error":"Legacy API keys are disabled"}`. This blocks server-side paths that need RLS
   bypass: `/api/reports/retry`, `/api/reports/resume`, `POST /api/reviews/[issueId]/vote`
   (its `verifications` insert), and any agent node that writes through the service client.
   **This is pre-existing, not introduced here** — `/api/admin/*` was already failing the
   same way. It must be rotated before the report and verification flows can be exercised
   end to end.
2. **End-to-end report → pipeline → detail has not been run**, because (1) blocks the
   pipeline's service-role writes, and a Supabase sign-in is required first.
3. **Real map tiles are unverified** — no Android Maps SDK key is configured, so the map
   screens exercise the documented fallback path instead.
4. **A standalone release APK was not built.** Verification was in Expo Go on an emulator.
5. **Video playback** is not implemented (upload only).
