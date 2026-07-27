import { motion } from 'framer-motion'
import { AlertTriangle, ArrowRight, Fuel, GitBranch, Landmark, Loader2, Wallet, Wind } from 'lucide-react'
import { useEffect, useState } from 'react'

interface FundingNode {
  address: string
  label: string
  type: 'cex' | 'mixer' | 'wallet' | 'scam' | 'unknown'
  amount: number
  timestamp: number
}

interface FundingPath {
  nodes: FundingNode[]
  totalAmount: number
  confidence: number
  flags: string[]
}

interface GasFundingTracerProps {
  tokenAddress: string
  chain: string
  deployerAddress?: string
}

export default function GasFundingTracer({ tokenAddress, chain, deployerAddress }: GasFundingTracerProps) {
  const [path, setPath] = useState<FundingPath | null>(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!deployerAddress) return
    setLoading(true)
    // Simulate API call — replace with real backend integration
    setTimeout(() => {
      setPath({
        nodes: [
          {
            address: '0xCEX...1234',
            label: 'Binance Hot Wallet',
            type: 'cex',
            amount: 5.2,
            timestamp: Date.now() - 86400000 * 3,
          },
          {
            address: '0xMIX...5678',
            label: 'Tornado Cash',
            type: 'mixer',
            amount: 4.8,
            timestamp: Date.now() - 86400000 * 2,
          },
          {
            address: '0xTMP...9012',
            label: 'Intermediate',
            type: 'wallet',
            amount: 2.1,
            timestamp: Date.now() - 86400000 * 1,
          },
          { address: deployerAddress, label: 'Deployer', type: 'wallet', amount: 1.5, timestamp: Date.now() - 3600000 },
        ],
        totalAmount: 1.5,
        confidence: 87,
        flags: ['mixer_used', 'intermediate_wallet', 'cex_funded'],
      })
      setLoading(false)
    }, 1500)
  }, [deployerAddress])

  if (!deployerAddress) return null

  if (loading) {
    return (
      <div className="glass-card rounded-[16px] p-5 flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 text-[#F59E0B] animate-spin mr-2" />
        <span className="text-[12px] text-[#9DA0B0]">Tracing gas funding path...</span>
      </div>
    )
  }

  if (!path) return null

  const typeConfig: Record<string, { icon: any; color: string; label: string }> = {
    cex: { icon: Landmark, color: '#3B82F6', label: 'CEX' },
    mixer: { icon: Wind, color: '#6B7280', label: 'Mixer' },
    wallet: { icon: Wallet, color: '#9DA0B0', label: 'Wallet' },
    scam: { icon: AlertTriangle, color: '#FF3366', label: 'Scam' },
    unknown: { icon: Fuel, color: '#5C6080', label: 'Unknown' },
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-[16px] p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-[9px] bg-[#F59E0B]/10 flex items-center justify-center">
          <Fuel className="w-[15px] h-[15px] text-[#F59E0B]" />
        </div>
        <div>
          <h3 className="text-[14px] font-semibold text-[#F1F1F6]">Gas Funding Tracer</h3>
        </div>
        <span className="badge badge-warning text-[9.5px] ml-auto">{path.confidence}% confidence</span>
      </div>

      {/* Path Visualization */}
      <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-2">
        {path.nodes.map((node, i) => {
          const config = typeConfig[node.type]
          const Icon = config.icon
          return (
            <div key={i} className="flex items-center gap-1 flex-shrink-0">
              <div
                className="p-2.5 rounded-[10px] border min-w-[100px]"
                style={{ borderColor: config.color + '30', backgroundColor: config.color + '08' }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
                  <span className="text-[9px] font-semibold uppercase" style={{ color: config.color }}>
                    {config.label}
                  </span>
                </div>
                <div className="text-[10px] text-[#F1F1F6] font-mono">
                  {node.address.slice(0, 6)}...{node.address.slice(-4)}
                </div>
                <div className="text-[9px] text-[#5C6080]">
                  {node.amount.toFixed(2)} {chain === 'solana' ? 'SOL' : 'ETH'}
                </div>
              </div>
              {i < path.nodes.length - 1 && <ArrowRight className="w-4 h-4 text-[#5C6080] flex-shrink-0" />}
            </div>
          )
        })}
      </div>

      {/* Flags */}
      {path.flags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {path.flags.map((flag, i) => (
            <span key={i} className="badge badge-danger text-[9.5px]">
              <AlertTriangle className="w-3 h-3" />
              {flag.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  )
}
