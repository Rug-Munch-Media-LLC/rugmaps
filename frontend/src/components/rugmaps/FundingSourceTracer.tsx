import { AlertTriangle, ArrowDown, ArrowRight, Building2, ExternalLink, Filter, Search, Shuffle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

export interface FundingHop {
  from_address: string
  from_label?: string
  from_type: 'wallet' | 'cex' | 'mixer' | 'bridge' | 'dex' | 'unknown'
  to_address: string
  to_label?: string
  to_type: 'wallet' | 'cex' | 'mixer' | 'bridge' | 'dex' | 'unknown'
  amount_usd: number
  timestamp: number
  tx_hash: string
  chain: string
  hops: number
  confidence: number
  tainted_pct?: number
}

interface FundingTracerProps {
  chain: string
  address: string
  initialHops?: FundingHop[]
  className?: string
}

const TYPE_META: Record<FundingHop['from_type'], { color: string; icon: any; label: string }> = {
  wallet: { color: '#8B5CF6', icon: '👛', label: 'WALLET' },
  cex: { color: '#FFB800', icon: '🏦', label: 'CEX' },
  mixer: { color: '#FF3366', icon: '🌀', label: 'MIXER' },
  bridge: { color: '#22D3EE', icon: '🌉', label: 'BRIDGE' },
  dex: { color: '#06D6A0', icon: '🔄', label: 'DEX' },
  unknown: { color: '#5C6080', icon: '❓', label: 'UNKNOWN' },
}

const EXPLORERS: Record<string, string> = {
  solana: 'https://solscan.io/tx/',
  ethereum: 'https://etherscan.io/tx/',
  base: 'https://basescan.org/tx/',
  bsc: 'https://bscscan.com/tx/',
  arbitrum: 'https://arbiscan.io/tx/',
  optimism: 'https://optimistic.etherscan.io/tx/',
  polygon: 'https://polygonscan.com/tx/',
}

const KNOWN_CEX = new Set([
  'binance',
  'coinbase',
  'kraken',
  'ftx',
  'okx',
  'bybit',
  'kucoin',
  'bitfinex',
  'gemini',
  'crypto.com',
  'huobi',
  'mexc',
  'gate.io',
  'bitstamp',
])

const KNOWN_MIXERS = new Set([
  'tornado',
  'tornadocash',
  'railgun',
  'aztec',
  'zcash',
  'monero',
  'cyclone',
  'mixer',
  'wasabi',
  'joinmarket',
])

function classifyAddress(addr: string, label?: string): FundingHop['from_type'] {
  if (label) {
    const l = label.toLowerCase()
    if (KNOWN_CEX.has(l) || l.includes('exchange') || l.includes('binance') || l.includes('coinbase')) return 'cex'
    if (KNOWN_MIXERS.has(l) || l.includes('mixer') || l.includes('tornado')) return 'mixer'
    if (l.includes('bridge')) return 'bridge'
    if (l.includes('dex') || l.includes('uniswap') || l.includes('jupiter') || l.includes('raydium')) return 'dex'
  }
  return 'wallet'
}

export default function FundingTracer({ chain, address, initialHops, className = '' }: FundingTracerProps) {
  const [hops, setHops] = useState<FundingHop[]>(initialHops || [])
  const [loading, setLoading] = useState(!initialHops)
  const [depth, setDepth] = useState(3)
  const [filter, setFilter] = useState<'all' | 'cex' | 'mixer'>('all')

  useEffect(() => {
    if (initialHops) {
      setHops(initialHops)
      setLoading(false)
      return
    }
    const fetchHops = async () => {
      try {
        const res = await fetch(
          `/api/v1/investigate/fund-flow?chain=${chain}&address=${encodeURIComponent(address)}&depth=${depth}`,
        )
        if (res.ok) {
          const data = await res.json()
          const rawHops = data.hops || data.flow || []
          setHops(
            rawHops.map((h: any, i: number) => ({
              from_address: h.from_address || h.from || '',
              from_label: h.from_label || h.source_label,
              from_type: classifyAddress(h.from_address || '', h.from_label),
              to_address: h.to_address || h.to || address,
              to_label: h.to_label || h.dest_label,
              to_type: classifyAddress(h.to_address || address, h.to_label),
              amount_usd: Number(h.amount_usd || h.value_usd || h.amount || 0),
              timestamp: Number(h.timestamp || h.time || Date.now() / 1000),
              tx_hash: h.tx_hash || h.hash || '',
              chain: h.chain || chain,
              hops: Number(h.hops || h.depth || i + 1),
              confidence: Number(h.confidence || 70),
              tainted_pct: Number(h.tainted_pct || h.taint || 0),
            })),
          )
        }
      } catch (e) {
        console.error('[FundingTracer] fetch failed:', e)
      } finally {
        setLoading(false)
      }
    }
    fetchHops()
  }, [chain, address, depth, initialHops])

  // Stats: where did the funding come from?
  const sourceStats = useMemo(() => {
    const stats: Record<string, { count: number; total_usd: number }> = {}
    for (const h of hops) {
      const key = h.from_type
      if (!stats[key]) stats[key] = { count: 0, total_usd: 0 }
      stats[key].count++
      stats[key].total_usd += h.amount_usd
    }
    return stats
  }, [hops])

  // Detection: did funding go through CEX or mixer? (TAINT signal)
  const taint = useMemo(() => {
    const cexFlow = sourceStats.cex?.total_usd || 0
    const mixerFlow = sourceStats.mixer?.total_usd || 0
    const totalFlow = hops.reduce((s, h) => s + h.amount_usd, 0)
    if (totalFlow === 0) return { level: 'UNKNOWN', pct: 0, reason: '' }
    const cexPct = (cexFlow / totalFlow) * 100
    const mixerPct = (mixerFlow / totalFlow) * 100
    if (mixerPct > 20)
      return { level: 'HIGH_TAINT', pct: mixerPct, reason: `${mixerPct.toFixed(0)}% via mixer (likely obfuscated)` }
    if (cexPct > 50) return { level: 'CEX_FUNDED', pct: cexPct, reason: `${cexPct.toFixed(0)}% from CEX (KYC'd)` }
    if (cexPct > 0) return { level: 'MIXED', pct: cexPct, reason: `${cexPct.toFixed(0)}% from CEX` }
    return { level: 'PEER_TO_PEER', pct: 0, reason: 'No CEX/mixer detected' }
  }, [hops, sourceStats])

  const filtered = hops.filter((h) => {
    if (filter === 'all') return true
    if (filter === 'cex') return h.from_type === 'cex'
    if (filter === 'mixer') return h.from_type === 'mixer'
    return true
  })

  const taintColor = {
    HIGH_TAINT: '#FF3366',
    CEX_FUNDED: '#06D6A0',
    MIXED: '#FFB800',
    PEER_TO_PEER: '#22D3EE',
    UNKNOWN: '#5C6080',
  }[taint.level]

  return (
    <div className={`bg-[#0a0a0f] border border-[rgba(139,92,246,0.15)] rounded-xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-[rgba(139,92,246,0.15)] bg-gradient-to-r from-[rgba(139,92,246,0.08)] to-transparent">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-sm font-bold text-[#F1F1F6] uppercase tracking-wider">Funding Source Tracer</h3>
            <p className="text-[10px] text-[#5C6080] mt-0.5">3-hop backward trace · CEX/mixer/bridge detection</p>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-[#5C6080] uppercase tracking-wider">Taint</div>
            <div className="text-sm font-bold flex items-center gap-1.5" style={{ color: taintColor }}>
              {taint.level === 'HIGH_TAINT' && <AlertTriangle className="w-3 h-3" />}
              <span>{taint.level}</span>
            </div>
          </div>
        </div>
        <div className="text-[10px] text-[#5C6080] mb-2">{taint.reason}</div>

        {/* Source type breakdown */}
        <div className="grid grid-cols-5 gap-1.5 mt-2">
          {(['cex', 'mixer', 'bridge', 'dex', 'wallet'] as const).map((t) => {
            const meta = TYPE_META[t]
            const stat = sourceStats[t] || { count: 0, total_usd: 0 }
            return (
              <button
                key={t}
                onClick={() => setFilter(filter === t ? 'all' : (t as any))}
                className={`px-2 py-1.5 rounded border transition-colors ${
                  filter === t
                    ? 'border-[#8B5CF6] bg-[rgba(139,92,246,0.15)]'
                    : 'border-[rgba(139,92,246,0.08)] bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(139,92,246,0.06)]'
                }`}
              >
                <div className="text-base">{meta.icon}</div>
                <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: meta.color }}>
                  {meta.label}
                </div>
                <div className="text-[9px] text-[#F1F1F6] mt-0.5">
                  {stat.count} hop{stat.count !== 1 ? 's' : ''}
                </div>
                <div className="text-[9px] text-[#5C6080]">
                  ${stat.total_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 py-2 border-b border-[rgba(139,92,246,0.08)] flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-2 text-[#5C6080]">
          <span>Depth:</span>
          {[1, 2, 3, 5].map((d) => (
            <button
              key={d}
              onClick={() => setDepth(d)}
              className={`px-2 py-0.5 rounded ${depth === d ? 'bg-[#8B5CF6] text-white' : 'bg-[rgba(139,92,246,0.08)] hover:bg-[rgba(139,92,246,0.2)]'}`}
            >
              {d}
            </button>
          ))}
        </div>
        <span className="text-[#5C6080]">{filtered.length} hops</span>
      </div>

      {/* Hop list */}
      {loading ? (
        <div className="p-6 text-center text-[#5C6080] text-xs">Tracing {depth}-hop funding chain...</div>
      ) : filtered.length === 0 ? (
        <div className="p-6 text-center text-[#5C6080] text-xs">
          No hops found. Try increasing depth or check address.
        </div>
      ) : (
        <div className="max-h-[500px] overflow-y-auto">
          {filtered.map((hop, i) => {
            const fromMeta = TYPE_META[hop.from_type]
            const toMeta = TYPE_META[hop.to_type]
            const FromIcon = fromMeta.icon
            const ToIcon = toMeta.icon
            const explorer = EXPLORERS[hop.chain] || EXPLORERS.ethereum
            return (
              <div
                key={i}
                className="px-4 py-2.5 border-b border-[rgba(139,92,246,0.04)] hover:bg-[rgba(139,92,246,0.04)] transition-colors"
              >
                <div className="flex items-center gap-2">
                  {/* From */}
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="text-lg">{FromIcon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span
                          className="text-[10px] font-bold uppercase tracking-wider"
                          style={{ color: fromMeta.color }}
                        >
                          {fromMeta.label}
                        </span>
                        {hop.from_label && (
                          <span className="text-[10px] text-[#F1F1F6] font-semibold truncate">{hop.from_label}</span>
                        )}
                      </div>
                      <a
                        href={`https://solscan.io/account/${hop.from_address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[9px] text-[#5C6080] font-mono hover:text-[#8B5CF6] truncate block"
                      >
                        {hop.from_address.slice(0, 10)}...{hop.from_address.slice(-6)}
                      </a>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="flex flex-col items-center flex-shrink-0 px-2">
                    <ArrowRight className="w-4 h-4 text-[#5C6080]" />
                    <span className="text-[9px] text-[#5C6080] font-mono">
                      ${hop.amount_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>

                  {/* To */}
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="text-lg">{ToIcon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span
                          className="text-[10px] font-bold uppercase tracking-wider"
                          style={{ color: toMeta.color }}
                        >
                          {toMeta.label}
                        </span>
                        {hop.to_label && (
                          <span className="text-[10px] text-[#F1F1F6] font-semibold truncate">{hop.to_label}</span>
                        )}
                      </div>
                      <a
                        href={`${EXPLORERS[hop.chain] || ''}${hop.to_address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[9px] text-[#5C6080] font-mono hover:text-[#8B5CF6] truncate block"
                      >
                        {hop.to_address.slice(0, 10)}...{hop.to_address.slice(-6)}
                      </a>
                    </div>
                  </div>
                </div>

                {/* Meta row */}
                <div className="flex items-center justify-between mt-1.5 text-[9px] text-[#5C6080]">
                  <div className="flex items-center gap-2">
                    <span>HOP {hop.hops}</span>
                    <span
                      style={{ color: hop.confidence > 70 ? '#06D6A0' : hop.confidence > 40 ? '#FFB800' : '#FF3366' }}
                    >
                      {hop.confidence}% CONF
                    </span>
                    <span className="font-mono">{hop.chain.toUpperCase()}</span>
                  </div>
                  {hop.tx_hash && (
                    <a
                      href={`${explorer}${hop.tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#8B5CF6] hover:underline flex items-center gap-0.5"
                    >
                      TX <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
