// Typed API client for RugMaps — the single gateway to the backend.
//
// Every URL builder below targets a route VERIFIED LIVE on the backend
// (app/routers/rugmaps_router.py + scoring_router.py, probed 2026-08-21):
//
//   GET /api/v1/rugmaps/analyze/{address}?chain=         → holder-graph summary
//   GET /api/v1/rugmaps/entity/{address}                 → entity info + risk
//   GET /api/v1/rugmaps/fund-flows?token&address&chain&hops → wallet fund flows
//   GET /api/v1/rugmaps/token-graph?token_address        → full holder graph
//   GET /api/v1/scoring/deployer/{chain}/{address}       → deployer profile
//
// Components must go through this module — raw `fetch('/api/v1/...')` calls
// elsewhere are caught by src/__tests__/noDeadEndpoints.test.ts (dead-path
// regression guard; the old /rugmaps/deployer-tokens + /investigate/fund-flow
// calls 404'd silently and rendered fake empty panels).

export interface RugmapsAnalyzeResult {
  address: string
  node_count: number
  link_count: number
  risk_level: string
  risk_score: number
  stats: {
    nodes?: number
    links?: number
    total_volume?: number
    total_transactions?: number
    unique_wallets?: number
  }
  top_counterparties: string[]
}

export interface RugmapsEntityResult {
  address: string
  // biome-ignore lint/suspicious/noExplicitAny: entity info shape varies by chain
  entity: any
  risk_score: number
  risk_level: string
}

export interface FundFlowsResult {
  // biome-ignore lint/suspicious/noExplicitAny: wallet_flow engine payload varies
  [key: string]: any
}

export interface DeployerProfileResponse {
  success: boolean
  // biome-ignore lint/suspicious/noExplicitAny: profile dict from deployer_tracker
  profile: Record<string, any> | null
  is_factory: boolean
  real_deployer: string | null
}

export const API_BASE = '/api/v1'

/** Holder-graph summary for a token (live: rugmaps_router.rugmaps_analysis). */
export function analyzeUrl(address: string, chain = 'solana'): string {
  return `${API_BASE}/rugmaps/analyze/${encodeURIComponent(address)}?chain=${encodeURIComponent(chain)}`
}

/** Entity info + risk for a wallet (live: rugmaps_router.get_entity_info). */
export function entityUrl(address: string): string {
  return `${API_BASE}/rugmaps/entity/${encodeURIComponent(address)}`
}

/** Inbound/outbound transfers for a wallet node (live: rugmaps_router.rugmaps_fund_flows). */
export function fundFlowsUrl(params: { token: string; address: string; chain?: string; hops?: number }): string {
  const qs = new URLSearchParams({
    token: params.token,
    address: params.address,
    chain: params.chain ?? 'solana',
    hops: String(params.hops ?? 1),
  })
  return `${API_BASE}/rugmaps/fund-flows?${qs.toString()}`
}

/** Full holder graph (live: rugmaps_router.token_holder_graph). */
export function tokenGraphUrl(tokenAddress: string, chain = 'solana'): string {
  const qs = new URLSearchParams({ token_address: tokenAddress, chain })
  return `${API_BASE}/rugmaps/token-graph?${qs.toString()}`
}

/** Deployer profile (live: scoring_router.get_deployer). */
export function deployerProfileUrl(address: string, chain = 'solana'): string {
  return `${API_BASE}/scoring/deployer/${encodeURIComponent(chain)}/${encodeURIComponent(address)}`
}

/** GET + parse JSON. Returns null on any failure (never throws) — callers
 * render an honest empty state instead of crashing. */
async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export function fetchRugmapsAnalyze(address: string, chain = 'solana'): Promise<RugmapsAnalyzeResult | null> {
  return getJson<RugmapsAnalyzeResult>(analyzeUrl(address, chain))
}

export function fetchRugmapsEntity(address: string): Promise<RugmapsEntityResult | null> {
  return getJson<RugmapsEntityResult>(entityUrl(address))
}

export function fetchFundFlows(params: {
  token: string
  address: string
  chain?: string
  hops?: number
}): Promise<FundFlowsResult | null> {
  return getJson<FundFlowsResult>(fundFlowsUrl(params))
}

export function fetchDeployerProfile(address: string, chain = 'solana'): Promise<DeployerProfileResponse | null> {
  return getJson<DeployerProfileResponse>(deployerProfileUrl(address, chain))
}

/** Raw transfer record shape produced by {@link fundFlowsToRawHops}. */
export interface RawFundFlowHop {
  from_address: string
  to_address: string
  amount_usd: number
  tx_hash: string
  tx_count?: number
  token?: string
  direction: 'inbound' | 'outbound'
}

/**
 * Map the live /rugmaps/fund-flows payload ({inbound, outbound} arrays of
 * {from, to, token, usd, tx_count, tx_hashes}) into flat records accepted by
 * FundingSourceTracer's normalizeFundingHops. Inbound records come first —
 * the tracer is a backward funding trace.
 */
export function fundFlowsToRawHops(data: FundFlowsResult | null): RawFundFlowHop[] {
  if (!data) return []
  const map = (rec: unknown, direction: RawFundFlowHop['direction']): RawFundFlowHop | null => {
    if (!rec || typeof rec !== 'object') return null
    const r = rec as Record<string, unknown>
    const hashes = Array.isArray(r.tx_hashes) ? r.tx_hashes : []
    return {
      from_address: String(r.from ?? ''),
      to_address: String(r.to ?? ''),
      amount_usd: Number(r.usd ?? 0),
      tx_hash: String(hashes[0] ?? ''),
      tx_count: r.tx_count === undefined ? undefined : Number(r.tx_count),
      token: r.token === undefined ? undefined : String(r.token),
      direction,
    }
  }
  const inbound = (Array.isArray(data.inbound) ? data.inbound : []).map((r) => map(r, 'inbound'))
  const outbound = (Array.isArray(data.outbound) ? data.outbound : []).map((r) => map(r, 'outbound'))
  return [...inbound, ...outbound].filter((h): h is RawFundFlowHop => h !== null)
}
