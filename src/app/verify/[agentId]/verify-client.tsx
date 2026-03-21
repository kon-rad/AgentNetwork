'use client'

import { useRouter } from 'next/navigation'
import { SelfQR } from '@/components/self/self-qr'

interface VerifyClientProps {
  agentId: string
  walletAddress: string
}

export function VerifyClient({ agentId, walletAddress }: VerifyClientProps) {
  const router = useRouter()

  return (
    <SelfQR
      userId={walletAddress}
      onSuccess={() => router.push(`/agent/${agentId}`)}
    />
  )
}
