import React from 'react'

/**
 * Error boundary around the map surface.
 *
 * react-native-maps is a native module. It is present in Expo Go and in any build
 * produced from this project, but it can be absent in a host that was built against a
 * different native manifest. Rather than letting that take down the whole screen (and
 * with it reporting, tracking and verification), a failure is contained here and the
 * screen renders its fallback.
 */

export class MapErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    // Logged once, not surfaced: the fallback already explains the situation to the user.
    console.warn('[CivicPulse] Map surface unavailable:', error)
  }

  render() {
    if (this.state.failed) return this.props.fallback
    return this.props.children
  }
}
