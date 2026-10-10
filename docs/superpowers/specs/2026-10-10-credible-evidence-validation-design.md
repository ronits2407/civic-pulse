# Credible Evidence Validation and Resolution Verification

**Status:** Design for review  
**Date:** 2026-10-10  
**Scope:** Design only; no implementation or database changes are included.

## Goal

Make CivicPulse reports and closure decisions more trustworthy, explainable, and contestable. Assess whether a reported problem is plausible at the stated place, then separately assess whether the municipality has actually fixed it. Citizens and staff should be able to see what evidence supports a decision, what is uncertain, and how to challenge it.

**Principle:** AI assists triage; it does not declare a citizen dishonest or prove that work is complete. Missing, unavailable, or inconclusive evidence is not evidence against a report.

## Current state and design boundary

Agent 3 currently produces a 1–10 credibility score, short reasoning, a weather flag, and a boolean community-review request. It can query Open-Meteo and web search, but it does not persist a structured per-signal evidence record. The LangGraph interrupt for community review continues to resolution generation; that review is therefore not proof of completion. The existing `verifications` table/API supports a boolean vote for intake review, while the admin issue endpoint can set `status='resolved'` directly. There is no first-class municipal completion evidence or distinct resolution-verification state.

Keep **intake credibility** and **resolution verification** as separate assessments with separate histories and decisions. Do not reinterpret the existing intake score or community votes as closure proof. Existing schema and runtime routes have some drift (for example, review fields/statuses differ across the initial migration and API); implementation must inspect the live Supabase schema and reconcile it deliberately rather than assume the initial migration is the current database contract.

## User-facing lifecycle

### 1. Report and intake assessment

1. A citizen submits a description, media if available, and a location. Record whether the location came from device GPS or a map pin, GPS accuracy where available, and capture/submission times; do not imply that a map pin is device-verified.
2. Agent 3 gathers applicable signals: media relevance, location consistency, nearby reports, and relevant weather or public-event context. It records each signal as **supports**, **neutral**, **contradicts**, or **unknown**, with a short reason and source/time. “Not applicable” is distinct from “unknown.”
3. Produce a **0–100 confidence index** and a separate **risk level/flags**. Show the strongest supporting and conflicting factors and missing evidence. The index is not a calibrated probability until validated against adjudicated cases.
4. Low confidence, high risk, conflicting signals, or system failure routes to human/community review; it must not silently reject a report or block urgent safety escalation. A high-confidence report may proceed without intake review, but that does not pre-approve its eventual resolution.

### 2. Municipality claims completion

An authenticated, municipality-authorized staff member marks work as completed and submits:

- One or more completion photos, or a short video (video analysis uses sampled keyframes in the first version).
- A concise action/work note and completion time.
- Capture location and source/accuracy where available; staff may explain why capture is remote or location is unavailable.
- Authenticated staff identity and department; do not treat a free-text name or a citizen account as municipal provenance.

This creates a **completion claim**, not a resolved issue. Keep the issue operationally in progress while evidence is evaluated. Assess completion media against the original report’s location, issue type, and media; explain matches, mismatch, staleness, and uncertainty.

### 3. Independent community check and decision

Invite eligible nearby citizens to answer: **fixed**, **partially fixed**, **still present**, or **can’t tell**. Permit optional fresh photo/video and a brief note. Reviewers must not include the reporter or the staff submitter; allow one response per account per review round. Use proximity and recency as eligibility/evidence context, not as proof by themselves. Show aggregate counts and dissent without exposing reviewers’ precise locations.

Use a configurable quorum, initially at least three distinct eligible reviewers. A strong evidence assessment plus a quorum of independent “fixed” responses may automatically verify resolution. A “still present” response, material media/location conflict, insufficient quorum, or high risk routes to dispute/manual review; partial completion remains in progress with a new action/SLA. “Can’t tell” and no response do not count as confirmation. If the review window expires without quorum, record **unverified** and notify the municipality/citizen; never convert silence to approval.

After verification, set issue status to resolved and record who/what established it. A credible contradiction reopens the issue or places it in a disputed state pending review; safety-critical reports get an immediate escalation path. Only an authorized human adjudicator may make an adverse finding of false closure. Preserve earlier claims and decisions in the timeline.

## Confidence, risk, and evidence rules

- Keep confidence and risk separate: confidence describes support for a specific claim; risk describes the consequence of a wrong automated decision (for example, a serious hazard, sensitive location, or contradictory evidence). High risk can require review even with high confidence.
- Represent factor results, source, source timestamp, freshness, applicability, and limitations as structured data. Version the scoring policy and model/prompt identifier. Retain concise rationale and evidence references, not private chain-of-thought.
- Compute the index from versioned, configurable factor weights using applicable/available evidence only; record missingness and correlated sources. Nearby reports in one cluster count as correlated context, not multiple independent witnesses. Do not treat absent media, absent nearby reports, or unavailable weather as negative evidence.
- Weather is used only when relevant to the issue and time window. It can corroborate or contextualize (such as recent rainfall for flooding), but cannot independently prove the issue or disprove a report. Record provider, query time, and the observation window.
- GPS establishes location confidence, not issue truth. Compare reported location, capture location, and device accuracy where available. Treat EXIF/device metadata as spoofable and never disclose a verifier’s precise location publicly.
- AI image/video analysis identifies semantic matches and possible concerns; it cannot certify that media is original or unaltered. Preserve a content hash and provenance metadata; treat automated reuse/manipulation checks as risk flags, not fraud findings.
- Show separate intake and resolution confidence, evidence factor explanations, risk flags, review state, and last-updated time in the citizen/admin timeline. Make the same decision understandable without exposing private media or personal data.

## Data and service design

Use Supabase/Postgres/PostGIS as the source of truth; retain Gemini through the existing AI wrapper and keep rules/scoring deterministic and versioned outside free-form model output. Extend the report pipeline’s Agent 3 assessment, but run completion assessment/review as a separate workflow so it cannot be mistaken for intake validation.

Add an append-only evidence/audit model (table names are proposed, not migration instructions):

- **`issue_evidence`**: issue, stage (`report`, `municipal_completion`, `community_followup`), submitter and role, protected storage key, media type, capture/submission time, optional capture location/source/accuracy, content hash, and sanitized metadata.
- **`evidence_assessments`**: issue, stage, version, confidence index, risk level/flags, structured factor results and evidence references, concise explanation, provider/model/prompt and policy versions, and timestamp.
- **`evidence_reviews`**: issue, review round, reviewer, verdict, optional evidence reference, eligibility context, and timestamp; unique reviewer per issue/round. Keep intake verification semantics separate from resolution reviews.
- **`issue_events`**: append-only state transition log with actor, prior/new state, reason, linked evidence/assessment/review IDs, and timestamp. Do not rely on mutable issue columns as the only audit record.

Keep the issue’s existing operational status separate from a dedicated resolution-verification state (for example: `not_claimed`, `awaiting_proof`, `awaiting_community`, `verified`, `disputed`, `unverified`). A verified transition to `resolved` must go through a server-side guarded operation that checks authorization, evidence, quorum/policy or explicit human adjudication, and idempotently records the event. Remove direct client/admin status mutation as a bypass for verified closure; allow a documented privileged override with reason and audit event.

Add authenticated endpoints/actions for staff completion claims and media, resolution-review retrieval/submission, and adjudicator decisions. Derive actor identity from the Supabase session, not a caller-supplied `userId`. Restrict staff actions to authorized municipal accounts/departments; the current citizen/admin role model needs an explicitly verified municipal-staff role or equivalent authorization mapping. Enforce RLS/server authorization, unique votes, transition validation, and idempotent writes. Never expose the service-role key to clients.

Store originals in a private evidence bucket with short-lived authorized URLs. Public views use approved/redacted derivatives and coarse location. Strip or protect unnecessary EXIF, faces, license plates, minors, and sensitive household details; define retention and deletion rules while preserving hashes and required audit metadata. Do not penalize reporters for low AI confidence or a disputed closure. Avoid rewards that incentivize voting volume over accurate firsthand review.

## Decision thresholds and operations

Initial thresholds and quorum are policy configuration, not facts learned by the model. Start conservatively: no automatic rejection; no automatic closure from AI alone; require strong resolution evidence and the configured independent-review quorum for automated verification; otherwise request evidence or human review. Maintain an auditable manual override. Track false-closure reversals, disagreement rates, reviewer participation, time to verified resolution, evidence coverage, and confidence calibration by category/ward. Review thresholds with municipal operators and community representatives before expanding automation.

## Delivery sequence

1. **Evidence foundation:** schema/RLS/storage, event timeline, signal schema, structured intake assessment, explanations, and manual review fallback. Preserve current report intake behavior while distinguishing unknown from contradiction.
2. **Completion proof:** verified staff identity, upload/action claim, separate assessment and state, guarded admin workflow, citizen notification, and manual adjudication.
3. **Community confirmation:** eligible invitations, multi-option review, quorum and expiry, dispute/reopen behavior, and accessible evidence timeline.
4. **Calibration and hardening:** evaluate on adjudicated historical cases, tune/version thresholds, add media reuse signals and video keyframes, and monitor privacy, fairness, and reversals before widening automatic decisions.

## Acceptance criteria

- Every intake and completion assessment exposes a versioned confidence index, independent risk flags, factor-level reasons, evidence/source timestamps, and unknown/not-applicable signals.
- Missing or unavailable evidence never lowers a score as if it contradicted the claim; weather/nearby reports are used only within their stated limits.
- Intake review cannot be mistaken for resolution approval. A municipality completion upload alone leaves the issue unverified.
- A verified resolution has authenticated municipal provenance, linked completion evidence, a recorded decision basis, and either the configured independent review quorum or an explicit audited human decision.
- Insufficient participation yields unverified, and credible “still present” evidence can dispute/reopen a closure without erasing its history.
- Unauthorized users cannot submit municipal proof or alter verification outcomes; private media and verifier location are not publicly exposed.
- Urgent safety reports are not delayed by evidence review, and a low AI score alone cannot reject a report or penalize its reporter.