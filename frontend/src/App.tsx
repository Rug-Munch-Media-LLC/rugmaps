import { Activity, Crosshair, Map as MapIcon, Search } from 'lucide-react'
import { useState } from 'react'
import { Link, Route, Routes, useNavigate } from 'react-router-dom'
import SearchPage from '@/pages/SearchPage'
import TokenPage from '@/pages/TokenPage'

const CHAINS = ['solana', 'ethereum', 'base', 'bsc', 'arbitrum', 'optimism', 'polygon']

function HomePage() {
  const [query, setQuery] = useState('')
  const [chain, setChain] = useState('solana')
  const navigate = useNavigate()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    navigate(`/token/${chain}/${encodeURIComponent(q)}`)
  }

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
          <Link to="/" className="text-xs text-purple-400 hover:text-white transition-colors">
            Home
          </Link>
          <Link to="/search" className="text-xs text-[#9DA0B0] hover:text-white transition-colors">
            Search
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

        {/* Search bar */}
        <form
          onSubmit={handleSearch}
          className="max-w-2xl mx-auto mb-12 rounded-2xl border border-white/5 bg-white/[0.015] p-3 flex flex-col md:flex-row gap-2"
        >
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-[#5C6080] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search token by address or name..."
              className="w-full bg-[#0C1220]/60 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-[#F1F1F6] placeholder:text-[#5C6080] focus:outline-none focus:border-purple-500/40"
            />
          </div>
          <select
            value={chain}
            onChange={(e) => setChain(e.target.value)}
            className="bg-[#0C1220]/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-[#F1F1F6] focus:outline-none focus:border-purple-500/40"
          >
            {CHAINS.map((c) => (
              <option key={c} value={c} className="bg-[#0C1220]">
                {c}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!query.trim()}
            className="btn btn-primary px-6 py-3 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Search className="w-4 h-4 mr-2" />
            Analyze
          </button>
        </form>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: MapIcon, label: 'Bubble Map', desc: 'Holder distribution graph', color: 'purple', to: '/search' },
            {
              icon: Activity,
              label: 'Bundle Detection',
              desc: 'Identify coordinated clusters',
              color: 'orange',
              to: '/search',
            },
            { icon: Crosshair, label: 'Gas Tracing', desc: 'Follow funding sources', color: 'red', to: '/search' },
          ].map((item) => (
            <Link
              key={item.label}
              to={item.to}
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

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/token/:chain/:address" element={<TokenPage />} />
    </Routes>
  )
}
