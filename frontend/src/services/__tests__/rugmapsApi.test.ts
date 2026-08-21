import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  analyzeUrl,
  deployerProfileUrl,
  entityUrl,
  fetchDeployerProfile,
  fetchFundFlows,
  fetchRugmapsAnalyze,
  fundFlowsToRawHops,
  fundFlowsUrl,
  tokenGraphUrl,
} from '../rugmapsApi'

const ADDR = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

function mockFetchOk(body: unknown) {
  return vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('rugmapsApi URL builders (must target LIVE backend routes)', () => {
  it('analyzeUrl hits the live /rugmaps/analyze/{address} route', () => {
    expect(analyzeUrl(ADDR, 'solana')).toBe(`/api/v1/rugmaps/analyze/${ADDR}?chain=solana`)
  })

  it('analyzeUrl URL-encodes the address', () => {
    expect(analyzeUrl('a/b c', 'base')).toBe('/api/v1/rugmaps/analyze/a%2Fb%20c?chain=base')
  })

  it('entityUrl hits the live /rugmaps/entity/{address} route', () => {
    expect(entityUrl(ADDR)).toBe(`/api/v1/rugmaps/entity/${ADDR}`)
  })

  it('fundFlowsUrl hits the live /rugmaps/fund-flows route with required params', () => {
    const url = fundFlowsUrl({ token: 'TOK', address: ADDR, chain: 'solana', hops: 2 })
    expect(url).toContain('/api/v1/rugmaps/fund-flows?')
    const qs = new URLSearchParams(url.split('?')[1])
    expect(qs.get('token')).toBe('TOK')
    expect(qs.get('address')).toBe(ADDR)
    expect(qs.get('chain')).toBe('solana')
    expect(qs.get('hops')).toBe('2')
  })

  it('fundFlowsUrl defaults chain=solana and hops=1', () => {
    const url = fundFlowsUrl({ token: 'TOK', address: ADDR })
    const qs = new URLSearchParams(url.split('?')[1])
    expect(qs.get('chain')).toBe('solana')
    expect(qs.get('hops')).toBe('1')
  })

  it('tokenGraphUrl hits the live /rugmaps/token-graph route', () => {
    const url = tokenGraphUrl(ADDR)
    expect(url).toContain('/api/v1/rugmaps/token-graph?')
    const qs = new URLSearchParams(url.split('?')[1])
    expect(qs.get('token_address')).toBe(ADDR)
  })

  it('deployerProfileUrl hits the live /scoring/deployer/{chain}/{address} route', () => {
    expect(deployerProfileUrl(ADDR, 'ethereum')).toBe(`/api/v1/scoring/deployer/ethereum/${ADDR}`)
  })

  it('never builds known-dead paths (regression guard)', () => {
    const built = [analyzeUrl(ADDR), entityUrl(ADDR), fundFlowsUrl({ token: 'T', address: ADDR }), tokenGraphUrl(ADDR), deployerProfileUrl(ADDR)]
    const dead = ['/rugmaps/scan', '/rugmaps/deployer-tokens', '/rugmaps/rug-warning', '/investigate/fund-flow', '/rugmaps/holders']
    for (const url of built) {
      for (const d of dead) {
        expect(url).not.toContain(d)
      }
    }
  })
})

describe('rugmapsApi fetchers (mocked network — no live backend calls)', () => {
  it('fetchRugmapsAnalyze maps the live 200 payload', async () => {
    const payload = {
      address: ADDR,
      node_count: 12,
      link_count: 20,
      risk_level: 'high',
      risk_score: 72,
      stats: { nodes: 12, links: 20, total_volume: 1000, total_transactions: 55, unique_wallets: 11 },
      top_counterparties: ['0xabc...'],
    }
    const f = mockFetchOk(payload)
    vi.stubGlobal('fetch', f)

    const result = await fetchRugmapsAnalyze(ADDR, 'solana')
    expect(f).toHaveBeenCalledWith(analyzeUrl(ADDR, 'solana'))
    expect(result).toEqual(payload)
    expect(result?.risk_score).toBe(72)
  })

  it('fetchRugmapsAnalyze returns null (honest empty) on non-2xx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }))
    expect(await fetchRugmapsAnalyze(ADDR)).toBeNull()
  })

  it('fetchRugmapsAnalyze returns null on network error (never throws)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')))
    expect(await fetchRugmapsAnalyze(ADDR)).toBeNull()
  })

  it('fetchFundFlows calls the live route with token+address+hops', async () => {
    const f = mockFetchOk({ inbound: [], outbound: [] })
    vi.stubGlobal('fetch', f)
    const result = await fetchFundFlows({ token: 'TOK', address: ADDR, hops: 2 })
    expect(f).toHaveBeenCalledWith(fundFlowsUrl({ token: 'TOK', address: ADDR, chain: 'solana', hops: 2 }))
    expect(result).toEqual({ inbound: [], outbound: [] })
  })

  it('fetchDeployerProfile maps the scoring route payload (profile may be null)', async () => {
    const f = mockFetchOk({ success: true, profile: null, is_factory: false, real_deployer: null })
    vi.stubGlobal('fetch', f)
    const result = await fetchDeployerProfile(ADDR, 'solana')
    expect(f).toHaveBeenCalledWith(deployerProfileUrl(ADDR, 'solana'))
    expect(result?.success).toBe(true)
    expect(result?.profile).toBeNull()
  })
})

describe('fundFlowsToRawHops (live payload → tracer records)', () => {
  it('maps inbound/outbound transfer records (inbound first)', () => {
    const hops = fundFlowsToRawHops({
      token: 'TOK',
      address: ADDR,
      chain: 'solana',
      inbound: [{ from: '0xFUNDER', to: ADDR, token: 'SOL', usd: 1200.5, tx_count: 3, tx_hashes: ['h1', 'h2'] }],
      outbound: [{ from: ADDR, to: '0xDEX', token: 'TOK', usd: 400, tx_count: 1, tx_hashes: [] }],
      source: 'wallet_flow_clickhouse',
    })
    expect(hops).toHaveLength(2)
    expect(hops[0]).toMatchObject({
      from_address: '0xFUNDER',
      to_address: ADDR,
      amount_usd: 1200.5,
      tx_hash: 'h1',
      direction: 'inbound',
    })
    expect(hops[1]).toMatchObject({ from_address: ADDR, to_address: '0xDEX', amount_usd: 400, tx_hash: '' })
  })

  it('returns [] for null / missing arrays (honest empty, no crash)', () => {
    expect(fundFlowsToRawHops(null)).toEqual([])
    expect(fundFlowsToRawHops({})).toEqual([])
    expect(fundFlowsToRawHops({ inbound: [null, 'junk', { from: 'a', to: 'b', usd: 1 }] })).toHaveLength(1)
  })
})
