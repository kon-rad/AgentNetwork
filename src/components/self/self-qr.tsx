'use client'

import { SelfAppBuilder, SelfQRcodeWrapper } from '@selfxyz/qrcode'
import { SELF_SCOPE, SELF_DISCLOSURES } from '@/lib/chain/self-config'

interface SelfQRProps {
  userId: string
  onSuccess: () => void
}

export function SelfQR({ userId, onSuccess }: SelfQRProps) {
  const selfApp = new SelfAppBuilder({
    appName: 'Network',
    scope: SELF_SCOPE,
    endpoint: `${window.location.origin}/api/self/verify`,
    endpointType: 'staging_celo',
    userId,
    userIdType: 'hex',
    disclosures: SELF_DISCLOSURES,
  } as any).build()

  return (
    <div className="glass-card rounded-xl p-6 border border-cyan-500/20 flex items-center justify-center">
      <SelfQRcodeWrapper
        selfApp={selfApp}
        onSuccess={onSuccess}
        onError={(err) => console.error('[Self QR] error:', err)}
        darkMode
      />
    </div>
  )
}
