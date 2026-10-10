/**
 * Single bridge to the existing web domain types.
 *
 * The web app's `lib/db/types.ts` is pure TypeScript with no imports, so it can be
 * consumed by the mobile app without pulling in Next.js, DOM or Node code.
 *
 * IMPORTANT: this file uses `export type`, never `export *`. `export type` is fully
 * erased by Babel, so Metro never has to resolve a path outside the Expo project
 * root at runtime. That keeps this a compile-time-only coupling.
 *
 * If you need a runtime constant from the web app, copy it into `theme/tokens.ts`
 * (or a local module) instead of importing it here.
 */
export type {
  Issue,
  IssueCategory,
  IssueStatus,
  UserRole,
  Profile,
  Department,
  IssueCluster,
  Verification,
  IssueComment,
  KarmaEvent,
  PredictiveAlert,
  AgentState,
  ClassificationResult,
  DeduplicationResult,
  ValidationResult,
  ResolutionResult,
} from '../../lib/db/types'
