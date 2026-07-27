import { Activity, Crosshair, Map as MapIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import type { BubbleMapData } from '@/components/rugmaps/BubbleMapCanvas'
import BubbleMapCanvas from '@/components/rugmaps/BubbleMapCanvas'

function HomePage() {
  return (
    <div className="min-h-screen bg-[#08080e] text-[#F1F1F6]">
      <header className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center">
            <Crosshair className="w-[18px] h-[18px] text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight">RugMaps</h1>
            <p className="text-[10px] text-purple-400 font-semibold uppercase tracking-widest">Fund Flow Forensics</p>
          </div>
        </div>
        <nav className="flex items-center gap-4">
          <Link to="/" className="text-xs text-[#9DA0B0] hover:text-white transition-colors">
            Home
          </Link>
          <Link to="/demo" className="text-xs text-[#9DA0B0] hover:text-white transition-colors">
            Demo
          </Link>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight mb-3">
            Token Holder <span className="text-purple-400">Visual Intelligence</span>
          </h2>
          <p className="text-[#9DA0B0] max-w-xl mx-auto text-sm">
            Detect bundling, trace gas funding, map deployer networks, and visualize holder distribution across Solana,
            Ethereum, Base, and more.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          {[
            { icon: MapIcon, label: 'Bubble Map', desc: 'Holder distribution graph', color: 'purple' },
            { icon: Activity, label: 'Bundle Detection', desc: 'Identify coordinated clusters', color: 'orange' },
            { icon: Crosshair, label: 'Gas Tracing', desc: 'Follow funding sources', color: 'red' },
          ].map((item) => (
            <Link
              key={item.label}
              to="/demo"
              className="p-4 rounded-xl border border-white/5 bg-white/[0.015] hover:bg-white/[0.03] hover:border-purple-500/20 transition-all"
            >
              <div className={`w-9 h-9 rounded-lg bg-${item.color}-500/10 flex items-center justify-center mb-3`}>
                <item.icon className={`w-4 h-4 text-${item.color}-400`} />
              </div>
              <h3 className="text-sm font-semibold mb-1">{item.label}</h3>
              <p className="text-[11px] text-[#5C6080]">{item.desc}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}

function DemoPage() {
  const [data] = useState<BubbleMapData | null>({
    nodes: [
      {
        id: 'center',
        address: '0x1234...5678',
        value: 35,
        risk: 0,
        color: '#8B5CF6',
        layer: 0,
        label: 'Token Contract',
      },
      {
        id: 'dev1',
        address: '0xdev1...0001',
        value: 12,
        risk: 85,
        color: '#FF3366',
        layer: 1,
        isDev: true,
        label: 'Dev Wallet A',
      },
      {
        id: 'bundle1',
        address: '0xbun...dle1',
        value: 8,
        risk: 65,
        color: '#FF9800',
        layer: 1,
        isBundle: true,
        label: 'Bundle Wallet 1',
      },
      {
        id: 'bundle2',
        address: '0xbun...dle2',
        value: 7,
        risk: 60,
        color: '#FF9800',
        layer: 1,
        isBundle: true,
        label: 'Bundle Wallet 2',
      },
      { id: 'holder1', address: '0xhol...der1', value: 5, risk: 20, color: '#28CBF4', layer: 2, label: 'Holder A' },
      { id: 'holder2', address: '0xhol...der2', value: 4, risk: 15, color: '#28CBF4', layer: 2, label: 'Holder B' },
      { id: 'holder3', address: '0xhol...der3', value: 3, risk: 10, color: '#28CBF4', layer: 2, label: 'Holder C' },
      { id: 'holder4', address: '0xhol...der4', value: 3, risk: 25, color: '#22C55E', layer: 2, label: 'Holder D' },
    ],
    links: [
      { source: 'center', target: 'dev1', value: 10, transactions: 45 },
      { source: 'center', target: 'bundle1', value: 8, transactions: 32 },
      { source: 'center', target: 'bundle2', value: 6, transactions: 28 },
      { source: 'center', target: 'holder1', value: 3, transactions: 5 },
      { source: 'center', target: 'holder2', value: 2, transactions: 3 },
      { source: 'center', target: 'holder3', value: 1, transactions: 2 },
      { source: 'center', target: 'holder4', value: 1, transactions: 2 },
      { source: 'dev1', target: 'bundle1', value: 5, transactions: 15 },
      { source: 'dev1', target: 'bundle2', value: 4, transactions: 12 },
    ],
    risk_score: 72,
    risk_level: 'high',
  })

  return (
    <div className="min-h-screen bg-[#08080e] text-[#F1F1F6]">
      <header className="border-b border-white/5 px-6 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center">
            <Crosshair className="w-[15px] h-[15px] text-white" />
          </div>
          <span className="text-sm font-bold">RugMaps Demo</span>
        </Link>
        <span className="text-[10px] text-[#5C6080] font-mono">
          solana · EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
        </span>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-4">
          <h2 className="text-lg font-bold">Holder Distribution</h2>
          <p className="text-[11px] text-[#5C6080]">
            Risk Score: <span className="text-red-400 font-semibold">72/100 (High)</span>
          </p>
        </div>
        <BubbleMapCanvas data={data} chain="solana" width={900} height={550} />
      </main>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/demo" element={<DemoPage />} />
    </Routes>
  )
}
