/**
 * Minimal ambient declarations for the Expo build-time environment.
 *
 * Deliberately narrow: we declare only `process.env` rather than pulling in
 * @types/node, which would drag Node's globals (Buffer, process.exit, ...) into a
 * React Native project where they do not exist at runtime and would mask mistakes.
 *
 * Expo inlines `EXPO_PUBLIC_*` values into the bundle at build time; anything not
 * prefixed `EXPO_PUBLIC_` is undefined on the client.
 */
declare const process: {
  env: Record<string, string | undefined>
}

declare module '*.png' {
  const content: number
  export default content
}

// Minimal typings for the bun test runner, used only by lib/mesh/__tests__.
declare module 'bun:test' {
  export const describe: (name: string, fn: () => void) => void
  export const test: (name: string, fn: () => void | Promise<void>) => void
  export const it: typeof test
  export const beforeEach: (fn: () => void | Promise<void>) => void
  export const afterEach: (fn: () => void | Promise<void>) => void
  export const expect: (value: unknown) => any
}
declare module 'bun:sqlite' {
  export class Database {
    constructor(filename?: string)
    exec(sql: string): void
    query(sql: string): { all(...p: unknown[]): unknown[]; get(...p: unknown[]): unknown; run(...p: unknown[]): { changes: number } }
    close(): void
  }
}
declare module 'node:crypto' {
  export function createHash(alg: string): { update(d: string): { digest(enc: string): string } }
  export function randomUUID(): string
}
