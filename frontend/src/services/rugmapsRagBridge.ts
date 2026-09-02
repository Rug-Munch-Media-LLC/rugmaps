// RAG intelligence bridge — queries the RAG vector store for historical
// scam/deployer intelligence.
//
// The standalone rugmaps backend exposes no dedicated RAG search route, so
// this bridge maps the live /api/v1/rugmaps/token-graph payload onto the RAG
// shapes the UI expects. The token-graph route runs the full AI + RAG pipeline
// and returns `similar_scams` (semantic search over the scam corpus) plus the
// AI `analysis` verdict — the closest available endpoint to a raw RAG query.
//
// TODO: when a dedicated RAG route (e.g. /api/v1/rag/search) is added to the
// backend, point searchRAG()/getDeployerRisk() at it and drop the mapping.

import { fetchTokenGraph } from './rugmapsApi'

export interface RAGSearchResult {
  id: string
  title: string
  content: string
  relevance_score: number
  source: string
  timestamp: number
  metadata?: {
    scam_type?: string
  }
  excerpt?: string
  score?: number
}

export interface DeployerRisk {
  address: string
  risk_score: number
  previous_tokens: number
  rugged_tokens: number
  flags: string[]
  deployment_count: number
  previous_rugs: number
  mixer_funded: boolean
  rapid_deploy: boolean
  verdict: string
}

/**
 * Semantic search over the scam corpus. Mapped from the live token-graph
 * `similar_scams` array (the backend's RAG cache of similar scam patterns).
 */
export async function searchRAG(
  _query: string,
  tokenAddress: string,
  chain: string,
  _limit?: number,
): Promise<RAGSearchResult[]> {
  const graph = await fetchTokenGraph(tokenAddress, chain)
  const scams = graph?.similar_scams ?? []
  return scams.map((s, i) => ({
    id: String(s.id ?? `scam_${i}`),
    title: String(s.title ?? s.excerpt ?? 'Similar scam pattern'),
    content: String(s.content ?? s.excerpt ?? ''),
    relevance_score: Number(s.relevance_score ?? s.score ?? 0),
    source: String(s.source ?? ''),
    timestamp: Number(s.timestamp ?? Date.now()),
    metadata: { scam_type: s.metadata?.scam_type },
    excerpt: s.excerpt ?? s.content,
    score: Number(s.score ?? s.relevance_score ?? 0),
  }))
}

/**
 * Deployer risk profile. Mapped from the live token-graph AI analysis + risk
 * verdict — the closest available endpoint to a dedicated deployer-risk query.
 */
export async function getDeployerRisk(address: string, chain: string): Promise<DeployerRisk | null> {
  const graph = await fetchTokenGraph(address, chain)
  if (!graph) return null

  const analysis = graph.analysis ?? {}
  const redFlags: string[] = Array.isArray(analysis.red_flags) ? analysis.red_flags : []
  const text = [analysis.verdict, analysis.reasoning, ...redFlags].filter(Boolean).join(' ').toLowerCase()

  const previousRugs = countMatches(text, /rug|rugpull|scam|honeypot/g)
  const mixerFunded = /mixer|tornado|railgun|obfuscat/.test(text)
  const rapidDeploy = /rapid deploy|multiple deploy|serial deployer|factory/.test(text)

  return {
    address,
    risk_score: graph.risk_score ?? 0,
    previous_tokens: graph.node_count ?? 0,
    rugged_tokens: previousRugs,
    flags: redFlags.slice(0, 8),
    deployment_count: graph.node_count ?? 0,
    previous_rugs: previousRugs,
    mixer_funded: mixerFunded,
    rapid_deploy: rapidDeploy,
    verdict: analysis.verdict || analysis.reasoning || 'No deployer verdict available',
  }
}

/**
 * Cross-chain identity resolution. The standalone backend has no cross-chain
 * identity route, so this returns null (honest empty) and logs the intent.
 * TODO: wire to a cross-chain identity endpoint when one is available.
 */
export async function getCrossChainIdentity(
  _address: string,
  _chain: string,
  // biome-ignore lint/suspicious/noExplicitAny: cross-chain identity shape varies
): Promise<any> {
  // No cross-chain identity endpoint exists on the standalone rugmaps backend.
  // The RAGIntelligencePanel renders an honest empty state when this is null.
  return null
}

/** Count regex matches (used for heuristic deployer-risk signals). */
function countMatches(text: string, re: RegExp): number {
  const matches = text.match(re)
  return matches ? matches.length : 0
}
