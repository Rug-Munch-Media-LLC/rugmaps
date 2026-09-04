import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '@/App'

// App routing contract: the three top-level routes must render their pages.
// We mock the token-graph fetch so the token page renders without a backend.

vi.mock('@/services/rugmapsApi', () => ({
  fetchTokenGraph: vi.fn().mockResolvedValue({
    token_address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    chain: 'solana',
    nodes: [
      { id: 'n0', address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', value: 40, risk: 0, layer: 0 },
      { id: 'n1', address: '0xholder1', value: 20, risk: 10, layer: 1 },
    ],
    links: [{ source: 'n0', target: 'n1', value: 1 }],
    node_count: 2,
    link_count: 1,
    risk_score: 10,
    risk_level: 'low',
    stats: {},
    data_quality: 'ok',
  }),
}))

// The token page mounts several heavy analysis panels (canvas, RAG, sentinel).
// Stub them out so the routing test stays focused and fast.
vi.mock('@/components/rugmaps/BubbleMapCanvas', () => ({
  default: () => <div data-testid="bubble-map-canvas" />,
}))
vi.mock('@/components/rugmaps/SentinelRiskMeter', () => ({
  default: () => <div data-testid="sentinel-risk-meter" />,
}))
vi.mock('@/components/rugmaps/BotNetworkPanel', () => ({
  default: () => <div data-testid="bot-network-panel" />,
}))
vi.mock('@/components/rugmaps/ContractDeepDive', () => ({
  default: () => <div data-testid="contract-deep-dive" />,
}))
vi.mock('@/components/rugmaps/GasFundingTracer', () => ({
  default: () => <div data-testid="gas-funding-tracer" />,
}))
vi.mock('@/components/rugmaps/DeployerNetwork', () => ({
  default: () => <div data-testid="deployer-network" />,
}))
vi.mock('@/components/rugmaps/FundingSourceTracer', () => ({
  default: () => <div data-testid="funding-source-tracer" />,
}))
vi.mock('@/components/rugmaps/RAGIntelligencePanel', () => ({
  default: () => <div data-testid="rag-intelligence-panel" />,
}))

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('App routing', () => {
  it('renders the home page at /', () => {
    renderAt('/')
    expect(screen.getByText('RugMaps')).toBeInTheDocument()
    expect(screen.getByText(/Token Holder/)).toBeInTheDocument()
    expect(screen.getByText('Analyze')).toBeInTheDocument()
  })

  it('renders the search page at /search', () => {
    renderAt('/search')
    // "Search a Token" is split across a span; match the unique placeholder instead.
    expect(screen.getByPlaceholderText(/Token address/)).toBeInTheDocument()
    expect(screen.getByText('Analyze')).toBeInTheDocument()
  })

  it('renders the token page at /token/:chain/:address', async () => {
    renderAt('/token/solana/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
    // Token page header shows the chain and address ("Token solana" is split
    // across a span, so match the unique address text instead).
    expect(await screen.findByText('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')).toBeInTheDocument()
    // The mocked analysis panels mount
    expect(screen.getByTestId('bubble-map-canvas')).toBeInTheDocument()
  })

  it('renders the token page for an ethereum token', async () => {
    renderAt('/token/ethereum/0xabc123')
    expect(await screen.findByText('0xabc123')).toBeInTheDocument()
  })
})
