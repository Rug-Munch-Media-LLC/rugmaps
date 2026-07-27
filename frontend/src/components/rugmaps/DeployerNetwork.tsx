import { Activity, AlertTriangle, Calendar, ExternalLink, GitBranch, Skull, TrendingDown } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

export interface DeployerToken {
  chain: string
  address: string
  symbol: string
  name?: string
  launched_at: number
  peak_mcap: number
  current_mcap: number
  rugged: boolean
  rug_pct?: number
  holders: number
  liquidity: number
  age_days: number
  market_cap_change_pct?: number
  bundle_pct?: number
}

interface DeployerNetworkProps {
  deployerAddress: string
  chain?: string
  initialTokens?: DeployerToken[]
  className?: string
}

const CHAIN_META: Record<string, { name: string; color: string; icon: string }> = {
  solana: { name: 'Solana', color: '#9945FF', icon: '◎' },
  ethereum: { name: 'Ethereum', color: '#627EEA', icon: 'Ξ' },
  base: { name: 'Base', color: '#0052FF', icon: '⊙' },
  bsc: { name: 'BSC', color: '#F0B90B', icon: '⬡' },
}

const EXPLORERS: Record<string, string> = {
  solana: 'https://solscan.io/token/',
  ethereum: 'https://etherscan.io/token/',
  base: 'https://basescan.org/token/',
  bsc: 'https://bscscan.com/token/',
}

export default function DeployerNetwork({
  deployerAddress,
  chain,
  initialTokens,
  className = '',
}: DeployerNetworkProps) {
  const [tokens, setTokens] = useState<DeployerToken[]>(initialTokens || [])
  const [loading, setLoading] = useState(!initialTokens)
  const [windowDays, setWindowDays] = useState(90)

  useEffect(() => {
    if (initialTokens) {
      setTokens(initialTokens)
      setLoading(false)
      return
    }
    const fetchTokens = async () => {
      try {
        const params = new URLSearchParams({
          deployer: deployerAddress,
          days: String(windowDays),
          ...(chain ? { chain } : {}),
        })
        const res = await fetch(`/api/v1/rugmaps/deployer-tokens?${params}`)
        if (res.ok) {
          const data = await res.json()
          const raw = data.tokens || data.deployments || []
          setTokens(
            raw.map((t: any) => ({
              chain: t.chain || 'solana',
              address: t.address || t.token_address || t.mint || '',
              symbol: t.symbol || t.token_symbol || '?',
              name: t.name,
              launched_at: Number(t.launched_at || t.created_at || t.timestamp || Date.now() / 1000),
              peak_mcap: Number(t.peak_mcap || t.peak_market_cap || 0),
              current_mcap: Number(t.current_mcap || t.market_cap || t.fdv || 0),
              rugged: Boolean(t.rugged || t.is_rugged),
              rug_pct: Number(t.rug_pct || t.rug_percentage || 0),
              holders: Number(t.holders || t.holder_count || 0),
              liquidity: Number(t.liquidity || t.liquidity_usd || 0),
              age_days: Number(t.age_days || t.ageDays || 0),
              market_cap_change_pct: Number(t.market_cap_change_pct || t.mcap_change || 0),
              bundle_pct: Number(t.bundle_pct || t.bundle_percentage || 0),
            })),
          )
        }
      } catch (e) {
        console.error('[DeployerNetwork] fetch failed:', e)
      } finally {
        setLoading(false)
      }
    }
    fetchTokens()
  }, [deployerAddress, chain, windowDays, initialTokens])

  // Stats: how many tokens? rugged? success rate?
  const stats = useMemo(() => {
    const total = tokens.length
    const rugged = tokens.filter((t) => t.rugged).length
    const totalVolume = tokens.reduce((s, t) => s + t.peak_mcap, 0)
    const totalRugLoss = tokens.reduce((s, t) => {
      if (t.rugged && t.peak_mcap > 0) {
        return s + (t.peak_mcap - t.current_mcap)
      }
      return s
    }, 0)
    const avgRugPct = rugged > 0 ? tokens.filter((t) => t.rugged).reduce((s, t) => s + (t.rug_pct || 0), 0) / rugged : 0
    return { total, rugged, rugRate: total > 0 ? (rugged / total) * 100 : 0, totalVolume, totalRugLoss, avgRugPct }
  }, [tokens])

  // Risk verdict
  const verdict = useMemo(() => {
    if (stats.total < 3) return { level: 'UNKNOWN', label: 'Insufficient data', color: '#5C6080' }
    if (stats.rugRate >= 80) return { level: 'SERIAL_RUGGER', label: 'SERIAL RUGGER', color: '#FF3366' }
    if (stats.rugRate >= 50) return { level: 'HIGH_RISK', label: 'HIGH RISK DEPLOYER', color: '#FF8C42' }
    if (stats.rugRate >= 25) return { level: 'MODERATE_RISK', label: 'Moderate risk', color: '#FFB800' }
    return { level: 'LOW_RISK', label: 'Mostly legit', color: '#06D6A0' }
  }, [stats])

  const formatDate = (ts: number) => {
    const d = new Date(ts * 1000)
    return d.toISOString().split('T')[0]
  }

  const formatUSD = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
    return `$${n.toFixed(0)}`
  }

  return (
    <div className={`bg-[#0a0a0f] border border-[rgba(139,92,246,0.15)] rounded-xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-[rgba(139,92,246,0.15)] bg-gradient-to-r from-[rgba(139,92,246,0.08)] to-transparent">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-[#8B5CF6]" />
            <div>
              <h3 className="text-sm font-bold text-[#F1F1F6] uppercase tracking-wider">Deployer Network</h3>
              <p className="text-[10px] text-[#5C6080] mt-0.5 font-mono">
                {deployerAddress.slice(0, 6)}...{deployerAddress.slice(-4)}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-[#5C6080] uppercase tracking-wider">Verdict</div>
            <div className="text-sm font-bold flex items-center gap-1" style={{ color: verdict.color }}>
              {stats.rugRate >= 50 && <Skull className="w-3.5 h-3.5" />}
              {verdict.label}
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-[rgba(255,255,255,0.02)] rounded px-2 py-1.5">
            <div className="text-[9px] text-[#5C6080] uppercase">Tokens</div>
            <div className="text-sm font-bold text-[#F1F1F6]">{stats.total}</div>
          </div>
          <div className="bg-[rgba(255,255,255,0.02)] rounded px-2 py-1.5">
            <div className="text-[9px] text-[#5C6080] uppercase">Rugged</div>
            <div className="text-sm font-bold" style={{ color: stats.rugged > 0 ? '#FF3366' : '#06D6A0' }}>
              {stats.rugged} <span className="text-[10px] text-[#5C6080]">({stats.rugRate.toFixed(0)}%)</span>
            </div>
          </div>
          <div className="bg-[rgba(255,255,255,0.02)] rounded px-2 py-1.5">
            <div className="text-[9px] text-[#5C6080] uppercase">Avg Drop</div>
            <div className="text-sm font-bold text-[#FFB800]">-{stats.avgRugPct.toFixed(0)}%</div>
          </div>
          <div className="bg-[rgba(255,255,255,0.02)] rounded px-2 py-1.5">
            <div className="text-[9px] text-[#5C6080] uppercase">Loss</div>
            <div className="text-sm font-bold text-[#FF3366]">{formatUSD(stats.totalRugLoss)}</div>
          </div>
        </div>
      </div>

      {/* Time window */}
      <div className="px-4 py-2 border-b border-[rgba(139,92,246,0.08)] flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-2 text-[#5C6080]">
          <Calendar className="w-3 h-3" />
          <span>Window:</span>
          {[30, 60, 90, 180, 365].map((d) => (
            <button
              key={d}
              onClick={() => setWindowDays(d)}
              className={`px-2 py-0.5 rounded ${windowDays === d ? 'bg-[#8B5CF6] text-white' : 'bg-[rgba(139,92,246,0.08)] hover:bg-[rgba(139,92,246,0.2)]'}`}
            >
              {d}d
            </button>
          ))}
        </div>
        {stats.rugged > 0 && (
          <div className="flex items-center gap-1 text-[#FF3366] animate-pulse">
            <AlertTriangle className="w-3 h-3" />
            <span>{stats.rugRate >= 80 ? 'EXTREME' : stats.rugRate >= 50 ? 'HIGH' : 'ELEVATED'} risk</span>
          </div>
        )}
      </div>

      {/* Token timeline */}
      {loading ? (
        <div className="p-6 text-center text-[#5C6080] text-xs">Loading deployer history...</div>
      ) : tokens.length === 0 ? (
        <div className="p-6 text-center text-[#5C6080] text-xs">No tokens found in last {windowDays} days.</div>
      ) : (
        <div className="max-h-[500px] overflow-y-auto p-2">
          {tokens
            .sort((a, b) => b.launched_at - a.launched_at)
            .map((t, i) => {
              const meta = CHAIN_META[t.chain] || CHAIN_META.solana
              const explorer = EXPLORERS[t.chain] || EXPLORERS.solana
              const isRug = t.rugged
              const mcapChange =
                t.current_mcap > 0 && t.peak_mcap > 0 ? ((t.current_mcap - t.peak_mcap) / t.peak_mcap) * 100 : 0
              return (
                <a
                  key={`${t.chain}-${t.address}-${i}`}
                  href={`${explorer}${t.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-3 px-3 py-2 rounded transition-colors mb-1 ${
                    isRug
                      ? 'bg-[rgba(255,51,102,0.06)] hover:bg-[rgba(255,51,102,0.12)]'
                      : 'hover:bg-[rgba(139,92,246,0.04)]'
                  }`}
                >
                  <span className="text-lg flex-shrink-0" style={{ color: meta.color }}>
                    {meta.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-bold text-[#F1F1F6] truncate">{t.symbol}</span>
                      {isRug && (
                        <span className="px-1.5 py-0.5 bg-[rgba(255,51,102,0.15)] text-[#FF3366] text-[9px] font-bold uppercase rounded flex items-center gap-0.5">
                          <Skull className="w-2.5 h-2.5" />
                          RUG {t.rug_pct?.toFixed(0)}%
                        </span>
                      )}
                      {!isRug && mcapChange < -30 && (
                        <span className="px-1.5 py-0.5 bg-[rgba(255,184,0,0.15)] text-[#FFB800] text-[9px] font-bold uppercase rounded flex items-center gap-0.5">
                          <TrendingDown className="w-2.5 h-2.5" />-{Math.abs(mcapChange).toFixed(0)}%
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[9px] text-[#5C6080] mt-0.5">
                      <span className="font-mono">{formatDate(t.launched_at)}</span>
                      <span>·</span>
                      <span className="font-mono">{t.chain.toUpperCase()}</span>
                      <span>·</span>
                      <span className="font-mono">{t.holders} holders</span>
                      {t.bundle_pct && t.bundle_pct > 30 && (
                        <>
                          <span>·</span>
                          <span className="text-[#FF8C42]">{t.bundle_pct.toFixed(0)}% bundled</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-[10px] text-[#5C6080] font-mono">peak</div>
                    <div className="text-[11px] font-bold text-[#F1F1F6] font-mono">{formatUSD(t.peak_mcap)}</div>
                  </div>
                  <ExternalLink className="w-3 h-3 text-[#5C6080] flex-shrink-0" />
                </a>
              )
            })}
        </div>
      )}
    </div>
  )
}
