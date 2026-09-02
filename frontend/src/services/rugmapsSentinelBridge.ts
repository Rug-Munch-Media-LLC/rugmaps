// SENTINEL bridge — connects the frontend to the backend scanning service.
//
// The standalone rugmaps backend exposes no dedicated per-token SENTINEL scan
// route, so this bridge maps the live /api/v1/rugmaps/token-graph payload
// (risk_score, risk_level, AI analysis red_flags, node entity data) onto the
// SentinelScanResult shape the UI expects. The token-graph route is the
// closest available endpoint — it runs the full holder-graph + AI analysis
// pipeline and returns the risk verdict + flags SENTINEL would surface.
//
// TODO: when a dedicated SENTINEL scan endpoint (e.g. /api/v1/sentinel/scan)
// is added to the backend, point sentinelScan() at it and drop the mapping.

import { fetchTokenGraph } from './rugmapsApi'

export interface HoneypotDetails {
  can_sell: boolean
  buy_tax: number
  sell_tax: number
  has_blacklist: boolean
}

export interface SentinelScanResult {
  risk_score: number
  risk_level: string
  contract_verified: boolean
  ownership_renounced: boolean
  liquidity_locked: boolean
  is_honeypot: boolean
  honeypot_details: HoneypotDetails
  flags: string[]
  verdict: string
  // biome-ignore lint/suspicious/noExplicitAny: API response shape varies by chain
  details?: any
}

export function getRiskColor(score: number): string {
  if (score >= 70) return '#FF3366'
  if (score >= 40) return '#FF9800'
  if (score >= 20) return '#FACC15'
  return '#10B981'
}

export function getRiskLabel(level: string): string {
  const labels: Record<string, string> = {
    low: 'Low Risk',
    medium: 'Medium Risk',
    high: 'High Risk',
    critical: 'CRITICAL',
  }
  return labels[level] || level
}

/**
 * Scan a token via the live /rugmaps/token-graph route and map the result onto
 * the SENTINEL shape. Returns null on any failure (honest empty state).
 */
export async function sentinelScan(tokenAddress: string, chain: string): Promise<SentinelScanResult | null> {
  const graph = await fetchTokenGraph(tokenAddress, chain)
  if (!graph) return null

  const analysis = graph.analysis ?? {}
  const redFlags: string[] = Array.isArray(analysis.red_flags) ? analysis.red_flags : []
  const greenFlags: string[] = Array.isArray(analysis.green_flags) ? analysis.green_flags : []

  // Derive honeypot / ownership signals from the AI analysis + node entity data.
  const text = [analysis.verdict, analysis.reasoning, ...redFlags, ...greenFlags]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  const isHoneypot = /honeypot|can'?t sell|no sell|sell blocked|rug pull|rugpull/.test(text)
  const ownershipRenounced = /renounce|ownership renounced|renounced/.test(text)
  const liquidityLocked = /liquidity locked|lp locked|locked liquidity/.test(text)
  const contractVerified = /verified|source verified|contract verified/.test(text)

  // Buy/sell tax heuristics — surfaced from the analysis text when present.
  const buyTax = extractPercent(text, /buy tax[:\s]*([\d.]+)%/)
  const sellTax = extractPercent(text, /sell tax[:\s]*([\d.]+)%/)
  const hasBlacklist = /blacklist|blacklist function/.test(text)

  const flags = [...redFlags]
  if (isHoneypot) flags.push('honeypot_detected')
  if (ownershipRenounced) flags.push('ownership_renounced')
  if (liquidityLocked) flags.push('liquidity_locked')

  return {
    risk_score: graph.risk_score ?? 0,
    risk_level: graph.risk_level ?? 'unknown',
    contract_verified: contractVerified,
    ownership_renounced: ownershipRenounced,
    liquidity_locked: liquidityLocked,
    is_honeypot: isHoneypot,
    honeypot_details: {
      can_sell: !isHoneypot,
      buy_tax: buyTax,
      sell_tax: sellTax,
      has_blacklist: hasBlacklist,
    },
    flags: Array.from(new Set(flags)).slice(0, 12),
    verdict: analysis.verdict || analysis.reasoning || 'No verdict available',
    details: { node_count: graph.node_count, data_quality: graph.data_quality, from_cache: graph.from_cache },
  }
}

/** Extract a percentage from a regex match, defaulting to 0. */
function extractPercent(text: string, re: RegExp): number {
  const m = text.match(re)
  if (!m?.[1]) return 0
  const n = Number.parseFloat(m[1])
  return Number.isFinite(n) ? n : 0
}
