import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import TokenGraphCanvas from '../TokenGraphCanvas'

const nodes = [
  { id: 'center', label: 'Token Contract' },
  { id: 'dev1', label: 'Dev Wallet', size: 24 },
  { id: 'bundle1', label: 'Bundle Wallet 1' },
  { id: 'holder1', label: 'Holder A' },
]

const edges = [
  { source: 'center', target: 'dev1', value: 10 },
  { source: 'center', target: 'bundle1', value: 8 },
  { source: 'center', target: 'holder1', value: 3 },
  { source: 'dev1', target: 'bundle1', value: 5 },
]

describe('TokenGraphCanvas', () => {
  it('renders an empty state when no nodes are provided', () => {
    render(<TokenGraphCanvas nodes={[]} edges={[]} />)
    expect(screen.getByText(/No token relationships to visualize/i)).toBeInTheDocument()
  })

  it('renders a graph container with an accessible label when data is provided', async () => {
    const { container } = render(<TokenGraphCanvas nodes={nodes} edges={edges} width={500} height={360} />)
    const host = container.querySelector('[data-token-graph]')
    expect(host).toBeInTheDocument()
    expect(host?.getAttribute('aria-label')).toContain('4 nodes and 4 edges')
    await waitFor(() => {
      expect(screen.queryByText(/Layout running/i)).not.toBeInTheDocument()
    })
  })

  it('mounts and settles without crashing even when canvas support is limited', async () => {
    // happy-dom lacks a full canvas/WebGL implementation; the component must either
    // finish rendering or degrade to an error state instead of throwing.
    const { container } = render(<TokenGraphCanvas nodes={nodes} edges={edges} width={500} height={360} />)
    const host = container.querySelector('[data-token-graph]')
    expect(host).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText(/Layout running/i)).not.toBeInTheDocument()
    })
    // After settling, either the renderer became ready or it degraded gracefully.
    expect(screen.getByText(/4 nodes · 4 edges/i)).toBeInTheDocument()
  })
})
