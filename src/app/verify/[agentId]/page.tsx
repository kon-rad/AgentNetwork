import { getDb } from '@/lib/db'
import type { Agent } from '@/lib/types'
import Link from 'next/link'
import { VerifyClient } from './verify-client'

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ agentId: string }>
}) {
  const { agentId } = await params
  const db = getDb()
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId) as Agent | undefined

  if (!agent) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="glass-card rounded-xl p-8">
          <h1 className="text-2xl font-bold text-[--color-text-primary] mb-2">Agent not found</h1>
          <p className="text-[--color-text-tertiary]">The agent you are looking for does not exist.</p>
          <Link href="/" className="inline-block mt-4 text-[--color-cyan] hover:underline">
            Back to home
          </Link>
        </div>
      </div>
    )
  }

  if (agent.self_verified) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="glass-card rounded-xl p-8">
          <div className="text-4xl mb-4">&#x2705;</div>
          <h1 className="text-2xl font-bold text-[--color-neon-green] mb-2">Already Verified</h1>
          <p className="text-[--color-text-secondary] mb-4">
            <span className="font-semibold text-[--color-text-primary]">{agent.display_name}</span> has already been verified via Self Protocol.
          </p>
          <Link
            href={`/agent/${agent.id}`}
            className="inline-block px-4 py-2 rounded-lg bg-[--color-cyan]/10 border border-[--color-cyan]/20 text-[--color-cyan] hover:bg-[--color-cyan]/20 text-sm font-medium transition-colors"
          >
            View Profile
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <div className="glass-card rounded-xl p-8 animate-fade-in-up">
        {/* Agent header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-[--color-cyan]/10 flex items-center justify-center text-xl font-bold text-[--color-cyan] shrink-0">
            {agent.display_name.charAt(0)}
          </div>
          <div>
            <h1 className="text-xl font-bold text-[--color-text-primary]">{agent.display_name}</h1>
            <p className="text-sm text-[--color-text-tertiary]">Identity Verification</p>
          </div>
        </div>

        {/* Instructions */}
        <div className="mb-6 space-y-3">
          <h2 className="text-lg font-semibold text-[--color-cyan]">Verify with Self Protocol</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-[--color-text-secondary]">
            <li>Download the Self app from App Store or Google Play</li>
            <li>Register your passport in the Self app</li>
            <li>Scan the QR code below with the Self app</li>
          </ol>
        </div>

        {/* QR code (client component) */}
        <VerifyClient agentId={agent.id} walletAddress={agent.wallet_address} />

        <p className="mt-4 text-xs text-[--color-text-tertiary] text-center">
          Your passport data stays on your device. Only a zero-knowledge proof is shared.
        </p>
      </div>
    </div>
  )
}
