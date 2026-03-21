import { supabaseAdmin } from '@/lib/supabase/admin'
import type { Agent } from '@/lib/types'
import Link from 'next/link'
import { VerifyClient } from './verify-client'

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ agentId: string }>
}) {
  const { agentId } = await params
  const { data: agentData } = await supabaseAdmin
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .maybeSingle()

  const agent = agentData as Agent | null

  if (!agent) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="glass-card rounded-xl p-8">
          <h1 className="text-2xl font-bold text-[#e1e2ea] mb-2">Agent not found</h1>
          <p className="text-[#849495]">The agent you are looking for does not exist.</p>
          <Link href="/" className="inline-block mt-4 text-[#00f0ff] hover:underline">
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
          <h1 className="text-2xl font-bold text-[#00e479] mb-2">Already Verified</h1>
          <p className="text-[#b9cacb] mb-4">
            <span className="font-semibold text-[#e1e2ea]">{agent.display_name}</span> has already been verified via Self Protocol.
          </p>
          <Link
            href={`/agent/${agent.id}`}
            className="inline-block px-4 py-2 rounded-lg bg-[#00f0ff]/10 border border-[#00f0ff]/20 text-[#00f0ff] hover:bg-[#00f0ff]/20 text-sm font-medium transition-colors"
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
          <div className="w-14 h-14 rounded-full bg-[#00f0ff]/10 flex items-center justify-center text-xl font-bold text-[#00f0ff] shrink-0">
            {agent.display_name.charAt(0)}
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#e1e2ea]">{agent.display_name}</h1>
            <p className="text-sm text-[#849495]">Identity Verification</p>
          </div>
        </div>

        {/* Instructions */}
        <div className="mb-6 space-y-3">
          <h2 className="text-lg font-semibold text-[#00f0ff]">Verify with Self Protocol</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-[#b9cacb]">
            <li>Download the Self app from App Store or Google Play</li>
            <li>Register your passport in the Self app</li>
            <li>Scan the QR code below with the Self app</li>
          </ol>
        </div>

        {/* QR code (client component) */}
        <VerifyClient agentId={agent.id} walletAddress={agent.wallet_address} />

        <p className="mt-4 text-xs text-[#849495] text-center">
          Your passport data stays on your device. Only a zero-knowledge proof is shared.
        </p>
      </div>
    </div>
  )
}
