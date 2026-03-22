import { NextRequest } from 'next/server'
import { createPublicClient, http, erc20Abi, parseUnits, decodeEventLog, formatUnits } from 'viem'
import { base } from 'viem/chains'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/guard'

const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const
const USDC_DECIMALS = 6
const REQUIRED_AMOUNT = parseUnits('100', USDC_DECIMALS) // 100_000_000n

const publicClient = createPublicClient({ chain: base, transport: http() })

export async function POST(req: NextRequest) {
  // Auth check
  const sessionOrError = await requireAuth()
  if (sessionOrError instanceof Response) return sessionOrError
  const session = sessionOrError

  // Parse body
  let body: { tx_hash?: string; agent_id?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { tx_hash, agent_id } = body
  if (!tx_hash || typeof tx_hash !== 'string') {
    return Response.json({ error: 'tx_hash is required' }, { status: 400 })
  }
  if (!agent_id || typeof agent_id !== 'string') {
    return Response.json({ error: 'agent_id is required' }, { status: 400 })
  }

  // Duplicate check — UNIQUE constraint at DB layer, but check early for better UX
  const { data: existing } = await supabaseAdmin
    .from('subscriptions')
    .select('id')
    .eq('tx_hash', tx_hash)
    .maybeSingle()

  if (existing) {
    return Response.json({ error: 'Transaction already used' }, { status: 409 })
  }

  // On-chain verification
  let receipt: Awaited<ReturnType<typeof publicClient.getTransactionReceipt>>
  try {
    receipt = await publicClient.getTransactionReceipt({
      hash: tx_hash as `0x${string}`,
    })
  } catch {
    return Response.json({ error: 'Transaction not found or not confirmed' }, { status: 422 })
  }

  // Step 1: receipt must exist and be successful
  if (!receipt || receipt.status !== 'success') {
    return Response.json({ error: 'Transaction failed or reverted' }, { status: 422 })
  }

  // Step 2: find the USDC Transfer log
  const transferLog = receipt.logs.find(
    (log) => log.address.toLowerCase() === USDC_CONTRACT.toLowerCase()
  )
  if (!transferLog) {
    return Response.json({ error: 'No USDC transfer found in transaction' }, { status: 422 })
  }

  // Step 3: decode the Transfer event
  let decoded: ReturnType<typeof decodeEventLog<typeof erc20Abi, 'Transfer'>>
  try {
    decoded = decodeEventLog({
      abi: erc20Abi,
      data: transferLog.data,
      topics: transferLog.topics,
      eventName: 'Transfer',
    }) as ReturnType<typeof decodeEventLog<typeof erc20Abi, 'Transfer'>>
  } catch {
    return Response.json({ error: 'Failed to decode USDC Transfer event' }, { status: 422 })
  }

  const { to, value } = decoded.args as { from: string; to: string; value: bigint }

  // Step 4: confirm recipient is treasury
  const treasuryAddress = process.env.TREASURY_ADDRESS
  if (!treasuryAddress) {
    console.error('TREASURY_ADDRESS env var not set')
    return Response.json({ error: 'Server configuration error' }, { status: 500 })
  }
  if (to.toLowerCase() !== treasuryAddress.toLowerCase()) {
    return Response.json({ error: 'USDC was not sent to the treasury address' }, { status: 422 })
  }

  // Step 5: confirm amount >= 100 USDC (allow overpayment)
  if (value < REQUIRED_AMOUNT) {
    return Response.json(
      { error: `Insufficient payment: expected 100 USDC, got ${formatUnits(value, USDC_DECIMALS)} USDC` },
      { status: 422 }
    )
  }

  // Step 6: confirm sender matches session wallet
  if (receipt.from.toLowerCase() !== session.address!.toLowerCase()) {
    return Response.json({ error: 'Transaction sender does not match authenticated wallet' }, { status: 422 })
  }

  // Insert subscription
  const activatedAt = new Date()
  const expiresAt = new Date(activatedAt.getTime() + 30 * 24 * 60 * 60 * 1000)

  const { data: subscription, error: insertError } = await supabaseAdmin
    .from('subscriptions')
    .insert({
      owner_wallet: session.address!.toLowerCase(),
      agent_id,
      tx_hash,
      amount_usdc: Number(formatUnits(value, USDC_DECIMALS)),
      activated_at: activatedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      status: 'active',
    })
    .select()
    .single()

  if (insertError) {
    // Handle unique constraint violation on tx_hash (race condition)
    if (insertError.code === '23505') {
      return Response.json({ error: 'Transaction already used' }, { status: 409 })
    }
    console.error('Failed to insert subscription:', insertError)
    return Response.json({ error: 'Failed to create subscription' }, { status: 500 })
  }

  // NanoClaw registration with Soul.md (fire-and-forget — non-fatal)
  try {
    // Fetch template soul_md for CLAUDE.md content
    let claudeMdContent: string | undefined
    const { data: agentRow } = await supabaseAdmin
      .from('agents')
      .select('service_type')
      .eq('id', agent_id)
      .single()

    if (agentRow?.service_type) {
      const { data: template } = await supabaseAdmin
        .from('agent_templates')
        .select('soul_md')
        .eq('agent_type', agentRow.service_type)
        .single()
      claudeMdContent = template?.soul_md
    }

    await fetch(`${process.env.NANOCLAW_URL}/register-group`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-shared-secret': process.env.NANOCLAW_SECRET!,
      },
      body: JSON.stringify({
        agentId: agent_id,
        folder: agent_id,
        claudeMdContent,
      }),
    })
  } catch {
    // NanoClaw registration failure is non-fatal — subscription is still recorded
    console.error('NanoClaw registration failed — agent group not registered')
  }

  return Response.json(subscription, { status: 201 })
}
