// [REVIEW] Stub — replace with real Sentinel API integration
// This bridge connects the frontend to the backend Sentinel scanning service.

export interface SentinelScanResult {
  risk_score: number
  risk_level: string
  // biome-ignore lint/suspicious/noExplicitAny: API response shape varies by chain
  details: any
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

export async function sentinelScan(tokenAddress: string, chain: string): Promise<SentinelScanResult | null> {
  // TODO: Replace with real API call to sentinel backend
  console.debug(`[SentinelBridge] scan(${tokenAddress}, ${chain})`)
  return null
}
