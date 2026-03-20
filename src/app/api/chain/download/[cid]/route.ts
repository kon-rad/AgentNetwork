import { downloadFromFilecoin } from '@/lib/chain/filecoin'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ cid: string }> },
): Promise<Response> {
  const { cid } = await params

  try {
    const content = await downloadFromFilecoin(cid)

    return Response.json(content, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[filecoin download] Failed to retrieve CID ${cid}:`, message)

    return Response.json({ error: 'Content not found for CID' }, { status: 404 })
  }
}
