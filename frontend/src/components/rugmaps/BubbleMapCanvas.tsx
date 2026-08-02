import { useCallback, useEffect, useRef, useState } from 'react'

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

interface BubbleMapProps {
  data: BubbleMapData | null
  chain: string
  width?: number
  height?: number
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

function getExplorerUrl(chain: string, address: string): string {
  const base = EXPLORERS[chain] || EXPLORERS.ethereum
  return base + address
}

const NODE_RADIUS_MIN = 6
const NODE_RADIUS_MAX = 36

function nodeRadius(value: number, maxValue: number): number {
  if (maxValue <= 0) return NODE_RADIUS_MIN + 4
  const ratio = Math.sqrt(value / maxValue)
  return NODE_RADIUS_MIN + ratio * (NODE_RADIUS_MAX - NODE_RADIUS_MIN)
}

export default function BubbleMapCanvas({ data, chain, width = 800, height = 500 }: BubbleMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const nodesRef = useRef<BubbleNode[]>([])
  const hoverRef = useRef<BubbleNode | null>(null)
  const mouseRef = useRef({ x: 0, y: 0 })
  const panRef = useRef({ x: 0, y: 0, scale: 1 })
  const [legendOpen, setLegendOpen] = useState(true)
  const [copied, setCopied] = useState(false)
  const [copiedAddr, setCopiedAddr] = useState(false)

  // Find center node for share URL
  const centerNode = data?.nodes?.find((n) => n.layer === 0) || data?.nodes?.[0]

  const handleZoomIn = () => {
    panRef.current.scale = Math.min(4, panRef.current.scale * 1.25)
  }
  const handleZoomOut = () => {
    panRef.current.scale = Math.max(0.2, panRef.current.scale * 0.8)
  }
  const handleZoomReset = () => {
    panRef.current = { x: 0, y: 0, scale: 1 }
  }

  const handleShare = () => {
    const addr = centerNode?.address
    if (!addr) return
    const url = `${window.location.origin}/rugmaps?address=${encodeURIComponent(addr)}&chain=${encodeURIComponent(chain)}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleCopyAddress = () => {
    const hovered = hoverRef.current
    if (!hovered?.address) return
    navigator.clipboard.writeText(hovered.address).then(() => {
      setCopiedAddr(true)
      setTimeout(() => setCopiedAddr(false), 2000)
    })
  }

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, nodes: BubbleNode[], links: BubbleLink[], w: number, h: number) => {
      const { x: px, y: py, scale } = panRef.current
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
        const isHovered = hoverRef.current?.id === node.id

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
      const hovered = hoverRef.current
      if (hovered && hovered.address) {
        const screenX = mouseRef.current.x
        const screenY = mouseRef.current.y

        const riskLabel = hovered.risk >= 70 ? '🔴 High' : hovered.risk >= 40 ? '🟡 Medium' : '🟢 Low'
        const shortAddr =
          hovered.address.length > 12
            ? `${hovered.address.slice(0, 6)}...${hovered.address.slice(-4)}`
            : hovered.address

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
    },
    [],
  )

  // Force simulation
  const simulate = useCallback(() => {
    const nodes = nodesRef.current
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
  }, [])

  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.scale(dpr, dpr)

    if (!data) return

    // Extract nodes and links
    const rawNodes = data.nodes || []
    const links = data.links || []

    // Convert to BubbleNodes
    const nodes: BubbleNode[] = rawNodes.map((n: any, i: number) => {
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

    nodesRef.current = nodes
    simulate()
    draw(ctx, nodes, links, width, height)
    animRef.current = requestAnimationFrame(() => render())
  }, [data, width, height, simulate, draw])

  useEffect(() => {
    render()
    return () => cancelAnimationFrame(animRef.current)
  }, [render])

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    mouseRef.current = { x: mx, y: my }

    // Hit test
    const { x: px, y: py, scale } = panRef.current
    const nodes = nodesRef.current
    const maxVal = Math.max(1, ...nodes.map((n) => n.value))
    let found: BubbleNode | null = null

    for (const node of nodes) {
      if (node.x === undefined || node.y === undefined) continue
      const sx = node.x * scale + width / 2 + px
      const sy = node.y * scale + height / 2 + py
      const r = nodeRadius(node.value, maxVal) * scale
      const dx = mx - sx
      const dy = my - sy
      if (dx * dx + dy * dy < (r + 4) * (r + 4)) {
        found = node
        break
      }
    }
    hoverRef.current = found
    if (canvas) canvas.style.cursor = found ? 'pointer' : 'grab'
  }

  const handleClick = (_e: React.MouseEvent<HTMLCanvasElement>) => {
    const hovered = hoverRef.current
    if (hovered?.address) {
      window.open(getExplorerUrl(chain, hovered.address), '_blank')
    }
  }

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    panRef.current.scale = Math.max(0.2, Math.min(4, panRef.current.scale * delta))
  }

  return (
    <div
      className="relative w-full rounded-xl overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at center, rgba(139,92,246,0.05) 0%, rgba(0,0,0,0) 70%)' }}
    >
      <canvas
        ref={canvasRef}
        className="w-full cursor-grab active:cursor-grabbing"
        style={{ maxWidth: '100%', height: 'auto' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => {
          hoverRef.current = null
        }}
        onClick={(e) => {
          // Double-click to copy address if hovering a node
          if (hoverRef.current?.address) {
            handleCopyAddress()
          }
          handleClick(e)
        }}
        onWheel={handleWheel}
      />

      {/* Share button — top-right */}
      {data && centerNode?.address && (
        <button
          type="button"
          onClick={handleShare}
          className="absolute top-4 right-4 bg-[#0C1220]/80 backdrop-blur-md border border-white/10 hover:border-white/20 rounded-lg px-3 py-1.5 text-xs text-gray-300 hover:text-white transition-all z-10 flex items-center gap-1.5"
        >
          {copied ? '✅ Copied!' : '📤 Share'}
        </button>
      )}

      {/* Canvas hint */}
      <div className="absolute top-4 left-4 bg-[#0C1220]/60 backdrop-blur-sm rounded-lg px-2.5 py-1 text-[10px] text-gray-500 pointer-events-none select-none">
        {copiedAddr ? '✅ Address copied' : 'Scroll to zoom · Drag to pan'}
      </div>

      {/* Zoom controls — bottom-right */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1 z-10">
        <button
          type="button"
          onClick={handleZoomIn}
          className="w-8 h-8 bg-[#0C1220]/80 backdrop-blur-md border border-white/10 hover:border-white/30 rounded-lg text-white text-lg font-bold leading-none transition-all hover:bg-[#1a1f2e] flex items-center justify-center"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          className="w-8 h-8 bg-[#0C1220]/80 backdrop-blur-md border border-white/10 hover:border-white/30 rounded-lg text-white text-lg font-bold leading-none transition-all hover:bg-[#1a1f2e] flex items-center justify-center"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          onClick={handleZoomReset}
          className="w-8 h-8 bg-[#0C1220]/80 backdrop-blur-md border border-white/10 hover:border-white/30 rounded-lg text-[10px] text-gray-400 font-medium leading-none transition-all hover:bg-[#1a1f2e] flex items-center justify-center"
          aria-label="Reset zoom"
        >
          ⟲
        </button>
      </div>

      {/* Legend Overlay — collapsible */}
      <div className="absolute bottom-4 left-4 z-10">
        <button
          type="button"
          onClick={() => setLegendOpen((v) => !v)}
          className="bg-[#0C1220]/80 backdrop-blur-md border border-white/10 hover:border-white/20 rounded-lg px-2.5 py-1.5 text-xs text-gray-400 hover:text-white transition-all mb-2"
        >
          {legendOpen ? '▼ Legend' : '▲ Legend'} {data?.risk_level ? `· ${data.risk_level}` : ''}
        </button>
        {legendOpen && (
          <div className="bg-[#0C1220]/95 backdrop-blur-md border border-white/10 rounded-xl p-3 text-xs space-y-2">
            {data?.risk_score !== undefined && (
              <div className="flex items-center justify-between gap-4 pb-2 border-b border-white/5 mb-1">
                <span className="text-gray-400 text-[10px] uppercase tracking-wider">Risk Score</span>
                <span
                  className={`font-bold text-sm ${
                    data.risk_score >= 70
                      ? 'text-[#EF4444]'
                      : data.risk_score >= 40
                        ? 'text-[#F59E0B]'
                        : 'text-[#22C55E]'
                  }`}
                >
                  {data.risk_score}/100
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#8B5CF6] shadow-[0_0_8px_rgba(139,92,246,0.5)]" />
              <span className="text-gray-300">Token Contract (Center)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#22C55E] shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
              <span className="text-gray-300">Low Risk (&lt;30)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#F59E0B] shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
              <span className="text-gray-300">Medium Risk (30-69)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#EF4444] shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
              <span className="text-gray-300">High Risk (&ge;70) / Dev</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#FF9800] shadow-[0_0_8px_rgba(255,152,0,0.6)]" />
              <span className="text-gray-300">Bundle Wallet</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function getNodeColor(risk: number, layer: number): string {
  if (layer === 0) return '#8B5CF6' // Purple for center
  if (risk >= 70) return '#FF3366' // Red for high risk
  if (risk >= 40) return '#FF9800' // Orange for medium
  return '#28CBF4' // Cyan for low risk
}
