import { AlertTriangle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import FundingHopRow from './_FundingHopRow'
import {
  computeSourceStats,
  computeTaint,
  type FundingHop,
  normalizeFundingHops,
  TAINT_COLORS,
  TYPE_META,
} from './fundingTracer'

export type { FundingHop } from './fundingTracer'

interface FundingTracerProps {
  chain: string
  address: string
  initialHops?: FundingHop[]
  className?: string
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
          setHops(normalizeFundingHops(rawHops, address, chain))
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
  const sourceStats = useMemo(() => computeSourceStats(hops), [hops])

  // Detection: did funding go through CEX or mixer? (TAINT signal)
  const taint = useMemo(() => computeTaint(hops, sourceStats), [hops, sourceStats])

  const filtered = hops.filter((h) => {
    if (filter === 'all') return true
    if (filter === 'cex') return h.from_type === 'cex'
    if (filter === 'mixer') return h.from_type === 'mixer'
    return true
  })

  const taintColor = TAINT_COLORS[taint.level]

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
          {filtered.map((hop, i) => (
            <FundingHopRow key={i} hop={hop} />
          ))}
        </div>
      )}
    </div>
  )
}
