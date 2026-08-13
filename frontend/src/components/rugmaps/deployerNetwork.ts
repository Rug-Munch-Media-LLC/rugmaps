// Domain helpers for DeployerNetwork. Co-located, no React.

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

export interface ChainMeta {
  name: string
  color: string
  icon: string
}

export const CHAIN_META: Record<string, ChainMeta> = {
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

export function getTokenExplorerUrl(chain: string, address: string): string {
  const base = EXPLORERS[chain] || EXPLORERS.solana
  return base + address
}

/** Map raw API token payloads into DeployerToken records. */
export function normalizeDeployerTokens(raw: any[]): DeployerToken[] {
  return raw.map((t: any) => ({
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
  }))
}

export interface DeployerStats {
  total: number
  rugged: number
  rugRate: number
  totalVolume: number
  totalRugLoss: number
  avgRugPct: number
}

/** Aggregate deployer stats: total tokens, rug count, rug rate, volume, loss. */
export function computeDeployerStats(tokens: DeployerToken[]): DeployerStats {
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
}

export interface DeployerVerdict {
  level: string
  label: string
  color: string
}

/** Risk verdict based on rug rate. */
export function computeVerdict(stats: DeployerStats): DeployerVerdict {
  if (stats.total < 3) return { level: 'UNKNOWN', label: 'Insufficient data', color: '#5C6080' }
  if (stats.rugRate >= 80) return { level: 'SERIAL_RUGGER', label: 'SERIAL RUGGER', color: '#FF3366' }
  if (stats.rugRate >= 50) return { level: 'HIGH_RISK', label: 'HIGH RISK DEPLOYER', color: '#FF8C42' }
  if (stats.rugRate >= 25) return { level: 'MODERATE_RISK', label: 'Moderate risk', color: '#FFB800' }
  return { level: 'LOW_RISK', label: 'Mostly legit', color: '#06D6A0' }
}

export function formatDate(ts: number) {
  const d = new Date(ts * 1000)
  return d.toISOString().split('T')[0]
}

export function formatUSD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}
