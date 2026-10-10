# Credible Evidence Validation and Resolution Verification — Implementation Plan

> **For implementation agents:** follow the numbered tasks in order. Each task is a reviewable, tested increment. Do not deploy database migrations to the remote Supabase project without an explicit deployment go-ahead. Use `bun` for package scripts and tests.

**Goal:** Give citizens and staff a transparent evidence trail from report credibility through municipal completion claims to independently verified (or disputed/unverified) resolution, without allowing an AI score or an unauthenticated status edit to decide the outcome alone.

**Design source:** [`docs/superpowers/specs/2026-10-10-credible-evidence-validation-design.md`](../specs/2026-10-10-credible-evidence-validation-design.md)

**Architecture:** Keep the existing LangGraph Agent 3 at intake, but make its output a typed, versioned evidence assessment. Store media references, assessments, reviews, and state transitions as separate Supabase records. Keep operational issue status and resolution-verification state distinct. Use session-authenticated route handlers, database constraints/RPCs for atomic state changes and quorum, and separate review UIs for resolution rather than reusing intake votes. Keep automated decisions conservative/configurable and expose confidence, risk, evidence factors, and unknowns in the timeline.

## Scope and boundaries

- Implement the design for the current Next.js web app and its existing Expo mobile API consumer. Keep intake review and resolution review semantically separate.
- Do not build video-forensics or claim media authenticity. First release may sample video keyframes; automated media concerns are risk flags only.
- Do not auto-reject reports, auto-close from AI alone, or treat review expiry/no responses as approval.
- Do not add a general-purpose municipal workforce/SSO system. Pilot staff accounts are provisioned by an existing admin; authorization is checked against a dedicated active staff-membership record.
- Preserve existing caller data and unrelated workspace changes. Run migrations locally/static checks first; remote apply is an operator-controlled step.

## File map

**New files**

- `supabase/migrations/20261010000000_evidence_verification.sql` — forward-only tables, constraints, indexes, private bucket policies, safe transition/review RPCs, and grants.
- `docs/superpowers/plans/evidence-schema-inventory.md` — pre-migration inventory of runtime columns, RLS, roles, and Storage policies to compare with target Supabase.
- `lib/evidence/types.ts` — evidence, signal, assessment, review, and resolution-state unions/interfaces shared by the app.
- `lib/evidence/policy.ts` — pure, deterministic confidence aggregation, risk routing, quorum, expiry, and transition rules; no database/model calls.
- `lib/evidence/assessor.ts` — structured Gemini media-to-claim assessment through the existing AI wrapper; no write access and no chain-of-thought persistence.
- `lib/evidence/repository.ts` — service-role persistence for structured assessments/events and safe evidence reads; never imported by client code.
- `lib/evidence/media.ts` — validation and storage-key helpers for the private `issue-evidence` bucket.
- `lib/evidence/resolution.ts` — authenticated actor checks and orchestration for completion claims, review rounds, adjudication, reopen, and guarded verification.
- `lib/auth/request-user.ts` — resolve and verify cookie-backed web sessions or mobile Bearer tokens, return actor plus caller-scoped Supabase client; never infer actor from request JSON/query.
- `app/api/issues/[issueId]/evidence/route.ts` — authenticated timeline read for authorized/citizen-safe views.
- `app/api/issues/[issueId]/completion/route.ts` — create municipality completion claim and attach uploaded media metadata.
- `app/api/issues/[issueId]/resolution-review/route.ts` — get/submit resolution-review verdicts; identity comes from session.
- `app/api/admin/issues/[issueId]/adjudication/route.ts` — audited admin decision/override endpoint.
- `app/municipality/dashboard/page.tsx` — membership-guarded staff landing page for assigned/in-scope issues.
- `components/municipality/MunicipalityDashboardClient.tsx` — completion-claim queue for authorized staff; reuses completion form, not admin-wide issue mutation.
- `components/evidence/EvidenceTimeline.tsx` — reusable citizen/admin timeline and factor explanations.
- `components/admin/CompletionEvidenceForm.tsx` — staff completion claim UI.
- `components/dashboard/ResolutionReviewCard.tsx` — citizen resolution-review UI.
- `mobile/components/community/ResolutionReviewCard.tsx` — mobile resolution-review UI used from the citizen home/review queue.
- `tests/evidence/policy.test.ts`, `tests/evidence/media.test.ts`, `tests/evidence/resolution.test.ts` — Bun unit tests for deterministic rules, validation, and orchestration using injected fakes.

**Existing files to modify**

- `package.json` — add `test` script using Bun’s built-in runner; add no test dependency.
- `lib/db/types.ts` — align issue/profile/evidence types with migration and preserve legacy fields during rollout.
- `lib/agents/agent3-validation.ts` — produce structured signal results/assessment and persist it without changing urgency behavior.
- `lib/agents/pipeline.ts` — ensure intake review is explicitly intake-only and never implies closure verification.
- `app/api/reports/process/route.ts`, `app/report/page.tsx` — record media/location source/accuracy/capture metadata and pass private-media references to assessment.
- `app/api/reviews/route.ts`, `app/api/reviews/[issueId]/vote/route.ts` — derive user from auth session, validate intake-review eligibility, and leave its rules/status handling separate from resolution reviews.
- `app/api/admin/issues/[issueId]/route.ts` — reject direct `resolved` writes except through guarded adjudication; retain non-resolution admin edits.
- `components/admin/AdminDashboardClient.tsx`, `components/dashboard/DashboardClient.tsx` — surface evidence timeline, risks, and verification state without leaking private media.
- `mobile/lib/api/contracts.ts`, `mobile/lib/api/endpoints.ts`, and the relevant mobile issue/review screens — call the new authenticated routes and display/submit resolution review without reusing boolean intake votes.
- `mobile/hooks/useReviewQueue.ts`, `mobile/app/(citizen)/index.tsx` — update the existing intake queue auth contract and surface the separate resolution-review card/queue.
- `proxy.ts` — preserve existing route access behavior and ensure the new municipality dashboard path is protected; API authorization remains enforced in route handlers, not by proxy alone.
- `lib/ai/client.ts` — use existing `analyzeImage`/structured JSON helper from the server-only completion assessor; no new AI provider/dependency.
- `supabase/migrations/20260625082016_init_schema.sql` — do not rewrite already-applied history; use it only to document/compare the initial schema. All schema change goes in a new migration.

## Interfaces fixed by this plan

- `EvidenceSignalResult`: `{ key, outcome: 'supports' | 'neutral' | 'contradicts' | 'unknown' | 'not_applicable', weight: number | null, reason: string, source: string | null, observedAt: string | null, freshness: 'fresh' | 'stale' | 'unknown' }`.
- `EvidenceAssessment`: `{ id, issueId, stage: 'report' | 'municipal_completion', version, confidenceIndex: number, evidenceCoverage: number, riskLevel: 'low' | 'medium' | 'high', riskFlags: string[], signals: EvidenceSignalResult[], explanation: string, policyVersion: string, modelId: string | null, createdAt: string }`. No chain-of-thought is persisted.
- `ResolutionVerificationState`: `'not_claimed' | 'awaiting_proof' | 'awaiting_community' | 'verified' | 'disputed' | 'unverified'`.
- Resolution review verdict: `'fixed' | 'partially_fixed' | 'still_present' | 'cant_tell'`.
- `POST /api/issues/:id/completion`: session-authenticated, active municipal member only; JSON carries action note, completion time, capture location/source/accuracy if known, and uploaded storage keys. Server checks issue/dept scope and storage ownership before recording claim. Response includes claim/event IDs and resulting verification state.
- `GET /api/issues/:id/resolution-review`: session-authenticated; returns safe issue/evidence summary, active round, aggregate counts, user eligibility/previous response, and short-lived signed media URLs only when authorized.
- `POST /api/issues/:id/resolution-review`: session-authenticated; `{ verdict, comment?, evidenceStorageKeys? }`; no `userId` or caller-supplied distance is trusted. Response includes outcome/state and aggregate counts.
- `POST /api/admin/issues/:id/adjudication`: existing admin session only; `{ decision: 'verify' | 'reopen' | 'keep_disputed' | 'mark_unverified', reason }`. `verify` and overrides require a non-empty reason and append an event.
- Private bucket key format: `{auth.uid()}/{issueId}/{uuid}.{validatedExtension}`. Never return a permanent public URL for original evidence.

## Task 1 — Verify runtime schema and establish test harness

**Files:** `package.json`; add `tests/evidence/policy.test.ts`; add `docs/superpowers/plans/evidence-schema-inventory.md` only if runtime schema differs materially from the spec’s reported drift.

1. Read `supabase/schema.json`, all `supabase/migrations`, and route-selected/updated columns in `app/api/reviews/**`, `app/api/admin/issues/**`, `lib/agents/agent3-validation.ts`, and the mobile API contracts. Produce `docs/superpowers/plans/evidence-schema-inventory.md` with required columns, constraints, buckets, and role conventions. If a safe read-only Supabase schema query is available, compare it without printing or persisting secrets; do not make remote changes.
2. Add `"test": "bun test"` to `package.json`; create a minimal Bun test proving `bun test tests/evidence/policy.test.ts` discovers and passes a test. Use only `bun:test`.

**Verification:** `bun test tests/evidence/policy.test.ts`; `bun run lint`; verify `git status --short` shows no unrelated file changes were made.

## Task 2 — Define evidence contracts and deterministic assessment policy

**Files:** `lib/evidence/types.ts`, `lib/evidence/policy.ts`, `tests/evidence/policy.test.ts`, `lib/db/types.ts`.

1. Write Bun tests for: unknown/not-applicable exclusion, neutral evidence, contradictory evidence, no usable signals, risk flags forcing review, three distinct fixed reviews, duplicates/own-report/staff reviews ineligible, any `still_present` dispute, partial completion remaining in progress, expiry producing `unverified`, and repeat transitions being idempotent.
2. Implement pure functions `buildEvidenceAssessment(input, policy)`, `requiresHumanReview(assessment)`, `evaluateResolutionReviews(reviews, policy)`, and `canTransitionResolutionState(from, to, actor, evidence)` to pass those tests. For each factor the category policy marks applicable, use supports=1, neutral=0.5, contradicts=0 and calculate the weighted mean ×100 over observed applicable factors using weights (media relevance 3; location consistency 2; nearby/cluster context 1; applicable weather 1; queried event context 1). Coverage is observed applicable weight divided by the weight of all factors applicable under the category policy; unknown is omitted from the score but remains in the coverage denominator, and not_applicable is excluded from both. Conflicts remain explicit risk flags and are not averaged away from review routing. When no usable factor exists, return neutral index 50 with 0 coverage and `insufficient_evidence`; UI labels this **insufficient evidence**, not 50% probability. Explain that the index is not calibrated probability.
3. Define initial configurable policy values: intake review at confidence `<55` or any high risk/conflict/system-failure flag; completion assessment “strong” at `>=80`, independent community quorum of 3 distinct eligible `fixed` reviews, review window 72 hours. Initial high-risk flags are emergency or severity >=8, media/location mismatch, possible exact media reuse, material contradiction, and model/source failure; keep flag rules and any distance/freshness thresholds in the versioned policy and tune only with adjudicated data. Any `still_present` response, high completion risk, or contradictory evidence goes to dispute/manual review. No automatic closure from AI alone; only strong evidence plus quorum may trigger `verified`. Keep policy version string explicit so thresholds are auditable and changeable.
4. Add discriminated unions and optional/new row fields in `lib/db/types.ts`; retain current `ValidationResult`/legacy score compatibility while API/UI rollout is incremental.

**Verification:** `bun test tests/evidence/policy.test.ts`; `bun run lint`.

## Task 3 — Add forward-only evidence schema and private media storage

**Files:** `supabase/migrations/20261010000000_evidence_verification.sql`; optionally `supabase/README.md` or schema inventory from Task 1.

1. Create a forward-only migration after inventory. Add `issue_evidence` (stage, submitter, role/source, private object key, mime/size/hash, submitted/capture time, optional capture location/source/accuracy, action note); `evidence_assessments` (stage, versioned score/coverage/risk, JSONB factor records, summary, model/policy IDs); `evidence_reviews` (resolution round, reviewer, four-option verdict, optional evidence/comment, created time, unique issue+round+reviewer); and append-only `issue_events` (actor, event type, prior/new state, reason, evidence/assessment/review references, timestamp). Add `resolution_verification_state` and review deadline/round columns to issues; index issue/time and active-review lookup. Add `municipal_staff_memberships` linked to profile/department, with active/approved-by metadata. Add checks for enum values, score bounds, media size/type metadata, and references.
2. Add the private `issue-evidence` Storage bucket (no public read). Storage RLS permits authenticated uploads only beneath the caller’s UID folder and only to allowed mime/size limits. Add read policies for issue reporter, authorized municipality staff, eligible reviewers, and admins through safe ownership/membership checks. Never grant public reads. Migration must be safe to apply once and must not modify the existing initial migration.
3. Add guarded SQL functions/RPCs for atomic resolution review submission and resolution-state transition. Derive `auth.uid()` inside functions where called by user sessions, enforce one vote per round and actor eligibility, and ensure events/review/state update are transactional. Restrict execute grants; if service role is used for agent persistence, keep that repository server-only and audit actor explicitly. Revoke update/delete of `issue_events` and prevent authenticated update/delete of assessment/evidence history except narrowly authorized retention cleanup.
4. Include safe rollback notes (disable new routes/policies; do not drop evidence) and a staging SQL verification query in migration comments/docs. Do not apply remotely in this task.

**Verification:** Do not start Supabase/Docker or install database tooling for this task (project decision is remote Supabase only). Validate migration syntax with an already-installed SQL checker if available; otherwise review SQL statically and provide read-only constraint/grant/policy verification queries for an operator to run against an approved disposable/staging project. Inspect function transaction behavior and record live-schema mismatch for rollout. `git diff --check`.

## Task 4 — Store private media and structured intake assessments

**Files:** `lib/evidence/media.ts`, `lib/evidence/repository.ts`, `lib/agents/agent3-validation.ts`, `app/api/reports/process/route.ts`, `app/report/page.tsx`, `tests/evidence/media.test.ts`, `tests/evidence/policy.test.ts`.

1. Test media key validation, disallowed MIME/size/extension, UUID/path traversal rejection, GPS source/accuracy parsing, and metadata sanitization. Implement strict allowlists and opaque storage paths in `lib/evidence/media.ts`.
2. Move new report uploads to private `issue-evidence` storage; record device-GPS vs map-pin source, browser-reported GPS accuracy, capture time when available, content SHA-256, mime, and size. Treat client metadata as untrusted. Backward compatibility: existing `issue-media` URLs remain readable for existing reports during migration; do not bulk-copy/delete user media in this plan.
3. Adjust pipeline image/video analysis to obtain a short-lived signed URL server-side only when needed. For video, sample keyframes only if supported by current runtime/tooling; otherwise mark video signal unknown and continue without blocking intake. Never save signed URLs as canonical evidence URLs.
4. Refactor Agent 3 to return structured signal records for media relevance, location consistency, nearby/cluster corroboration, weather when applicable, and external event context when actually queried. Record unavailable as unknown and irrelevant weather as not_applicable. Nearby cluster members count as correlated context; do not turn count into independent-vote multiplier. Persist assessment and an `intake_assessed` event through repository; retain legacy issue fields as derived compatibility fields only.
5. Keep emergency severity escalation independent of confidence/review. Agent failure records a review/system-failure risk and routes to manual/community review rather than rejecting or blocking a report.

**Verification:** `bun test tests/evidence/media.test.ts tests/evidence/policy.test.ts`; mock model/weather/search/storage in tests; assert no real credentials/network required. `bun run lint`; run type check via `bunx tsc --noEmit` if supported by project config.

## Task 5 — Separate intake review from resolution review and secure auth

**Files:** `app/api/reviews/route.ts`, `app/api/reviews/[issueId]/vote/route.ts`, `lib/evidence/resolution.ts`, `lib/evidence/repository.ts`, `app/api/issues/[issueId]/resolution-review/route.ts`, `tests/evidence/resolution.test.ts`.

1. Add tests proving request-body `userId`/distance cannot impersonate identity, unauthenticated calls fail, a citizen cannot vote on own issue, a municipal staff member cannot review its own completion claim, one response per round is enforced, and the four verdicts map to correct state transitions.
2. Implement shared `lib/auth/request-user.ts`: verify web cookie sessions with `createServerSupabaseClient()` and mobile `Authorization: Bearer <access_token>` via Supabase `auth.getUser(token)`; return the verified actor and a caller-scoped Supabase client that forwards that same user JWT to RLS/RPC. Never use service-role client to make citizen/staff decisions. Derive caller from this helper in new and existing review handlers. Refactor legacy GET review queue to use session identity/home location, not `?userId`; retain its 1 km eligibility radius, using PostGIS/RPC rather than treating unparseable location as eligible. Apply the same server-verified saved-home-location eligibility rule to resolution reviews; reviewer home location remains private and only eligibility/aggregate counts are returned. Keep legacy boolean vote API for intake only; update its response/validation and do not let intake quorum mark any resolution state.
3. Implement `lib/evidence/resolution.ts` with dependency-injected repository/RPC calls so policy tests can cover eligibility/quorum without Supabase. New review route validates UUID, enum, comments, evidence ownership/media and issue state; calls transactional RPC through the caller-scoped user client so `auth.uid()` is present; returns aggregate counts and state. Never accept caller verdict weight or distance.
4. Restrict response payloads: no reviewer precise location, no private storage keys, no raw signed URL beyond authorized short-lived requests. Rate-limit where existing infrastructure permits; rely on unique DB constraints as final anti-duplicate guard.

**Verification:** `bun test tests/evidence/resolution.test.ts`; route auth cases using injected dependencies or a staging integration test; `bun run lint` and `bunx tsc --noEmit`.

## Task 6 — Municipality completion claims and guarded admin adjudication

**Files:** `lib/evidence/assessor.ts`, `lib/evidence/resolution.ts`, `app/api/issues/[issueId]/completion/route.ts`, `app/api/admin/issues/[issueId]/adjudication/route.ts`, `app/api/admin/issues/[issueId]/route.ts`, `app/municipality/dashboard/page.tsx`, `components/municipality/MunicipalityDashboardClient.tsx`, admin staff membership provisioning UI/API (or documented admin-only SQL provisioning for pilot), `tests/evidence/resolution.test.ts`.

1. Test that citizen/inactive/unrelated-department accounts cannot submit a claim, an issue outside department scope is denied, missing proof leaves status in progress/unverified, AI alone cannot verify, and all admin decisions require recorded reason.
2. Implement active municipality membership checks using session ID plus `municipal_staff_memberships`; verify issue department/category scope. Support admin provisioning of membership or, for initial pilot, an explicit documented admin-only SQL onboarding procedure with no public self-service role escalation.
3. Implement `assessMunicipalCompletion(issue, claim, evidence)` in `lib/evidence/assessor.ts` using the existing Gemini wrapper’s structured image analysis: return media-to-claim/location factors and uncertainty only, with model/prompt version and concise user-safe explanation; pass the result into `lib/evidence/policy.ts` for deterministic score/risk. If image service fails or cannot inspect the media, mark signal unknown and require human review. Never ask the model for hidden chain-of-thought or treat it as a final closure authority.
4. Completion endpoint validates that uploaded files are in the authenticated user’s expected private path, records action note/time/location provenance, computes independent completion assessment against original evidence and issue location, opens a review round, sets state to `awaiting_community`, and appends claim/assessment events atomically. Maintain issue status `in_progress` until verified.
5. Implement admin adjudication for verify/reopen/keep-disputed/mark-unverified with non-empty reason, actor identity, linked evidence, transactional state/event changes, and idempotency. Human adjudicator can close after direct evidence review; record it as human decision, not automated quorum.
6. In `app/api/admin/issues/[issueId]/route.ts`, reject `status='resolved'` with 409 and a pointer to adjudication unless the operation is a supported audited override. Keep status/department edits otherwise. Award reporter resolution karma exactly once only after verified/adjudicated resolution; no penalty for low confidence or disputes.
7. Add `/municipality/dashboard` server page that checks active staff membership (rather than requiring the existing `profiles.role='admin'`) and renders only in-scope in-progress issues with `CompletionEvidenceForm`. Keep admin adjudication on the separate existing admin surface.

**Verification:** `bun test tests/evidence/resolution.test.ts`; integration checklist for staff/non-staff/department mismatch and repeated adjudication; `bun run lint`; `bunx tsc --noEmit`.

## Task 7 — Expiry, dispute, reopen, and auditable transitions

**Files:** `lib/evidence/resolution.ts`, migration RPC/function if needed, `app/api/issues/[issueId]/resolution-review/route.ts`, add `app/api/admin/resolution-reviews/expire/route.ts` only if no existing scheduler can invoke it, `tests/evidence/resolution.test.ts`.

1. Add fake-clock tests for open/closed review windows, expiry, late submissions, retries, and concurrent last-vote quorum. No response by 72 hours writes `unverified`, never `verified`. Late vote returns conflict and cannot rewrite a closed round.
2. Implement expiry via an idempotent database function callable by a scheduled Cloud Run job or trusted admin operation; do not use per-process `setTimeout` in Next.js/Cloud Run. Document the existing Cloud Run scheduler/job command needed to invoke it; scheduler wiring is a separate deployment operation if no scheduler is configured.
3. `still_present` or material contradiction transitions to `disputed`, preserves `in_progress`/reopened operational handling, notifies reporter/department, and supports human reopen with reason. Partial completion preserves `in_progress`, requests new proof, and refreshes SLA only through recorded policy/action.
4. Make issue status, resolution state, karma, and event insertion atomic/idempotent through RPC/transaction. Do not use application-side “query then insert” as concurrency protection.

**Verification:** `bun test tests/evidence/resolution.test.ts`; SQL concurrency test submits simultaneous quorum-crossing votes and confirms one outcome/event/karma credit; inspect timeline ordering and state history.

## Task 8 — Citizen/admin evidence timelines and mobile workflows

**Files:** `app/api/issues/[issueId]/evidence/route.ts`, `components/evidence/EvidenceTimeline.tsx`, `components/admin/CompletionEvidenceForm.tsx`, `components/dashboard/ResolutionReviewCard.tsx`, `components/admin/AdminDashboardClient.tsx`, `components/dashboard/DashboardClient.tsx`, `mobile/lib/api/contracts.ts`, `mobile/lib/api/endpoints.ts`, `mobile/hooks/useReviewQueue.ts`, `mobile/app/(citizen)/index.tsx`, `mobile/components/community/ResolutionReviewCard.tsx`, `tests/evidence/*`.

1. Add route tests verifying timeline actor privacy, safe public fields, event order, permissions for private evidence, signed URL expiry, and precise location redaction. Timeline includes intake and resolution as distinct tracks; confidence is labeled an index, with coverage and factor-level supports/contradictions/unknowns, risk flags, source times, assessment/model-policy version, and human-readable decision basis.
2. Add the evidence timeline to the existing citizen issue presentation/dashboard and resolution response UI with fixed/partial/still-present/can’t-tell actions, accessible labels, optional media/note, review expiry, and aggregate counts; show no reviewers’ identity/precise distance.
3. Add admin issue-detail completion evidence panel, department-scoped submission UX, dispute queue and adjudication reason form. Completion upload visibly says “claim submitted / awaiting verification,” not “resolved.”
4. Update mobile API contracts/endpoints and the existing review hook/home screen to use the new route and verdict union. Add `mobile/components/community/ResolutionReviewCard.tsx` and place it in the citizen home queue. The current mobile tree has no issue-detail/review feature directories; do not assume they exist. Do not add a second community-review backend or directly write review rows from the client. If existing untracked mobile files differ at implementation time, inspect before editing and preserve unrelated user changes.
5. Realtime refresh may listen to issue state/event changes, but fetch private evidence through authorized routes only. Keep public map markers free of proof media and individual reviewer metadata.

**Verification:** component tests if a UI test harness is introduced only after checking current dependencies; otherwise add manual browser/device scenarios to the acceptance checklist and run production build. Test small viewport, keyboard/screen-reader labels, expired review state, private media access denied, and bilingual/localized copy fallback.

## Task 9 — Calibrate, roll out safely, and document operations

**Files:** `docs/superpowers/specs/2026-10-10-credible-evidence-validation-design.md` (append implementation decisions/calibration status only if desired), `docs/evidence-verification-operations.md`, `tests/evidence/fixtures/*`, policy tests, migration validation.

1. Build a de-identified labeled fixture set from adjudicated examples across categories (real/false/inconclusive intake and fixed/partial/not-fixed completion). Do not use raw household media in committed fixtures. Write evaluation script/report for confidence calibration, category/ward coverage, error rates, and false-closure reversals; never treat model self-reported confidence as truth.
2. Start in **shadow mode**: persist/show assessments to internal admins but do not auto-change status. Review false negatives, mismatch causes, weather relevance, cluster correlation, and bias by ward/category; document thresholds and policy version. Enable community claims/reviews only after staff provisioning, RLS, retention, and manual dispute workflow pass staging.
3. Enable automated verified transition only after a municipal/community pilot approves the fixed policy (`>=80`, strong evidence, no high risk/conflict, quorum 3, all fixed within 72h); high risk, any `still_present`, no quorum, or uncertain media always requires human review/unverified. Keep a feature flag to disable automatic transition without disabling evidence/audit capture.
4. Add operational runbook: membership onboarding/offboarding, private media access/retention/deletion, migration apply/rollback, scheduler invocation, incident handling for false closure/privacy breach, and KPI review (disagreement, participation, time-to-verification, coverage, reversal, calibration by category/ward).

**Verification:** run `bun test`; `bun run lint`; `bunx tsc --noEmit`; `bun run build`; execute staging acceptance cases using non-production accounts/media and confirm feature-off fallback. No remote migration/automation flag activation without operator approval.

## Cross-cutting acceptance checklist

- [ ] Intake and completion expose versioned 0–100 confidence index, coverage, independent risk flags, factor explanation, source/time, unknown/not-applicable; index explicitly not a probability until calibrated.
- [ ] Unknown, not-applicable, absent media/weather/reports do not count as contradiction; unavailable services route conservatively and urgent reports remain actionable.
- [ ] Intake community review never approves resolution. Municipality media alone never makes issue resolved.
- [ ] Authorized municipality evidence, action/time/location provenance, structured assessment, independent eligible quorum or audited human adjudication, and immutable event are required for verified resolution.
- [ ] No quorum/time expiry is `unverified`; partial is still in progress; `still_present` disputes/reopens without deleting history.
- [ ] Session identity, staff membership, department scope, RLS, private evidence access, unique votes, idempotent transaction, and audit trail are enforced server/database-side.
- [ ] Citizens cannot access private originals/reviewer exact locations; no karma penalty for confidence/dispute; no automated false-report declaration.
- [ ] Existing issues and public `issue-media` links still work during migration; guarded status changes do not block unrelated admin updates.
- [ ] Web and mobile show consistent lifecycle and never call the intake boolean endpoint for resolution confirmation.
- [ ] `bun test`, lint, type-check, production build, staging security checklist, and rollout runbook pass.

## Review focus

1. **Schema/live drift:** migration must not assume fields/policies from the initial SQL match remote Supabase; verify all current APIs, mobile direct table access, and existing Storage policies before applying.
2. **Authorization/RLS:** the current review endpoint trusts caller-supplied `userId`; no new route may. Service-role helpers bypass RLS, so route-level session/membership checks and atomic DB constraints must be tested explicitly.
3. **Closure race/idempotency:** concurrent final reviews, duplicate requests, retries, and expiry can race. State, event, and one-time karma changes must commit atomically.
4. **Evidence/privacy:** GPS/EXIF may be spoofed or sensitive; private objects, temporary signed URLs, redaction, retention, and no public exact reviewer coordinates must be covered.
5. **Score semantics:** unknown/missing is not contradiction; 50 with zero coverage means insufficient evidence, not a probability. No automation until adjudicated evaluation and pilot sign-off.

## Execution verification commands

```bash
bun test
bun run lint
bunx tsc --noEmit
bun run build
git diff --check
```

Run SQL tests against disposable/staging Supabase only. Do not place `.env.local`, service-role secrets, real GPS traces, or original media in fixtures or commits.
