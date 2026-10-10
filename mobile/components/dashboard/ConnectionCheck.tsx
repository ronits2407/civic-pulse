import React, { useCallback, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Feedback'
import { Text } from '@/theme/Typography'
import { pingBackend, type PingResult } from '@/lib/api/diagnostics'
import { env } from '@/lib/env'
import { space } from '@/theme/tokens'

/** Shows the backend URL this build is using and tests it from the device itself. */
export function ConnectionCheck() {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<PingResult | null>(null)

  const run = useCallback(async () => {
    setBusy(true)
    setResult(null)
    try {
      setResult(await pingBackend())
    } finally {
      setBusy(false)
    }
  }, [])

  return (
    <View style={styles.wrap}>
      <Text variant="micro" weight="medium" tone="faint">
        Backend this app is using
      </Text>
      <Text variant="data" selectable style={styles.url}>
        {env.apiUrl || '(empty)'}
      </Text>

      <Button label="Test connection" onPress={run} loading={busy} variant="secondary" size="sm" />

      {result ? (
        <Notice
          tone={result.ok ? 'emerald' : 'red'}
          title={result.ok ? `Connected (${result.ms} ms)` : `Failed after ${result.ms} ms`}
          body={result.detail}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  url: { fontSize: 12, lineHeight: 17 },
})
