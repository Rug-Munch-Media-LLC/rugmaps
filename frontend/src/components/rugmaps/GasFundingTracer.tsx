import { motion } from 'framer-motion'
import { AlertTriangle, ArrowRight, Fuel, Landmark, Loader2, Wallet, Wind } from 'lucide-react'
import { useEffect, useState } from 'react'
import { fetchFundFlows, fundFlowsToRawHops, type RawFundFlowHop } from '@/services/rugmapsApi'

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

const CEX_HINTS = /binance|coinbase|kraken|okx|bybit|kucoin|exchange|cex/i
const MIXER_HINTS = /tornado|mixer|railgun|aztec|obfuscat/i

/** Classify a funding hop's counterparty into a node type. */
function classifyNode(label: string | undefined): FundingNode['type'] {
  if (label && CEX_HINTS.test(label)) return 'cex'
  if (label && MIXER_HINTS.test(label)) return 'mixer'
  if (/scam|rug|honeypot/i.test(label ?? '')) return 'scam'
  return 'wallet'
}

/** Build a backward funding path from the live fund-flow hops. */
function buildFundingPath(hops: RawFundFlowHop[], deployerAddress: string): FundingPath | null {
  if (hops.length === 0) return null

  // The tracer is a backward trace: inbound records (funders → deployer) come
  // first. Walk them to reconstruct the path ending at the deployer.
  const nodes: FundingNode[] = []
  const flags: string[] = []
  let totalAmount = 0

  for (const hop of hops) {
    const fromType = classifyNode(hop.from_address)
    const toType = classifyNode(hop.to_address)
    const isDeployerHop = hop.to_address === deployerAddress || hop.direction === 'inbound'

    if (fromType === 'cex') flags.push('cex_funded')
    if (fromType === 'mixer') flags.push('mixer_used')

    nodes.push({
      address: hop.from_address || hop.to_address,
      label: fromType === 'cex' ? 'CEX Hot Wallet' : fromType === 'mixer' ? 'Mixer' : 'Intermediate',
      type: fromType,
      amount: hop.amount_usd,
      timestamp: Date.now(),
    })

    if (isDeployerHop) {
      nodes.push({
        address: deployerAddress,
        label: 'Deployer',
        type: toType === 'wallet' ? 'wallet' : toType,
        amount: hop.amount_usd,
        timestamp: Date.now(),
      })
      totalAmount += hop.amount_usd
    }
  }

  // Deduplicate consecutive identical addresses.
  const deduped: FundingNode[] = []
  for (const node of nodes) {
    const last = deduped[deduped.length - 1]
    if (last && last.address === node.address) continue
    deduped.push(node)
  }

  if (deduped.length === 0) return null

  const confidence = Math.min(99, 60 + deduped.length * 5 + (flags.length > 0 ? 10 : 0))
  return {
    nodes: deduped.slice(0, 8),
    totalAmount,
    confidence,
    flags: Array.from(new Set(flags)),
  }
}

export default function GasFundingTracer({ tokenAddress, chain, deployerAddress }: GasFundingTracerProps) {
  const [path, setPath] = useState<FundingPath | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!deployerAddress) return
    setLoading(true)
    // Live route: GET /api/v1/rugmaps/fund-flows?token&address&chain&hops
    // (via services/rugmapsApi.ts). TODO: this route lives on the rmi-backend
    // deployment; if the standalone rugmaps backend does not expose it, the
    // fetch returns null and the panel renders an honest empty state.
    fetchFundFlows({ token: tokenAddress, address: deployerAddress, chain, hops: 2 })
      .then((data) => {
        const hops = fundFlowsToRawHops(data)
        setPath(buildFundingPath(hops, deployerAddress))
      })
      .finally(() => setLoading(false))
  }, [tokenAddress, chain, deployerAddress])

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
          const config = typeConfig[node.type]!
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
