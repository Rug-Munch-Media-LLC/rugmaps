import { AlertTriangle, ExternalLink, Loader2, Shield, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import BubbleMapCanvas, { type BubbleMapData } from '@/components/rugmaps/BubbleMapCanvas'
import { getNodeColor } from '@/components/rugmaps/bubbleMapCanvas'
import { fetchTokenGraph, type TokenGraphNode } from '@/services/rugmapsApi'

interface HolderRow {
  address: string
  pct: number
  label?: string
  isDev?: boolean
  isBundle?: boolean
  risk: number
}

/** Map the live token-graph payload onto the BubbleMapData the canvas expects. */
function toBubbleMapData(
  nodes: TokenGraphNode[],
  links: { source: string; target: string; value?: number; transactions?: number }[],
  riskScore: number,
  riskLevel: string,
): BubbleMapData {
  return {
    nodes: nodes.map((n, i) => {
      const risk = n.risk ?? n.risk_score ?? 0
      const layer = n.layer ?? (i === 0 ? 0 : 1)
      return {
        id: n.id || n.address || `node_${i}`,
        address: n.address || n.id || `node_${i}`,
        label: n.label || n.name || undefined,
        value: n.value ?? n.supply_pct ?? n.pct ?? 1,
        risk,
        color: getNodeColor(risk, layer),
        layer,
        isDev: n.is_dev ?? false,
        isBundle: n.is_bundle ?? false,
        clusterId: undefined,
      }
    }),
    links: links.map((l) => ({
      source: l.source,
      target: l.target,
      value: l.value ?? 1,
      transactions: l.transactions,
    })),
    risk_score: riskScore,
    risk_level: riskLevel,
  }
}

/** Build the holder-distribution rows (sorted by % desc). */
function toHolderRows(nodes: TokenGraphNode[]): HolderRow[] {
  return nodes
    .map((n) => ({
      address: n.address || n.id || '',
      pct: n.value ?? n.supply_pct ?? n.pct ?? 0,
      label: n.label || n.name || undefined,
      isDev: n.is_dev ?? false,
      isBundle: n.is_bundle ?? false,
      risk: n.risk ?? n.risk_score ?? 0,
    }))
    .filter((h) => h.address)
    .sort((a, b) => b.pct - a.pct)
}

function riskColor(score: number): string {
  if (score >= 70) return '#FF3366'
  if (score >= 40) return '#FF9800'
  return '#22C55E'
}

/**
 * Embeddable iframe widget — /embed/:chain/:address
 * Minimal full-screen bubble map: no nav, no sidebar, no footer.
 */
export default function EmbedPage() {
  const { chain = 'solana', address = '' } = useParams<{ chain: string; address: string }>()
  const [graph, setGraph] = useState<Awaited<ReturnType<typeof fetchTokenGraph>>>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!address) return
    setLoading(true)
    fetchTokenGraph(address, chain)
      .then(setGraph)
      .finally(() => setLoading(false))
  }, [address, chain])

  const bubbleData = useMemo(
    () =>
      graph
        ? toBubbleMapData(graph.nodes ?? [], graph.links ?? [], graph.risk_score ?? 0, graph.risk_level ?? 'unknown')
        : null,
    [graph],
  )
  const holders = useMemo(() => (graph ? toHolderRows(graph.nodes ?? []) : []), [graph])

  const riskScore = graph?.risk_score ?? 0
  const riskLevel = graph?.risk_level ?? 'unknown'
  const fullUrl = `https://rugmunch.io/maps/token/${chain}/${encodeURIComponent(address)}`

  return (
    <div className="min-h-screen bg-[#08080e] text-[#F1F1F6] flex flex-col">
      {/* Compact header: token + risk + link back */}
      <header className="flex items-center gap-3 px-4 py-2.5 border-b border-white/5 shrink-0">
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold tracking-tight truncate">
            RugMaps · <span className="text-purple-400">{chain}</span>
          </h1>
          <p className="text-[10px] text-[#5C6080] font-mono truncate">{address}</p>
        </div>
        {!loading && graph && (
          <span
            className="badge text-[10px] shrink-0"
            style={{
              backgroundColor: riskColor(riskScore) + '20',
              color: riskColor(riskScore),
              borderColor: riskColor(riskScore) + '40',
            }}
          >
            <Shield className="w-3 h-3 mr-1" />
            {riskScore}/100 · {riskLevel}
          </span>
        )}
        <a
          href={fullUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-1 text-[10px] text-purple-400 hover:text-white transition-colors"
          title="Open full map on rugmunch.io"
        >
          Full map
          <ExternalLink className="w-3 h-3" />
        </a>
      </header>

      {/* Map — fills remaining viewport */}
      <main className="flex-1 min-h-0 p-2">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 text-purple-400 animate-spin mr-2" />
            <span className="text-xs text-[#9DA0B0]">Building token graph...</span>
          </div>
        ) : !graph ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <AlertTriangle className="w-7 h-7 text-[#FF3366] mb-2" />
            <p className="text-xs font-semibold">Could not load token data</p>
            <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-purple-400 mt-1">
              Open on rugmunch.io
            </a>
          </div>
        ) : (
          <div className="h-full flex flex-col gap-2">
            <div className="flex-1 min-h-0 rounded-lg border border-white/5 bg-white/[0.015] p-2">
              <BubbleMapCanvas data={bubbleData} chain={chain} width={1100} height={560} />
            </div>

            {/* Compact holder distribution */}
            <section className="shrink-0 max-h-[38%] overflow-y-auto rounded-lg border border-white/5 bg-white/[0.015] p-2">
              <div className="flex items-center gap-1.5 mb-1.5 sticky top-0 bg-[#08080e] pb-1">
                <Users className="w-3 h-3 text-purple-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Holder Distribution</span>
                <span className="text-[9px] text-[#5C6080] ml-auto">{holders.length} holders</span>
              </div>
              <table className="w-full text-left text-[10px]">
                <tbody>
                  {holders.slice(0, 25).map((h, i) => (
                    <tr key={h.address} className="border-b border-white/[0.03]">
                      <td className="py-1 pr-2 text-[#5C6080] w-6">{i + 1}</td>
                      <td className="py-1 pr-2 font-mono text-[#9DA0B0]">
                        {h.address.slice(0, 6)}...{h.address.slice(-4)}
                      </td>
                      <td className="py-1 pr-2">
                        {h.isDev ? (
                          <span className="badge badge-danger text-[8px]">DEV</span>
                        ) : h.isBundle ? (
                          <span className="badge badge-warning text-[8px]">BUNDLE</span>
                        ) : (
                          <span className="text-[#5C6080]">{h.label || 'holder'}</span>
                        )}
                      </td>
                      <td className="py-1 pr-2 text-right font-mono text-[#F1F1F6]">{h.pct.toFixed(2)}%</td>
                      <td className="py-1 text-right font-mono" style={{ color: riskColor(h.risk) }}>
                        {h.risk}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        )}
      </main>
    </div>
  )
}
