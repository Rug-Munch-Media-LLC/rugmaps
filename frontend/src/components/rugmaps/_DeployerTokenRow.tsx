import { ExternalLink, Skull, TrendingDown } from 'lucide-react'

import { CHAIN_META, type DeployerToken, formatDate, formatUSD, getTokenExplorerUrl } from './deployerNetwork'

interface DeployerTokenRowProps {
  token: DeployerToken
}

/** Single token entry in the deployer timeline. */
export default function DeployerTokenRow({ token: t }: DeployerTokenRowProps) {
  const meta = CHAIN_META[t.chain] || CHAIN_META.solana
  const explorer = getTokenExplorerUrl(t.chain, t.address)
  const isRug = t.rugged
  const mcapChange = t.current_mcap > 0 && t.peak_mcap > 0 ? ((t.current_mcap - t.peak_mcap) / t.peak_mcap) * 100 : 0

  return (
    <a
      href={explorer}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-3 px-3 py-2 rounded transition-colors mb-1 ${
        isRug ? 'bg-[rgba(255,51,102,0.06)] hover:bg-[rgba(255,51,102,0.12)]' : 'hover:bg-[rgba(139,92,246,0.04)]'
      }`}
    >
      <span className="text-lg flex-shrink-0" style={{ color: meta!.color }}>
        {meta!.icon}
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
}
