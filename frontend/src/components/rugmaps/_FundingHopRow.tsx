import { ArrowRight, ExternalLink } from 'lucide-react'

import { type FundingHop, getExplorerLink, getTxExplorerUrl, TYPE_META } from './fundingTracer'

interface FundingHopRowProps {
  hop: FundingHop
}

/** Single hop entry in the funding chain timeline. */
export default function FundingHopRow({ hop }: FundingHopRowProps) {
  const fromMeta = TYPE_META[hop.from_type]
  const toMeta = TYPE_META[hop.to_type]
  const FromIcon = fromMeta.icon
  const ToIcon = toMeta.icon
  const explorer = getTxExplorerUrl(hop.chain, hop.tx_hash)

  return (
    <div className="px-4 py-2.5 border-b border-[rgba(139,92,246,0.04)] hover:bg-[rgba(139,92,246,0.04)] transition-colors">
      <div className="flex items-center gap-2">
        {/* From */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="text-lg">{FromIcon}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: fromMeta.color }}>
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
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: toMeta.color }}>
                {toMeta.label}
              </span>
              {hop.to_label && (
                <span className="text-[10px] text-[#F1F1F6] font-semibold truncate">{hop.to_label}</span>
              )}
            </div>
            <a
              href={getExplorerLink(hop.chain, hop.to_address)}
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
          <span style={{ color: hop.confidence > 70 ? '#06D6A0' : hop.confidence > 40 ? '#FFB800' : '#FF3366' }}>
            {hop.confidence}% CONF
          </span>
          <span className="font-mono">{hop.chain.toUpperCase()}</span>
        </div>
        {hop.tx_hash && (
          <a
            href={explorer}
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
}
