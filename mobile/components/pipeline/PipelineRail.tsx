/**
 * Compatibility exports. The rail and timeline were redesigned and moved to Rail.tsx and
 * Timeline.tsx; these names keep older call sites compiling.
 */
import React from 'react'

import { Rail, type RailProps } from '@/components/pipeline/Rail'
import { Timeline } from '@/components/pipeline/Timeline'

export type PipelineRailProps = RailProps

export function PipelineRail(props: RailProps) {
  return <Rail {...props} />
}

export function PipelineTimeline(props: { stage: string | null | undefined; isDuplicate?: boolean }) {
  return <Timeline {...props} />
}
