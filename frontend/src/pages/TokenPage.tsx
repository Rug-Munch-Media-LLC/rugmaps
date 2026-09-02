import { motion } from 'framer-motion'
import { AlertTriangle, ArrowLeft, Crosshair, Loader2, Shield, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import BotNetworkPanel from '@/components/rugmaps/BotNetworkPanel'
import BubbleMapCanvas, { type BubbleMapData } from '@/components/rugmaps/BubbleMapCanvas'
import { getNodeColor } from '@/components/rugmaps/bubbleMapCanvas'
import ContractDeepDive from '@/components/rugmaps/ContractDeepDive'
import DeployerNetwork from '@/components/rugmaps/DeployerNetwork'
import FundingSourceTracer from '@/components/rugmaps/FundingSourceTracer'
import GasFundingTracer from '@/components/rugmaps/GasFundingTracer'
import RAGIntelligencePanel from '@/components/rugmaps/RAGIntelligencePanel'
import SentinelRiskMeter from '@/components/rugmaps/SentinelRiskMeter'
import { fetchTokenGraph, type TokenGraphNode } from '@/services/rugmapsApi'

interface HolderRow {
  address: string
  pct: number
  label?: string
  entityType?: string
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

/** Build the holder-distribution table rows (sorted by % desc). */
function toHolderRows(nodes: TokenGraphNode[]): HolderRow[] {
  return nodes
    .map((n) => ({
      address: n.address || n.id || '',
      pct: n.value ?? n.supply_pct ?? n.pct ?? 0,
      label: n.label || n.name || undefined,
      entityType: n.entity_type || undefined,
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

export default function TokenPage() {
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

  const deployerAddress = useMemo(() => {
    const dev = (graph?.nodes ?? []).find((n) => n.is_dev)
    return dev?.address || (graph?.nodes ?? [])[1]?.address
  }, [graph])

  const riskScore = graph?.risk_score ?? 0
  const riskLevel = graph?.risk_level ?? 'unknown'

  return (
    <div className="min-h-screen bg-[#08080e] text-[#F1F1F6]">
      <header className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center">
              <Crosshair className="w-[18px] h-[18px] text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">RugMaps</h1>
              <p className="text-[10px] text-purple-400 font-semibold uppercase tracking-widest">Fund Flow Forensics</p>
            </div>
          </Link>
        </div>
        <nav className="flex items-center gap-4">
          <Link to="/" className="text-xs text-[#9DA0B0] hover:text-white transition-colors">
            Home
          </Link>
          <Link to="/search" className="text-xs text-[#9DA0B0] hover:text-white transition-colors">
            Search
          </Link>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Back + token header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            to="/search"
            className="p-2 rounded-lg border border-white/5 hover:bg-white/[0.03] transition-colors"
            aria-label="Back to search"
          >
            <ArrowLeft className="w-4 h-4 text-[#9DA0B0]" />
          </Link>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold tracking-tight truncate">
              Token <span className="text-purple-400">{chain}</span>
            </h2>
            <p className="text-[11px] text-[#5C6080] font-mono truncate">{address}</p>
          </div>
          {!loading && graph && (
            <div className="flex items-center gap-2">
              <span
                className="badge text-[11px]"
                style={{
                  backgroundColor: riskColor(riskScore) + '20',
                  color: riskColor(riskScore),
                  borderColor: riskColor(riskScore) + '40',
                }}
              >
                <Shield className="w-3 h-3 mr-1" />
                Risk {riskScore}/100 · {riskLevel}
              </span>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 text-purple-400 animate-spin mr-3" />
            <span className="text-sm text-[#9DA0B0]">Building token graph...</span>
          </div>
        ) : !graph ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <AlertTriangle className="w-8 h-8 text-[#FF3366] mb-3" />
            <p className="text-sm font-semibold text-[#F1F1F6]">Could not load token data</p>
            <p className="text-xs text-[#5C6080] mt-1 max-w-md">
              The backend returned no data for this token. Check the address and chain, or try again.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Risk score display */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Risk Score" value={`${riskScore}/100`} color={riskColor(riskScore)} />
              <StatCard label="Holders" value={String(graph.node_count ?? holders.length)} color="#8B5CF6" />
              <StatCard label="Links" value={String(graph.link_count ?? graph.links?.length ?? 0)} color="#28CBF4" />
              <StatCard label="Data Quality" value={graph.data_quality ?? 'ok'} color="#22C55E" />
            </div>

            {/* The map — killer feature */}
            <section className="rounded-xl border border-white/5 bg-white/[0.015] p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold">Holder Bubble Map</h3>
                <span className="text-[10px] text-[#5C6080]">
                  {graph.nodes?.length ?? 0} nodes · {graph.links?.length ?? 0} edges
                </span>
              </div>
              <BubbleMapCanvas data={bubbleData} chain={chain} width={1100} height={560} />
            </section>

            {/* Holder distribution table */}
            <section className="rounded-xl border border-white/5 bg-white/[0.015] p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold">Holder Distribution</h3>
                <span className="text-[10px] text-[#5C6080] ml-auto">{holders.length} holders</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12px]">
                  <thead>
                    <tr className="text-[10px] text-[#5C6080] uppercase tracking-wider border-b border-white/5">
                      <th className="py-2 pr-4">#</th>
                      <th className="py-2 pr-4">Address</th>
                      <th className="py-2 pr-4">Label</th>
                      <th className="py-2 pr-4">Type</th>
                      <th className="py-2 pr-4 text-right">% Supply</th>
                      <th className="py-2 pr-4 text-right">Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holders.slice(0, 50).map((h, i) => (
                      <tr key={h.address} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                        <td className="py-2 pr-4 text-[#5C6080]">{i + 1}</td>
                        <td className="py-2 pr-4 font-mono text-[11px] text-[#9DA0B0]">
                          {h.address.slice(0, 6)}...{h.address.slice(-4)}
                        </td>
                        <td className="py-2 pr-4 text-[#F1F1F6]">{h.label || '—'}</td>
                        <td className="py-2 pr-4">
                          {h.isDev ? (
                            <span className="badge badge-danger text-[9px]">DEV</span>
                          ) : h.isBundle ? (
                            <span className="badge badge-warning text-[9px]">BUNDLE</span>
                          ) : (
                            <span className="text-[#5C6080]">{h.entityType || 'holder'}</span>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-right font-mono text-[#F1F1F6]">{h.pct.toFixed(2)}%</td>
                        <td className="py-2 pr-4 text-right">
                          <span className="font-mono" style={{ color: riskColor(h.risk) }}>
                            {h.risk}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Analysis panels */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SentinelRiskMeter tokenAddress={address} chain={chain} />
              <BotNetworkPanel tokenAddress={address} chain={chain} />
              <ContractDeepDive tokenAddress={address} chain={chain} />
              <GasFundingTracer tokenAddress={address} chain={chain} deployerAddress={deployerAddress} />
            </div>

            {/* Deeper intelligence */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {deployerAddress && <DeployerNetwork deployerAddress={deployerAddress} chain={chain} />}
              <FundingSourceTracer chain={chain} address={deployerAddress || address} tokenAddress={address} />
            </div>

            <RAGIntelligencePanel tokenAddress={address} chain={chain} deployerAddress={deployerAddress} />
          </div>
        )}
      </main>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-white/5 bg-white/[0.015] p-4"
    >
      <div className="text-[10px] text-[#5C6080] uppercase tracking-wider mb-1">{label}</div>
      <div className="text-xl font-bold font-mono" style={{ color }}>
        {value}
      </div>
    </motion.div>
  )
}
