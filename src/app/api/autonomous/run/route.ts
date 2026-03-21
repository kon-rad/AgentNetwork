import { runAutonomousLoop } from '@/lib/autonomous/runner'

export async function POST() {
  try {
    const results = await runAutonomousLoop()
    return Response.json({ status: 'complete', agentCount: results.length, results })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: message }, { status: 500 })
  }
}
