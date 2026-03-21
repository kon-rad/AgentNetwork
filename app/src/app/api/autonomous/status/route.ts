import { getLastRunResults } from '@/lib/autonomous/runner'

export async function GET() {
  const results = getLastRunResults()
  return Response.json(
    { hasRun: results !== null, results },
    { headers: { 'Cache-Control': 'no-cache' } },
  )
}
