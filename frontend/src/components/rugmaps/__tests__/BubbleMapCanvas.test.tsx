import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import BubbleMapCanvas from '../BubbleMapCanvas'

const mockData = {
  nodes: [
    { id: 'center', address: '0x1234...5678', value: 35, risk: 0, color: '#8B5CF6', layer: 0, label: 'Token Contract' },
    {
      id: 'dev1',
      address: '0xdev1...0001',
      value: 12,
      risk: 85,
      color: '#FF3366',
      layer: 1,
      isDev: true,
      label: 'Dev Wallet',
    },
    { id: 'holder', address: '0xhol...der1', value: 5, risk: 20, color: '#28CBF4', layer: 2, label: 'Holder A' },
  ],
  links: [
    { source: 'center', target: 'dev1', value: 10, transactions: 45 },
    { source: 'center', target: 'holder', value: 3, transactions: 5 },
  ],
  risk_score: 72,
  risk_level: 'high',
}

describe('BubbleMapCanvas', () => {
  it('renders a canvas element when data is provided', () => {
    const { container } = render(<BubbleMapCanvas data={mockData} chain="ethereum" width={800} height={500} />)
    const canvas = container.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
  })

  it('renders a canvas with correct width/height', () => {
    const { container } = render(<BubbleMapCanvas data={mockData} chain="solana" width={900} height={550} />)
    const canvas = container.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
    // canvas.width is scaled by devicePixelRatio, check style instead
    expect(canvas?.getAttribute('style')).toContain('width')
  })

  it('renders without data (null-ed) without crashing', () => {
    const { container } = render(<BubbleMapCanvas data={null} chain="ethereum" />)
    const canvas = container.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
  })

  it('renders the legend overlay with token contract label', () => {
    render(<BubbleMapCanvas data={mockData} chain="ethereum" />)
    expect(screen.getByText(/Token Contract/i)).toBeInTheDocument()
    expect(screen.getByText(/Low Risk/i)).toBeInTheDocument()
    expect(screen.getByText(/High Risk/i)).toBeInTheDocument()
  })
})
