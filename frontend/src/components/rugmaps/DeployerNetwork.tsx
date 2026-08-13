import { AlertTriangle, Calendar, GitBranch, Skull } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import DeployerStatsGrid from './_DeployerStatsGrid'
import DeployerTokenRow from './_DeployerTokenRow'
import { computeDeployerStats, computeVerdict, type DeployerToken, normalizeDeployerTokens } from './deployerNetwork'

export type { DeployerToken } from './deployerNetwork'

interface DeployerNetworkProps {
  deployerAddress: string
  chain?: string
  initialTokens?: DeployerToken[]
  className?: string
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
          setTokens(normalizeDeployerTokens(raw))
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
  const stats = useMemo(() => computeDeployerStats(tokens), [tokens])

  // Risk verdict
  const verdict = useMemo(() => computeVerdict(stats), [stats])

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

        <DeployerStatsGrid stats={stats} />
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
            .map((t, i) => (
              <DeployerTokenRow key={`${t.chain}-${t.address}-${i}`} token={t} />
            ))}
        </div>
      )}
    </div>
  )
}
