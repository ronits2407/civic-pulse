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
