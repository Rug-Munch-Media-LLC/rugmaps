import { describe, expect, it } from 'vitest'

import { getNodeColor, nodeRadius, normalizeBubbleNodes } from '../bubbleMapCanvas'

// Data mapping (API payload → node attributes) MUST be deterministic: the
// same input always renders the same sizes/colors. Layout jitter
// (simulateForceLayout initial positions) is a separate concern and is NOT
// part of the data mapping contract tested here.

describe('normalizeBubbleNodes (API payload → BubbleNode)', () => {
  it('maps address/value/risk fields from the raw payload', () => {
    const nodes = normalizeBubbleNodes([
      { address: '0xA', value: 35, risk: 0, layer: 0 },
      { address: '0xB', supply_pct: 12, risk_score: 85, layer: 1, is_dev: true },
      { address: '0xC', pct: 5, risk: 20, layer: 2, is_bundle: true, cluster_id: 'cl1' },
    ])
    expect(nodes).toHaveLength(3)
    expect(nodes[0]).toMatchObject({ address: '0xA', value: 35, risk: 0, layer: 0 })
    expect(nodes[1]).toMatchObject({ address: '0xB', value: 12, risk: 85, layer: 1, isDev: true })
    expect(nodes[2]).toMatchObject({ address: '0xC', value: 5, risk: 20, layer: 2, isBundle: true, clusterId: 'cl1' })
  })

  it('is deterministic — same input maps to identical output every time', () => {
    const raw = [
      { address: '0xA', value: 10, risk: 75, layer: 0 },
      { address: '0xB', value: 8, risk: 45, layer: 1 },
      { address: '0xC', value: 3, risk: 10, layer: 2 },
    ]
    const a = normalizeBubbleNodes(raw.map((n) => ({ ...n })))
    const b = normalizeBubbleNodes(raw.map((n) => ({ ...n })))
    expect(a).toEqual(b)
  })

  it('derives color from risk+layer when the payload has no explicit color', () => {
    const nodes = normalizeBubbleNodes([
      { address: '0xCENTER', value: 40, risk: 0, layer: 0 },
      { address: '0xRISKY', value: 20, risk: 85, layer: 1 },
      { address: '0xMED', value: 10, risk: 45, layer: 2 },
      { address: '0xLOW', value: 5, risk: 10, layer: 2 },
    ])
    // Layer 0 = center purple regardless of risk.
    expect(nodes[0]?.color).toBe(getNodeColor(0, 0))
    // Non-center nodes must be colored by RISK, not painted with the center
    // color: high=red, medium=orange, low=cyan.
    expect(nodes[1]?.color).toBe('#FF3366')
    expect(nodes[2]?.color).toBe('#FF9800')
    expect(nodes[3]?.color).toBe('#28CBF4')
  })

  it('respects explicit colors from the payload', () => {
    const nodes = normalizeBubbleNodes([{ address: '0xA', value: 1, risk: 90, layer: 1, color: '#123456' }])
    expect(nodes[0]?.color).toBe('#123456')
  })

  it('falls back to sane defaults for sparse rows', () => {
    const nodes = normalizeBubbleNodes([{}, { id: 'x' }])
    expect(nodes[0]).toMatchObject({ id: 'addr_0', value: 1, risk: 0, layer: 0 })
    expect(nodes[1]).toMatchObject({ id: 'x', layer: 1 })
  })
})

describe('nodeRadius (value → pixel size)', () => {
  it('scales monotonically with value (bigger holder → bigger bubble)', () => {
    expect(nodeRadius(5, 100)).toBeLessThan(nodeRadius(50, 100))
    expect(nodeRadius(50, 100)).toBeLessThan(nodeRadius(100, 100))
  })

  it('is deterministic for the same input', () => {
    expect(nodeRadius(12, 35)).toBe(nodeRadius(12, 35))
  })

  it('handles degenerate maxValue without NaN', () => {
    const r = nodeRadius(0, 0)
    expect(Number.isFinite(r)).toBe(true)
  })
})

describe('getNodeColor (risk+layer → color)', () => {
  it('returns the center color for layer 0', () => {
    expect(getNodeColor(99, 0)).toBe('#8B5CF6')
  })

  it('buckets risk into red/orange/cyan for non-center layers', () => {
    expect(getNodeColor(70, 1)).toBe('#FF3366')
    expect(getNodeColor(40, 2)).toBe('#FF9800')
    expect(getNodeColor(39, 1)).toBe('#28CBF4')
  })
})
