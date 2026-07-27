// ─── Scan Data Types ───────────────────────────────────────────
// Replaces `any` in ExportPanel's scanData prop

export interface TokenInfo {
  address: string
  chain: string
  symbol?: string
  name?: string
  decimals?: number
  total_supply?: number
  mint_authority?: string | null
  freeze_authority?: string | null
}

export interface LiquidityInfo {
  usd: number
  locked?: boolean
  lock_contract?: string | null
  lock_expiry?: number | null
  pair_address?: string
  dex?: string
}

export interface HolderInfo {
  address: string
  pct: number
  value_usd?: number
  label?: string
  is_bundle?: boolean
  is_dev?: boolean
  is_cex?: boolean
  risk_score?: number
}

export interface ContractAudit {
  has_mint_function?: boolean
  has_blacklist?: boolean
  has_whitelist?: boolean
  can_pause?: boolean
  is_proxy?: boolean
  suspicious_functions?: string[]
  verified?: boolean
  risk_flags: string[]
}

export interface ScanResult {
  token: TokenInfo
  risk_score: number
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  liquidity: LiquidityInfo
  holders: HolderInfo[]
  top_holder_pct: number
  holder_count: number
  creator_address?: string
  created_at?: number
  contract_audit?: ContractAudit
  is_honeypot?: boolean
  is_rugpull?: boolean
  flags: string[]
  scanned_at: string
}

// ─── AI Analysis Types ─────────────────────────────────────────
// Replaces `any` in ExportPanel's aiResult prop

export interface AIAnalysisSummary {
  verdict: 'safe' | 'suspicious' | 'dangerous' | 'unknown'
  confidence: number // 0-1
  reasoning: string
  red_flags: string[]
  green_flags: string[]
}

export interface DeployerAnalysis {
  address: string
  previous_tokens: number
  rugged_tokens: number
  rug_ratio: number
  avg_holding_period: number
  total_profit_usd: number
  associated_scams?: string[]
}

export interface MarketAnalysis {
  volume_anomaly: boolean
  wash_trading_probability: number
  price_manipulation_flags: string[]
  bundling_detected: boolean
  bundle_pct?: number
  sniper_count?: number
}

export interface AIAnalysisResult {
  summary: AIAnalysisSummary
  deployer: DeployerAnalysis
  market: MarketAnalysis
  report_url?: string
  model: string
  generated_at: string
}

// ─── Sentinel Result Types ──────────────────────────────────────
// Replaces `any` in ExportPanel's sentinelResult prop

export interface SentinelAlert {
  type:
    | 'holder_concentration'
    | 'liquidity_drop'
    | 'price_manipulation'
    | 'mint_activity'
    | 'ownership_change'
    | 'honeypot'
  severity: 'info' | 'warning' | 'critical'
  message: string
  timestamp: number
  value?: number | string
}

export interface SentinelResult {
  token_address: string
  chain: string
  risk_score: number
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  active_alerts: SentinelAlert[]
  historical_alerts: SentinelAlert[]
  monitoring_since: number
  last_checked: string
  watchers: number
}

// ─── Export Report Types ────────────────────────────────────────

export interface RugMapsReport {
  version: string
  generated_at: string
  token: {
    address: string
    chain: string
  }
  scan: ScanResult
  ai_analysis: AIAnalysisResult
  sentinel: SentinelResult
  hash: string
}

// ─── Supported Chains ──────────────────────────────────────────

export type SupportedChain = 'solana' | 'ethereum' | 'base' | 'bsc' | 'arbitrum' | 'optimism' | 'polygon'
