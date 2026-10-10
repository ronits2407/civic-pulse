import type { SimTransport } from '@/lib/mesh/__tests__/sim'

/**
 * Simulated radio environment for engine tests.
 *
 * It reproduces the behaviours of expo-nearby-connections that the relay must survive:
 *  - range is explicit, so a three-phone line (A - B - C) with A and C out of range is real;
 *  - the dialling side issues the request, the other side gets an invitation and must accept;
 *  - a connection can fail SILENTLY (no event), exactly like the real library;
 *  - frames can be refused (send throws) or swallowed (sent but never arrives);
 *  - every delivered frame is logged, so a test can prove which phones really talked.
 *
 * It proves the PROTOCOL and ENGINE logic. It cannot prove anything about real radios.
 */

const settleOnce = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

export const settle = async (rounds = 8): Promise<void> => {
  for (let i = 0; i < rounds; i++) await settleOnce()
}

export interface FrameLog {
  from: string
  to: string
  kind: string
  delivered: boolean
}

export class SimNetwork {
  readonly nodes = new Map<string, SimTransport>()
  readonly log: FrameLog[] = []
  private readonly range = new Set<string>()
  /** Frames from these sim ids are accepted by the sender but never arrive. */
  readonly swallowFrom = new Set<string>()
  /** Frames from these sim ids are refused by the sender (send throws). */
  readonly refuseFrom = new Set<string>()

  private key = (a: string, b: string) => [a, b].sort().join('|')

  setRange(a: string, b: string, inRange: boolean): void {
    if (inRange) this.range.add(this.key(a, b))
    else this.range.delete(this.key(a, b))
  }

  inRange(a: string, b: string): boolean {
    return this.range.has(this.key(a, b))
  }

  /** Walk out of range: the link drops and both sides are told. */
  breakLink(a: string, b: string): void {
    this.setRange(a, b, false)
    this.nodes.get(a)?.dropLink(b)
    this.nodes.get(b)?.dropLink(a)
  }

  /** True if any frame was exchanged directly between the two phones. */
  talked(a: string, b: string): boolean {
    return this.log.some((f) => (f.from === a && f.to === b) || (f.from === b && f.to === a))
  }

  /** Frames of one kind delivered from `from` to `to`. */
  count(from: string, to: string, kind: string): number {
    return this.log.filter((f) => f.from === from && f.to === to && f.kind === kind && f.delivered).length
  }
}
