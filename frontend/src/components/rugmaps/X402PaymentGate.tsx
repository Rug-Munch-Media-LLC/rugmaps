import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Crown, Loader2, Lock, Sparkles, Wallet, Zap } from 'lucide-react'
import { useState } from 'react'

interface X402PaymentGateProps {
  onUpgrade: (tier: 'premium' | 'pro' | 'enterprise') => void
  isConnected: boolean
  walletAddress?: string
  isCRMHolder?: boolean
}

const TIERS = [
  {
    id: 'premium' as const,
    name: 'Premium',
    price: 2.99,
    crmPrice: 1.49,
    scans: 'per scan',
    features: ['Full AI analysis', 'Bubble map', 'Bundling detection', 'Gas funding trace'],
    icon: Zap,
    color: '#F59E0B',
  },
  {
    id: 'pro' as const,
    name: 'Pro',
    price: 29,
    crmPrice: 14.99,
    scans: 'unlimited/mo',
    features: ['Everything in Premium', 'Historical playback', 'Cross-chain correlation', 'Export reports'],
    icon: Sparkles,
    color: '#8B5CF6',
  },
  {
    id: 'enterprise' as const,
    name: 'Enterprise',
    price: 299,
    crmPrice: 149.99,
    scans: 'unlimited/mo',
    features: ['Everything in Pro', 'API access', 'Custom chains', 'Priority support'],
    icon: Crown,
    color: '#06B6D4',
  },
]

export default function X402PaymentGate({ onUpgrade, isConnected, walletAddress, isCRMHolder }: X402PaymentGateProps) {
  const [selectedTier, setSelectedTier] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)

  const handlePay = async (tier: (typeof TIERS)[0]) => {
    setSelectedTier(tier.id)
    setProcessing(true)

    // In production: x402 payment flow
    // 1. Get payment requirements from backend
    // 2. Sign transaction with wallet
    // 3. Submit proof to backend
    // 4. Unlock premium features

    setTimeout(() => {
      setProcessing(false)
      onUpgrade(tier.id)
    }, 2000)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-[16px] p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-[9px] bg-[#F59E0B]/10 flex items-center justify-center">
          <Lock className="w-[15px] h-[15px] text-[#F59E0B]" />
        </div>
        <div>
          <h3 className="text-[14px] font-semibold text-[#F1F1F6]">Unlock Premium</h3>
        </div>
        {isCRMHolder && (
          <span className="badge badge-live text-[9.5px] ml-auto">
            <Crown className="w-3 h-3" /> 50% CRM Discount
          </span>
        )}
      </div>

      {!isConnected && (
        <div className="p-3 rounded-[10px] bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)] mb-3">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-[#5C6080]" />
            <span className="text-[11px] text-[#9DA0B0]">Connect wallet to unlock premium scans</span>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {TIERS.map((tier) => {
          const Icon = tier.icon
          const price = isCRMHolder ? tier.crmPrice : tier.price
          const isSelected = selectedTier === tier.id

          return (
            <div
              key={tier.id}
              className={`p-3 rounded-[10px] border cursor-pointer transition-all ${
                isSelected
                  ? 'bg-[rgba(255,255,255,0.04)] border-purple-500/30'
                  : 'bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.04)] hover:border-[rgba(255,255,255,0.08)]'
              }`}
              onClick={() => setSelectedTier(tier.id)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4" style={{ color: tier.color }} />
                  <span className="text-[13px] font-semibold text-[#F1F1F6]">{tier.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-[14px] font-bold text-[#F1F1F6] font-mono">${price.toFixed(2)}</span>
                  <span className="text-[9px] text-[#5C6080] ml-1">{tier.scans}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {tier.features.map((f, i) => (
                  <span key={i} className="text-[9px] text-[#5C6080] bg-[rgba(255,255,255,0.03)] px-1.5 py-0.5 rounded">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <button
        onClick={() => selectedTier && handlePay(TIERS.find((t) => t.id === selectedTier)!)}
        disabled={!selectedTier || !isConnected || processing}
        className="btn btn-primary w-full mt-3"
      >
        {processing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Processing x402 payment...
          </>
        ) : (
          <>
            <Zap className="w-4 h-4 mr-2" />
            {isConnected ? 'Pay with Crypto' : 'Connect Wallet First'}
          </>
        )}
      </button>

      <p className="text-[9px] text-[#5C6080] mt-2 text-center">
        Powered by x402 protocol. Payments in USDC on Base/Solana.
      </p>
    </motion.div>
  )
}
