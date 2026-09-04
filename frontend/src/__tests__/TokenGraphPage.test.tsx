import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TokenPage from '@/pages/TokenPage'
import { fetchTokenGraph } from '@/services/rugmapsApi'

// TokenGraphPage (TokenPage) render contract: given a mocked token-graph
// payload, the page must render the risk header, holder table, and the
// analysis panels — and show an honest empty state when the backend returns
// nothing.

vi.mock('@/services/rugmapsApi', () => ({
  fetchTokenGraph: vi.fn(),
}))

// Stub the heavy analysis panels so the render test stays focused.
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

const mockFetchTokenGraph = vi.mocked(fetchTokenGraph)

const GRAPH_PAYLOAD = {
  token_address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  chain: 'solana',
  nodes: [
    {
      id: 'n0',
      address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      value: 40,
      risk: 0,
      layer: 0,
      label: 'Token',
    },
    {
      id: 'n1',
      address: '0xholder1',
      value: 25,
      risk: 10,
      layer: 1,
      label: 'Binance',
      entity_type: 'exchange',
    },
    {
      id: 'n2',
      address: '0xholder2',
      value: 15,
      risk: 85,
      layer: 1,
      is_bundle: true,
    },
  ],
  links: [
    { source: 'n0', target: 'n1', value: 1 },
    { source: 'n0', target: 'n2', value: 1 },
  ],
  node_count: 3,
  link_count: 2,
  risk_score: 42,
  risk_level: 'medium',
  stats: {},
  data_quality: 'ok',
}

function renderTokenPage(chain = 'solana', address = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') {
  return render(
    <MemoryRouter initialEntries={[`/token/${chain}/${address}`]}>
      <Routes>
        <Route path="/token/:chain/:address" element={<TokenPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('TokenGraphPage (TokenPage)', () => {
  it('renders the risk header and holder table from the graph payload', async () => {
    mockFetchTokenGraph.mockResolvedValue(GRAPH_PAYLOAD as never)
    renderTokenPage()

    // Header shows chain + address ("Token solana" is split across a span,
    // so match the unique address text).
    expect(await screen.findByText('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')).toBeInTheDocument()

    // Risk badge reflects the payload risk
    expect(await screen.findByText(/Risk 42\/100/)).toBeInTheDocument()

    // Holder table renders the holder rows (addresses are truncated to
    // "0xhold...der1" form in the table).
    expect(screen.getByText('Holder Distribution')).toBeInTheDocument()
    expect(screen.getByText('0xhold...der1')).toBeInTheDocument()
    expect(screen.getByText('0xhold...der2')).toBeInTheDocument()

    // Analysis panels mount
    expect(screen.getByTestId('bubble-map-canvas')).toBeInTheDocument()
    expect(screen.getByTestId('sentinel-risk-meter')).toBeInTheDocument()
    expect(screen.getByTestId('rag-intelligence-panel')).toBeInTheDocument()
  })

  it('shows a loading state while the graph is being fetched', () => {
    mockFetchTokenGraph.mockReturnValue(new Promise(() => {}) as never)
    renderTokenPage()
    expect(screen.getByText('Building token graph...')).toBeInTheDocument()
  })

  it('renders an honest empty state when the backend returns null', async () => {
    mockFetchTokenGraph.mockResolvedValue(null as never)
    renderTokenPage()
    expect(await screen.findByText('Could not load token data')).toBeInTheDocument()
  })

  it('calls fetchTokenGraph with the route params', async () => {
    mockFetchTokenGraph.mockResolvedValue(GRAPH_PAYLOAD as never)
    renderTokenPage('ethereum', '0xabc123')
    await waitFor(() => expect(mockFetchTokenGraph).toHaveBeenCalledWith('0xabc123', 'ethereum'))
  })
})
