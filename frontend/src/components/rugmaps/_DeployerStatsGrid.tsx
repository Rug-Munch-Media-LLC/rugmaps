import { type DeployerStats, formatUSD } from './deployerNetwork'

interface DeployerStatsGridProps {
  stats: DeployerStats
}

/** Header stats grid: tokens, rugged, avg drop, loss. */
export default function DeployerStatsGrid({ stats }: DeployerStatsGridProps) {
  return (
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
  )
}
