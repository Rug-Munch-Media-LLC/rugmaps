import type { CanvasOptions, EdgeData, ElementDatum, GraphData, IElementEvent, NodeData } from '@antv/g6'
import { Graph } from '@antv/g6'
import { useEffect, useRef, useState } from 'react'

/**
 * TokenGraphCanvas — G6 (AntV) graph visualization for large token-relationship graphs.
 *
 * Why G6 v5:
 * - Scales to thousands of nodes via force-atlas2 (barnes-hut auto-activates above 250
 *   nodes, optional web-worker offload via `enableWorker`).
 * - Built on @antv/g canvas renderer (browser-hardware-accelerated). True WebGL
 *   rendering requires `@antv/g-webgl` (NOT bundled with @antv/g6 5.1.1) — pass a
 *   `renderer` factory prop once that package is installed.
 *
 * Fallback tiers:
 * - 0 nodes  -> empty state
 * - <12 nodes -> lightweight config: d3-force layout, all labels visible
 * - >=12     -> force-atlas2 layout, labels only on hub nodes (tooltip covers the rest)
 */

export interface TokenGraphNode {
  id: string
  label?: string
  size?: number
}

export interface TokenGraphEdge {
  source: string
  target: string
  value?: number
}

export interface TokenGraphCanvasProps {
  nodes: TokenGraphNode[]
  edges: TokenGraphEdge[]
  width?: number
  height?: number
  /**
   * Per-layer renderer factory (see G6 CanvasOptions.renderer). Defaults to the built-in
   * canvas renderer. To render with WebGL, install `@antv/g-webgl` and pass
   * `(layer) => new WebGLRenderer()` — not bundled with @antv/g6 5.1.1.
   */
  renderer?: CanvasOptions['renderer']
}

const DARK_BG = '#08080e'
const COLOR_HUB = '#8B5CF6'
const COLOR_MED = '#28CBF4'
const COLOR_HOT = '#FF9800'
const COLOR_ISOLATE = '#3A3F55'
const COLOR_LABEL = '#D7D9E3'
const EDGE_COLOR = '#6d63a8'

const TINY_GRAPH_THRESHOLD = 12
const HUB_LABEL_DEGREE = 6
const MIN_DIAMETER = 10
const MAX_DIAMETER = 46

type RenderStatus = 'idle' | 'rendering' | 'ready' | 'error'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function edgeOpacity(edge: TokenGraphEdge, maxValue: number): number {
  if (maxValue <= 0) return 0.3
  return clamp(0.15 + ((edge.value ?? 0) / maxValue) * 0.45, 0.15, 0.6)
}

function nodeFill(deg: number, weight: number, maxWeight: number): string {
  if (deg === 0) return COLOR_ISOLATE
  if (deg >= HUB_LABEL_DEGREE || weight >= maxWeight * 0.85) return COLOR_HUB
  if (weight >= maxWeight * 0.5) return COLOR_HOT
  return COLOR_MED
}

function buildGraphData(nodes: TokenGraphNode[], edges: TokenGraphEdge[], tiny: boolean): GraphData {
  const degree = new Map<string, number>()
  for (const edge of edges) {
    if (edge.source === edge.target) continue
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1)
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1)
  }

  let maxWeight = 1
  const weights = nodes.map((node) => {
    const deg = degree.get(node.id) ?? 0
    const weight = node.size && node.size > 0 ? node.size : Math.sqrt(deg)
    if (weight > maxWeight) maxWeight = weight
    return weight
  })

  const maxValue = edges.reduce((max, edge) => Math.max(max, edge.value ?? 0), 0)

  const gNodes: NodeData[] = nodes.map((node, index) => {
    const deg = degree.get(node.id) ?? 0
    const weight = weights[index] ?? 1
    const diameter = clamp(
      MIN_DIAMETER + (weight / maxWeight) * (MAX_DIAMETER - MIN_DIAMETER),
      MIN_DIAMETER,
      MAX_DIAMETER,
    )
    const isHub = deg >= HUB_LABEL_DEGREE
    return {
      id: node.id,
      data: { degree: deg, weight, rawSize: node.size ?? null, label: node.label ?? null },
      style: {
        size: diameter,
        fill: nodeFill(deg, weight, maxWeight),
        // Labels on every node for tiny graphs; hub-only for large graphs (tooltip covers the rest).
        labelText: tiny || isHub ? node.label || node.id : '',
        labelFill: COLOR_LABEL,
        labelFontSize: tiny ? 11 : 10,
        labelPadding: 4,
        cursor: 'pointer',
      },
    }
  })

  const gEdges: EdgeData[] = edges.map((edge) => ({
    source: edge.source,
    target: edge.target,
    style: {
      stroke: EDGE_COLOR,
      lineWidth: 1,
      opacity: edgeOpacity(edge, maxValue),
    },
  }))

  return { nodes: gNodes, edges: gEdges }
}

export default function TokenGraphCanvas({ nodes, edges, width = 800, height = 520, renderer }: TokenGraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<RenderStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const isEmpty = nodes.length === 0
  const isTiny = !isEmpty && nodes.length < TINY_GRAPH_THRESHOLD

  useEffect(() => {
    if (isEmpty) return
    const container = containerRef.current
    if (!container) return

    let disposed = false
    let graph: Graph | null = null
    setStatus('rendering')
    setErrorMessage(null)

    try {
      graph = new Graph({
        container,
        width,
        height,
        autoResize: true,
        background: DARK_BG,
        renderer,
        autoFit: { type: 'view', animation: false },
        data: buildGraphData(nodes, edges, isTiny),
        node: {
          style: {
            size: 16,
            fill: COLOR_MED,
            stroke: '#ffffff',
            lineWidth: 0.5,
            labelFill: COLOR_LABEL,
            labelFontSize: 10,
          },
        },
        edge: {
          style: {
            stroke: EDGE_COLOR,
            lineWidth: 1,
            opacity: 0.3,
          },
        },
        layout: isTiny
          ? { type: 'd3-force', linkDistance: 80, preventOverlap: true, velocityDecay: 0.4 }
          : {
              type: 'force-atlas2',
              kr: 12,
              kg: 1,
              ks: 0.1,
              ksmax: 8,
              tao: 0.2,
              preventOverlap: false,
              enableWorker: true,
            },
        behaviors: ['zoom-canvas', 'drag-canvas', 'drag-element'],
        plugins: [
          {
            type: 'tooltip',
            trigger: 'hover',
            getContent: (_event: IElementEvent, items: ElementDatum[]) => {
              const datum = items[0] as NodeData | undefined
              if (!datum) return ''
              const deg = (datum.data?.degree as number | undefined) ?? 0
              const label = (datum.data?.label as string | undefined) ?? datum.id
              return `<div style="font-family:ui-monospace,monospace;font-size:11px;line-height:1.5;padding:6px 8px;background:#0C1220;border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:#D7D9E3">
                <div style="font-weight:600;color:#8B5CF6">${label}</div>
                <div style="color:#9DA0B0">${datum.id}</div>
                <div style="color:#9DA0B0">degree: ${deg}</div>
              </div>`
            },
          },
        ],
        animation: false,
      })

      void graph
        .render()
        .then(() => {
          if (!disposed) setStatus('ready')
        })
        .catch((error: unknown) => {
          if (disposed) return
          setErrorMessage(error instanceof Error ? error.message : String(error))
          setStatus('error')
        })
    } catch (error) {
      if (disposed) return
      setErrorMessage(error instanceof Error ? error.message : String(error))
      setStatus('error')
    }

    return () => {
      disposed = true
      graph?.destroy()
    }
  }, [nodes, edges, width, height, renderer, isEmpty, isTiny])

  if (isEmpty) {
    return (
      <div
        role="status"
        className="flex items-center justify-center rounded-xl border border-dashed border-white/10 bg-[#0C1220]/40"
        style={{ width, height, minHeight: 160 }}
      >
        <div className="text-center px-6">
          <p className="text-sm font-semibold text-[#9DA0B0]">No token relationships to visualize</p>
          <p className="mt-1 text-xs text-[#5C6080]">Add nodes and edges to render the graph.</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="relative w-full rounded-xl overflow-hidden border border-white/5"
      style={{ background: DARK_BG, width, height }}
    >
      <div
        ref={containerRef}
        data-token-graph
        role="img"
        aria-label={`Token relationship graph with ${nodes.length} nodes and ${edges.length} edges`}
        className="w-full h-full"
      />

      {status === 'error' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#08080e]/80 backdrop-blur-sm">
          <div className="max-w-md text-center px-6">
            <p className="text-sm font-semibold text-red-400">Graph renderer unavailable</p>
            <p className="mt-1 text-xs text-[#9DA0B0] break-words">{errorMessage}</p>
            <p className="mt-2 text-[11px] text-[#5C6080]">
              This environment has no WebGL/canvas context. The component degrades to an empty state instead of
              crashing.
            </p>
          </div>
        </div>
      )}

      {status === 'rendering' && (
        <div className="absolute top-4 left-4 bg-[#0C1220]/60 backdrop-blur-sm rounded-lg px-2.5 py-1 text-[10px] text-gray-500 pointer-events-none select-none">
          Layout running…
        </div>
      )}

      <div className="absolute top-4 left-4 bg-[#0C1220]/60 backdrop-blur-sm rounded-lg px-2.5 py-1 text-[10px] text-gray-500 pointer-events-none select-none">
        {isTiny ? 'Tiny graph · lightweight layout' : 'Scroll to zoom · Drag to pan · Hover for details'}
      </div>

      <div className="absolute bottom-4 left-4 bg-[#0C1220]/60 backdrop-blur-sm rounded-lg px-2.5 py-1 text-[10px] text-gray-500 pointer-events-none select-none">
        {nodes.length.toLocaleString()} nodes · {edges.length.toLocaleString()} edges
      </div>
    </div>
  )
}
