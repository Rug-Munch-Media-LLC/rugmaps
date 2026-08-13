import { useCallback, useEffect, useRef, useState } from 'react'

import {
  type BubbleMapData,
  type BubbleNode,
  drawBubbleGraph,
  getExplorerUrl,
  hitTestNode,
  normalizeBubbleNodes,
  simulateForceLayout,
} from './bubbleMapCanvas'

export type { BubbleLink, BubbleMapData, BubbleNode } from './bubbleMapCanvas'

interface BubbleMapProps {
  data: BubbleMapData | null
  chain: string
  width?: number
  height?: number
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
    const nodes: BubbleNode[] = normalizeBubbleNodes(rawNodes)

    nodesRef.current = nodes
    simulateForceLayout(nodes)
    drawBubbleGraph(ctx, nodes, links, width, height, {
      pan: panRef.current,
      hovered: hoverRef.current,
      mouse: mouseRef.current,
    })
    animRef.current = requestAnimationFrame(() => render())
  }, [data, width, height])

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
    const nodes = nodesRef.current
    hoverRef.current = hitTestNode(nodes, mouseRef.current, width, height, panRef.current)
    if (canvas) canvas.style.cursor = hoverRef.current ? 'pointer' : 'grab'
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
