'use client'

import type { EvidenceAssessment, PublicIssueEvent } from '@/lib/evidence/types'
import { AssessmentCard } from '@/components/evidence/AssessmentCard'

interface EvidenceTimelineProps {
  assessments: EvidenceAssessment[]
  events: PublicIssueEvent[]
}

function eventLabel(type: string): string {
  return type.replace(/^admin_adjudication_/, 'admin decision: ').replace(/_/g, ' ')
}

function EventList({ events }: { events: PublicIssueEvent[] }) {
  if (events.length === 0) return <p className="text-xs text-muted-foreground">No activity recorded yet.</p>
  return (
    <ol className="relative border-l border-border ml-2 space-y-3">
      {events.map((e) => (
        <li key={e.id} className="ml-4">
          <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-[#17140f]" />
          <div className="text-xs font-semibold capitalize text-foreground">{eventLabel(e.eventType)}</div>
          {e.summary && <div className="text-xs text-muted-foreground">{e.summary}</div>}
          <div className="text-[10px] text-muted-foreground/70">
            {new Date(e.createdAt).toLocaleString()}
            {e.round ? ` - round ${e.round}` : ''}
          </div>
        </li>
      ))}
    </ol>
  )
}

const INTAKE_EVENT = /^(reported|intake_)/

/**
 * Dual-track timeline. Intake answers "is this plausible here and now?"; resolution answers
 * "did the municipality actually fix it?". Only public-safe fields are rendered: no reviewer
 * identities, coordinates or storage paths ever reach this component.
 */
export function EvidenceTimeline({ assessments, events }: EvidenceTimelineProps) {
  const intake = assessments.find((a) => a.stage === 'intake')
  const resolution = assessments.find((a) => a.stage === 'resolution')
  const intakeEvents = events.filter((e) => INTAKE_EVENT.test(e.eventType))
  const resolutionEvents = events.filter((e) => !INTAKE_EVENT.test(e.eventType))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-bold text-foreground">Intake credibility</h3>
          <p className="text-xs text-muted-foreground">Is this reported issue plausible at this place and time?</p>
        </div>
        {intake ? (
          <AssessmentCard assessment={intake} title="Report assessment" />
        ) : (
          <p className="text-xs text-muted-foreground">Assessment pending.</p>
        )}
        <EventList events={intakeEvents} />
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-bold text-foreground">Resolution verification</h3>
          <p className="text-xs text-muted-foreground">Did the municipality actually fix it on the ground?</p>
        </div>
        {resolution ? (
          <AssessmentCard assessment={resolution} title="Completion proof assessment" />
        ) : (
          <p className="text-xs text-muted-foreground">No completion claim yet.</p>
        )}
        <EventList events={resolutionEvents} />
      </section>
    </div>
  )
}
