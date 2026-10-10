import { MESH_CONFIG, type MeshConfig } from '@/lib/mesh/config'

/**
 * Per-peer rate limiting and abuse scoring. Entirely in memory: a restart gives every
 * peer a clean slate, which is acceptable because the relay session is user-initiated.
 */
export class PeerLimiter {
  private readonly frames = new Map<string, { start: number; count: number }>()
  private readonly violations = new Map<string, number>()
  private readonly sends = new Map<string, { start: number; count: number }>()
  private readonly bans = new Map<string, number>()

  constructor(private readonly config: MeshConfig = MESH_CONFIG) {}

  /** Count one inbound frame. False means the peer is over its allowance: drop the frame. */
  allowFrame(endpointId: string, now: number): boolean {
    const slot = this.frames.get(endpointId)
    if (!slot || now - slot.start >= this.config.peerWindowMs) {
      this.frames.set(endpointId, { start: now, count: 1 })
      return true
    }
    slot.count += 1
    return slot.count <= this.config.peerFramesPerWindow
  }

  /** Record misbehaviour. Returns true when the peer has now earned a ban. */
  violation(endpointId: string): boolean {
    const n = (this.violations.get(endpointId) ?? 0) + 1
    this.violations.set(endpointId, n)
    return n >= this.config.peerMaxViolations
  }

  ban(nodeId: string, now: number): void {
    this.bans.set(nodeId, now + this.config.banMs)
  }

  isBanned(nodeId: string, now: number): boolean {
    const until = this.bans.get(nodeId)
    if (until === undefined) return false
    if (until <= now) {
      this.bans.delete(nodeId)
      return false
    }
    return true
  }

  /** How many alerts may still be sent to this node in the current minute. */
  sendBudget(nodeId: string, now: number): number {
    const slot = this.sends.get(nodeId)
    if (!slot || now - slot.start >= 60_000) return this.config.peerSendsPerMinute
    return Math.max(0, this.config.peerSendsPerMinute - slot.count)
  }

  noteSent(nodeId: string, count: number, now: number): void {
    const slot = this.sends.get(nodeId)
    if (!slot || now - slot.start >= 60_000) this.sends.set(nodeId, { start: now, count })
    else slot.count += count
  }

  resetConnection(endpointId: string): void {
    this.frames.delete(endpointId)
    this.violations.delete(endpointId)
  }
}
