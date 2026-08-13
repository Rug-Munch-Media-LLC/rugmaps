// Domain helpers for FundingSourceTracer. Co-located, no React.

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

export type FundingHopType = FundingHop['from_type']

export interface TypeMeta {
  color: string
  icon: string
  label: string
}

export const TYPE_META: Record<FundingHopType, TypeMeta> = {
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

export function getTxExplorerUrl(chain: string, hash: string): string {
  const base = EXPLORERS[chain] || EXPLORERS.ethereum
  return base + hash
}

/** Address link that intentionally falls back to a bare relative URL for unknown chains. */
export function getExplorerLink(chain: string, address: string): string {
  return `${EXPLORERS[chain] || ''}${address}`
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

export function classifyAddress(_addr: string, label?: string): FundingHopType {
  if (label) {
    const l = label.toLowerCase()
    if (KNOWN_CEX.has(l) || l.includes('exchange') || l.includes('binance') || l.includes('coinbase')) return 'cex'
    if (KNOWN_MIXERS.has(l) || l.includes('mixer') || l.includes('tornado')) return 'mixer'
    if (l.includes('bridge')) return 'bridge'
    if (l.includes('dex') || l.includes('uniswap') || l.includes('jupiter') || l.includes('raydium')) return 'dex'
  }
  return 'wallet'
}

/** Map raw API hop payloads into FundingHop records. */
export function normalizeFundingHops(raw: any[], fallbackTo: string, fallbackChain: string): FundingHop[] {
  return raw.map((h: any, i: number) => ({
    from_address: h.from_address || h.from || '',
    from_label: h.from_label || h.source_label,
    from_type: classifyAddress(h.from_address || '', h.from_label),
    to_address: h.to_address || h.to || fallbackTo,
    to_label: h.to_label || h.dest_label,
    to_type: classifyAddress(h.to_address || fallbackTo, h.to_label),
    amount_usd: Number(h.amount_usd || h.value_usd || h.amount || 0),
    timestamp: Number(h.timestamp || h.time || Date.now() / 1000),
    tx_hash: h.tx_hash || h.hash || '',
    chain: h.chain || fallbackChain,
    hops: Number(h.hops || h.depth || i + 1),
    confidence: Number(h.confidence || 70),
    tainted_pct: Number(h.tainted_pct || h.taint || 0),
  }))
}

export interface SourceStat {
  count: number
  total_usd: number
}

/** Aggregate funding amounts per source type. */
export function computeSourceStats(hops: FundingHop[]): Record<string, SourceStat> {
  const stats: Record<string, SourceStat> = {}
  for (const h of hops) {
    const key = h.from_type
    if (!stats[key]) stats[key] = { count: 0, total_usd: 0 }
    stats[key].count++
    stats[key].total_usd += h.amount_usd
  }
  return stats
}

export interface TaintVerdict {
  level: 'HIGH_TAINT' | 'CEX_FUNDED' | 'MIXED' | 'PEER_TO_PEER' | 'UNKNOWN'
  pct: number
  reason: string
}

/** Detection: did funding flow through CEX or mixer? */
export function computeTaint(hops: FundingHop[], sourceStats: Record<string, SourceStat>): TaintVerdict {
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
}

export const TAINT_COLORS: Record<TaintVerdict['level'], string> = {
  HIGH_TAINT: '#FF3366',
  CEX_FUNDED: '#06D6A0',
  MIXED: '#FFB800',
  PEER_TO_PEER: '#22D3EE',
  UNKNOWN: '#5C6080',
}
