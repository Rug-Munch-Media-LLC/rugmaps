// Pure canvas + data-mapping helpers for BubbleMapCanvas.
// Kept co-located with the component; no React imports here.

export interface BubbleNode {
  id: string
  address: string
  label?: string
  x?: number
  y?: number
  vx?: number
  vy?: number
  value: number // size — supply % or token amount
  risk: number // 0-100
  color: string
  layer: number // 0 = center, 1 = direct, 2 = 2-hop
  isDev?: boolean
  isBundle?: boolean
  clusterId?: string
  balance?: number // optional wallet balance in USD
}

export interface BubbleLink {
  source: string
  target: string
  value: number // strength
  transactions?: number
}

export interface BubbleMapData {
  nodes: BubbleNode[]
  links: BubbleLink[]
  risk_score?: number
  risk_level?: string
}

export interface BubblePanState {
  x: number
  y: number
  scale: number
}

export interface BubblePoint {
  x: number
  y: number
}

// Explorer URLs per chain
const EXPLORERS: Record<string, string> = {
  solana: 'https://solscan.io/account/',
  ethereum: 'https://etherscan.io/address/',
  base: 'https://basescan.org/address/',
  bsc: 'https://bscscan.com/address/',
  arbitrum: 'https://arbiscan.io/address/',
  optimism: 'https://optimistic.etherscan.io/address/',
  polygon: 'https://polygonscan.com/address/',
}

export function getExplorerUrl(chain: string, address: string): string {
  const base = EXPLORERS[chain] || EXPLORERS.ethereum
  return base + address
}

export function getNodeColor(risk: number, layer: number): string {
  if (layer === 0) return '#8B5CF6' // Purple for center
  if (risk >= 70) return '#FF3366' // Red for high risk
  if (risk >= 40) return '#FF9800' // Orange for medium
  return '#28CBF4' // Cyan for low risk
}

const NODE_RADIUS_MIN = 6
const NODE_RADIUS_MAX = 36

export function nodeRadius(value: number, maxValue: number): number {
  if (maxValue <= 0) return NODE_RADIUS_MIN + 4
  const ratio = Math.sqrt(value / maxValue)
  return NODE_RADIUS_MIN + ratio * (NODE_RADIUS_MAX - NODE_RADIUS_MIN)
}

/** Map raw API payload nodes into BubbleNode records. */
export function normalizeBubbleNodes(rawNodes: any[]): BubbleNode[] {
  return rawNodes.map((n: any, i: number) => {
    const addr = n.address || n.id || `addr_${i}`
    const value = n.value || n.supply_pct || n.pct || 1
    const risk = n.risk || n.risk_score || 0
    return {
      id: n.id || addr,
      address: addr,
      label: n.label || n.name || null,
      value,
      risk,
      color: n.color || getNodeColor(risk, n.layer || i === 0 ? 0 : 1),
      layer: n.layer ?? (i === 0 ? 0 : 1),
      isDev: n.isDev || n.is_dev || false,
      isBundle: n.isBundle || n.is_bundle || false,
      clusterId: n.clusterId || n.cluster_id,
    }
  })
}

/** Deterministic-ish force simulation: repulsion + centering, mutates nodes in place. */
export function simulateForceLayout(nodes: BubbleNode[]): void {
  if (nodes.length === 0) return

  const centerX = 0
  const centerY = 0
  const alpha = 0.3
  const iterations = 150

  // Init positions
  for (const node of nodes) {
    if (node.x !== undefined) continue
    const angle = Math.random() * Math.PI * 2
    const dist = 30 + Math.random() * 150
    node.x = centerX + Math.cos(angle) * dist
    node.y = centerY + Math.sin(angle) * dist
    node.vx = 0
    node.vy = 0
  }

  for (let iter = 0; iter < iterations; iter++) {
    const a = alpha * (1 - iter / iterations)

    // Repulsion between all nodes
    for (let i = 0; i < nodes.length; i++) {
      const ni = nodes[i]
      if (!ni) continue
      for (let j = i + 1; j < nodes.length; j++) {
        const nj = nodes[j]
        if (!nj) continue
        const dx = (nj.x || 0) - (ni.x || 0)
        const dy = (nj.y || 0) - (ni.y || 0)
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const force = (a * 500) / (dist * dist)
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force
        ni.vx = ((ni.vx || 0) - fx) * 0.9
        ni.vy = ((ni.vy || 0) - fy) * 0.9
        nj.vx = ((nj.vx || 0) + fx) * 0.9
        nj.vy = ((nj.vy || 0) + fy) * 0.9
      }
    }

    // Attraction to center
    for (const node of nodes) {
      if (node.layer === 0) {
        node.vx = ((node.vx || 0) - (node.x || 0) * 0.02) * 0.95
        node.vy = ((node.vy || 0) - (node.y || 0) * 0.02) * 0.95
      } else {
        const dist = Math.sqrt((node.x || 0) ** 2 + (node.y || 0) ** 2) || 1
        const pull = a * 2
        node.vx = ((node.vx || 0) - ((node.x || 0) / dist) * pull) * 0.92
        node.vy = ((node.vy || 0) - ((node.y || 0) / dist) * pull) * 0.92
      }
    }

    // Update positions
    for (const node of nodes) {
      node.x = (node.x || 0) + (node.vx || 0)
      node.y = (node.y || 0) + (node.vy || 0)
    }
  }
}

export interface DrawBubbleOptions {
  pan: BubblePanState
  hovered: BubbleNode | null
  mouse: BubblePoint
}

/** Render links, nodes, badges and the hover tooltip onto a canvas context. */
export function drawBubbleGraph(
  ctx: CanvasRenderingContext2D,
  nodes: BubbleNode[],
  links: BubbleLink[],
  w: number,
  h: number,
  opts: DrawBubbleOptions,
): void {
  const { x: px, y: py, scale } = opts.pan
  ctx.clearRect(0, 0, w, h)

  ctx.save()
  ctx.translate(w / 2 + px, h / 2 + py)
  ctx.scale(scale, scale)

  // Draw links
  ctx.strokeStyle = 'rgba(139, 92, 246, 0.15)'
  ctx.lineWidth = 1
  for (const link of links) {
    const src = nodes.find((n) => n.id === link.source)
    const tgt = nodes.find((n) => n.id === link.target)
    if (!src || !tgt || src.x === undefined || src.y === undefined || tgt.x === undefined || tgt.y === undefined)
      continue

    const strength = Math.min(1, link.value / 10)
    ctx.strokeStyle = `rgba(139, 92, 246, ${0.08 + strength * 0.2})`
    ctx.lineWidth = 0.5 + strength * 1.5

    ctx.beginPath()
    ctx.moveTo(src.x, src.y)
    ctx.lineTo(tgt.x, tgt.y)
    ctx.stroke()
  }

  // Draw nodes
  const maxVal = Math.max(1, ...nodes.map((n) => n.value))

  for (const node of nodes) {
    if (node.x === undefined || node.y === undefined) continue
    const r = nodeRadius(node.value, maxVal)
    const isHovered = opts.hovered?.id === node.id

    // Glow for dev/bundle/high-risk wallets
    const isHighRisk = node.risk >= 70
    if (node.isDev || node.isBundle || isHighRisk) {
      const pulse = isHighRisk ? 10 + Math.sin(Date.now() / 200) * 5 : 10
      ctx.shadowColor = node.isBundle
        ? 'rgba(255, 152, 0, 0.6)'
        : node.isDev
          ? 'rgba(255, 51, 102, 0.5)'
          : 'rgba(239, 68, 68, 0.6)'
      ctx.shadowBlur = isHovered ? 25 : pulse
    }

    // Gradient fill
    const grad = ctx.createRadialGradient(node.x, node.y, r * 0.2, node.x, node.y, r)
    grad.addColorStop(0, node.color || '#8B5CF6')
    grad.addColorStop(1, 'rgba(0,0,0,0.4)')

    ctx.beginPath()
    ctx.arc(node.x, node.y, isHovered ? r * 1.2 : r, 0, Math.PI * 2)
    ctx.fillStyle = grad
    ctx.fill()

    // Border
    ctx.strokeStyle = isHovered ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.1)'
    ctx.lineWidth = isHovered ? 2 : 0.5
    ctx.stroke()

    // Reset shadow
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0

    // Layer indicator (ring for layer > 0)
    if (node.layer > 0) {
      ctx.beginPath()
      ctx.arc(node.x, node.y, r + 3, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(139, 92, 246, ${0.3 - node.layer * 0.1})`
      ctx.lineWidth = 0.5
      ctx.setLineDash([2, 3])
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Dev wallet badge
    if (node.isDev && r > 10) {
      ctx.fillStyle = '#FF3366'
      ctx.font = 'bold 8px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('DEV', node.x, node.y - r - 6)
    }

    // Bundle badge
    if (node.isBundle && r > 10) {
      ctx.fillStyle = '#FF9800'
      ctx.font = 'bold 8px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('BUNDLE', node.x, node.y - r - (node.isDev ? 14 : 6))
    }
  }

  ctx.restore()

  // Draw tooltip
  const hovered = opts.hovered
  if (hovered && hovered.address) {
    const screenX = opts.mouse.x
    const screenY = opts.mouse.y

    const riskLabel = hovered.risk >= 70 ? '🔴 High' : hovered.risk >= 40 ? '🟡 Medium' : '🟢 Low'
    const shortAddr =
      hovered.address.length > 12 ? `${hovered.address.slice(0, 6)}...${hovered.address.slice(-4)}` : hovered.address

    const lines = [
      `📌 ${hovered.label || shortAddr}`,
      `📊 Supply: ${hovered.value.toFixed(1)}%`,
      hovered.balance ? `💰 Balance: $${hovered.balance.toLocaleString()}` : '',
      hovered.clusterId ? `🔗 Cluster: ${hovered.clusterId.slice(0, 8)}...` : '',
      hovered.isDev ? '⚠️ DEV WALLET' : '',
      hovered.isBundle ? '🕸️ BUNDLE WALLET' : '',
      `⚡ Risk: ${riskLabel} (${hovered.risk}/100)`,
      '🖱 Click → Explorer | 📋 Click addr to copy',
    ].filter(Boolean)

    const lineHeight = 14
    const padding = 10
    const tooltipW = Math.max(...lines.map((l) => ctx.measureText(l).width)) + padding * 2
    const tooltipH = lines.length * lineHeight + padding * 2

    let tx = screenX + 15
    let ty = screenY - tooltipH - 10
    if (tx + tooltipW > w) tx = screenX - tooltipW - 15
    if (ty < 0) ty = screenY + 15

    ctx.fillStyle = 'rgba(10, 10, 20, 0.95)'
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.3)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(tx, ty, tooltipW, tooltipH, 8)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = '#fff'
    ctx.font = '12px monospace'
    ctx.textAlign = 'left'
    lines.forEach((line, i) => {
      const isTitle = i === 0
      if (isTitle) {
        ctx.fillStyle = '#8B5CF6'
        ctx.font = 'bold 12px monospace'
      } else {
        ctx.fillStyle = line.startsWith('⚠️') || line.startsWith('🕸️') ? '#FF9800' : '#ccc'
        ctx.font = '11px monospace'
      }
      ctx.fillText(line, tx + padding, ty + padding + lineHeight * (i + 0.8))
    })
  }
}

/** Find the node under the mouse cursor (screen-space hit test). */
export function hitTestNode(
  nodes: BubbleNode[],
  mouse: BubblePoint,
  width: number,
  height: number,
  pan: BubblePanState,
): BubbleNode | null {
  const { x: px, y: py, scale } = pan
  const maxVal = Math.max(1, ...nodes.map((n) => n.value))

  for (const node of nodes) {
    if (node.x === undefined || node.y === undefined) continue
    const sx = node.x * scale + width / 2 + px
    const sy = node.y * scale + height / 2 + py
    const r = nodeRadius(node.value, maxVal) * scale
    const dx = mouse.x - sx
    const dy = mouse.y - sy
    if (dx * dx + dy * dy < (r + 4) * (r + 4)) {
      return node
    }
  }
  return null
}
