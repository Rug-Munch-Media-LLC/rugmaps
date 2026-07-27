import { motion } from 'framer-motion'
import { AlertTriangle, Code, Eye, Loader2, Lock, Shield, ShieldCheck, Unlock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getRiskColor, getRiskLabel, type SentinelScanResult, sentinelScan } from '@/services/rugmapsSentinelBridge'

interface SentinelRiskMeterProps {
  tokenAddress: string
  chain: string
}

export default function SentinelRiskMeter({ tokenAddress, chain }: SentinelRiskMeterProps) {
  const [result, setResult] = useState<SentinelScanResult | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!tokenAddress) return
    setLoading(true)
    sentinelScan(tokenAddress, chain)
      .then(setResult)
      .finally(() => setLoading(false))
  }, [tokenAddress, chain])

  if (loading) {
    return (
      <div className="glass-card rounded-[16px] p-5 flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 text-[#FF3366] animate-spin mr-2" />
        <span className="text-[12px] text-[#9DA0B0]">SENTINEL scanning contract...</span>
      </div>
    )
  }

  if (!result) return null

  const riskColor = getRiskColor(result.risk_score)
  const riskLabel = getRiskLabel(result.risk_level)

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-[16px] p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-[9px] bg-[#FF3366]/10 flex items-center justify-center">
          <Shield className="w-[15px] h-[15px] text-[#FF3366]" />
        </div>
        <div>
          <h3 className="text-[14px] font-semibold text-[#F1F1F6]">SENTINEL Scan</h3>
        </div>
        <span
          className="badge ml-auto text-[10px]"
          style={{
            backgroundColor: riskColor + '20',
            color: riskColor,
            borderColor: riskColor + '40',
          }}
        >
          {result.risk_score}/100 {riskLabel}
        </span>
      </div>

      {/* Risk Gauge */}
      <div className="mb-4">
        <div className="h-3 rounded-full bg-[rgba(255,255,255,0.05)] overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${result.risk_score}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{ backgroundColor: riskColor }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-[#5C6080]">Safe</span>
          <span className="text-[9px] text-[#5C6080]">Critical</span>
        </div>
      </div>

      {/* Contract Security */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <SecurityBadge
          icon={result.contract_verified ? ShieldCheck : AlertTriangle}
          label="Verified"
          status={result.contract_verified}
          good={true}
        />
        <SecurityBadge
          icon={result.ownership_renounced ? Lock : Unlock}
          label="Ownership"
          status={result.ownership_renounced}
          good={true}
        />
        <SecurityBadge
          icon={result.liquidity_locked ? Lock : Unlock}
          label="Liquidity Locked"
          status={result.liquidity_locked}
          good={true}
        />
        <SecurityBadge
          icon={result.is_honeypot ? AlertTriangle : ShieldCheck}
          label="Honeypot"
          status={!result.is_honeypot}
          good={true}
          invert={true}
        />
      </div>

      {/* Honeypot Details */}
      {result.is_honeypot && (
        <div className="p-3 rounded-[10px] bg-[#FF3366]/5 border border-[#FF3366]/20 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-[#FF3366]" />
            <span className="text-[12px] font-semibold text-[#FF3366]">Honeypot Detected</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="text-[#9DA0B0]">
              Can Sell:{' '}
              <span className={result.honeypot_details.can_sell ? 'text-emerald-400' : 'text-[#FF3366]'}>
                {result.honeypot_details.can_sell ? 'Yes' : 'NO'}
              </span>
            </div>
            <div className="text-[#9DA0B0]">
              Buy Tax: <span className="text-[#F1F1F6]">{result.honeypot_details.buy_tax.toFixed(1)}%</span>
            </div>
            <div className="text-[#9DA0B0]">
              Sell Tax:{' '}
              <span className={result.honeypot_details.sell_tax > 50 ? 'text-[#FF3366]' : 'text-[#F1F1F6]'}>
                {result.honeypot_details.sell_tax.toFixed(1)}%
              </span>
            </div>
            <div className="text-[#9DA0B0]">
              Blacklist:{' '}
              <span className={result.honeypot_details.has_blacklist ? 'text-[#FF3366]' : 'text-emerald-400'}>
                {result.honeypot_details.has_blacklist ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Flags */}
      {result.flags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {result.flags.map((flag, i) => (
            <span key={i} className="badge badge-danger text-[9.5px]">
              <AlertTriangle className="w-3 h-3" />
              {flag}
            </span>
          ))}
        </div>
      )}

      {/* Verdict */}
      {result.verdict && (
        <div className="mt-3 p-3 rounded-[10px] bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)]">
          <p className="text-[12px] text-purple-300">
            <Eye className="w-3.5 h-3.5 inline mr-1" />
            {result.verdict}
          </p>
        </div>
      )}
    </motion.div>
  )
}

function SecurityBadge({
  icon: Icon,
  label,
  status,
  good,
  invert,
}: {
  icon: any
  label: string
  status: boolean
  good: boolean
  invert?: boolean
}) {
  const isGood = invert ? !status : status
  return (
    <div
      className={`flex items-center gap-2 p-2 rounded-[8px] ${
        isGood ? 'bg-emerald-500/5 border border-emerald-500/10' : 'bg-[#FF3366]/5 border border-[#FF3366]/10'
      }`}
    >
      <Icon className={`w-4 h-4 ${isGood ? 'text-emerald-400' : 'text-[#FF3366]'}`} />
      <span className={`text-[11px] ${isGood ? 'text-emerald-400' : 'text-[#FF3366]'}`}>{label}</span>
    </div>
  )
}
