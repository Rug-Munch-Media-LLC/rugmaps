import { motion } from 'framer-motion'
import { Activity, AlertTriangle, Bot, Loader2, ShieldCheck, Users, Zap } from 'lucide-react'
import { useState } from 'react'
import { fetchTokenGraph, type TokenGraphNode } from '@/services/rugmapsApi'

interface BotSuite {
  name: string
  confidence: number
  wallets: number
  volumeFake: number
  pattern: string
}

interface BotNetworkPanelProps {
  tokenAddress: string
  chain: string
}

// Known bot-suite signatures matched against node entity types / tags returned
// by the live token-graph route. The backend labels wallets with entity types
// (e.g. "bundle", "sniper", "mev", "aggregator") — we surface those as suites.
const BOT_SIGNATURES: Array<{ name: string; match: RegExp; pattern: string }> = [
  { name: 'Bundle Bot', match: /bundle|bundl/i, pattern: 'coordinated_entry' },
  { name: 'Sniper Bot', match: /sniper|snip/i, pattern: 'first_block_entry' },
  { name: 'MEV Bot', match: /mev|sandwich|jito/i, pattern: 'mev_bundle' },
  { name: 'Volume Bot', match: /volume|wash/i, pattern: 'wash_cycle' },
  { name: 'Aggregator', match: /aggregator|multi.?dex/i, pattern: 'multi_dex_split' },
  { name: 'Copycat', match: /copycat|copy.?trade/i, pattern: 'identical_tx_structure' },
]

/** Derive bot suites from the enriched holder nodes returned by the API. */
function deriveBotSuites(nodes: TokenGraphNode[]): BotSuite[] {
  const suites: BotSuite[] = []
  for (const sig of BOT_SIGNATURES) {
    const matches = nodes.filter((n) => {
      const haystack = [n.entity_type, n.label, n.name, ...(Array.isArray(n.tags) ? n.tags : [])]
        .filter(Boolean)
        .join(' ')
      return sig.match.test(haystack)
    })
    if (matches.length === 0) continue
    const avgRisk = matches.reduce((s, n) => s + (n.risk ?? n.risk_score ?? 0), 0) / matches.length
    suites.push({
      name: sig.name,
      confidence: Math.min(99, Math.round(60 + avgRisk * 0.4)),
      wallets: matches.length,
      volumeFake: Math.min(95, Math.round(avgRisk * 0.9)),
      pattern: sig.pattern,
    })
  }
  return suites
}

export default function BotNetworkPanel({ tokenAddress, chain }: BotNetworkPanelProps) {
  const [bots, setBots] = useState<BotSuite[]>([])
  const [loading, setLoading] = useState(false)
  const [analyzed, setAnalyzed] = useState(false)

  const detectBots = () => {
    setLoading(true)
    // Live route: GET /api/v1/rugmaps/token-graph — the backend enriches each
    // holder node with entity_type / tags / is_bundle, which we map to bot
    // suites. TODO: a dedicated bot-detection endpoint would return confidence
    // + fake-volume directly; for now we derive them from node risk.
    fetchTokenGraph(tokenAddress, chain)
      .then((graph) => {
        setBots(deriveBotSuites(graph?.nodes ?? []))
        setAnalyzed(true)
      })
      .finally(() => setLoading(false))
  }

  if (!analyzed) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-[16px] p-5"
      >
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-[9px] bg-[#8B5CF6]/10 flex items-center justify-center">
            <Bot className="w-[15px] h-[15px] text-[#8B5CF6]" />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-[#F1F1F6]">Bot Network Detection</h3>
          </div>
        </div>
        <button onClick={detectBots} disabled={loading} className="btn btn-primary w-full">
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Bot className="w-4 h-4 mr-2" />}
          {loading ? 'Analyzing transaction patterns...' : 'Detect Bot Networks'}
        </button>
      </motion.div>
    )
  }

  if (bots.length === 0) {
    return (
      <div className="glass-card rounded-[16px] p-5">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <span className="text-[13px] font-semibold text-emerald-400">No Bot Networks Detected</span>
        </div>
        <p className="text-[11px] text-[#9DA0B0]">
          Transaction patterns appear organic. No known bot suite signatures found.
        </p>
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-[16px] p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-[9px] bg-[#8B5CF6]/10 flex items-center justify-center">
          <Bot className="w-[15px] h-[15px] text-[#8B5CF6]" />
        </div>
        <div>
          <h3 className="text-[14px] font-semibold text-[#F1F1F6]">Bot Networks</h3>
        </div>
        <span className="badge badge-danger text-[9.5px] ml-auto">{bots.length} detected</span>
      </div>

      <div className="space-y-3">
        {bots.map((bot, i) => (
          <div key={i} className="p-3 rounded-[10px] bg-[#8B5CF6]/5 border border-[#8B5CF6]/20">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#8B5CF6]" />
                <span className="text-[13px] font-semibold text-[#F1F1F6]">{bot.name}</span>
              </div>
              <span className="text-[10px] text-[#8B5CF6] font-mono">{bot.confidence}% match</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div className="text-[#9DA0B0]">
                <Users className="w-3 h-3 inline mr-1" />
                {bot.wallets} wallets
              </div>
              <div className="text-[#9DA0B0]">
                <Activity className="w-3 h-3 inline mr-1" />
                {bot.volumeFake.toFixed(0)}% fake vol
              </div>
              <div className="text-[#9DA0B0]">
                <Bot className="w-3 h-3 inline mr-1" />
                {bot.pattern}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 p-2.5 rounded-[8px] bg-[#FF3366]/5 border border-[#FF3366]/10">
        <div className="flex items-center gap-2 text-[11px]">
          <AlertTriangle className="w-4 h-4 text-[#FF3366]" />
          <span className="text-[#FF3366]">
            Estimated fake volume: {bots.reduce((acc, b) => acc + b.volumeFake, 0).toFixed(0)}% of total
          </span>
        </div>
      </div>
    </motion.div>
  )
}
