import { motion } from 'framer-motion'
import { Crosshair, Loader2, Search } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const CHAINS = ['solana', 'ethereum', 'base', 'bsc', 'arbitrum', 'optimism', 'polygon']

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [chain, setChain] = useState('solana')
  const [submitted, setSubmitted] = useState(false)
  const navigate = useNavigate()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    setSubmitted(true)
    // Route to the token page. The address is the primary key; the name is
    // passed along for display context (the backend resolves by address).
    navigate(`/token/${chain}/${encodeURIComponent(q)}`)
  }

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
          <Link to="/search" className="text-xs text-purple-400 hover:text-white transition-colors">
            Search
          </Link>
        </nav>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-20">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold tracking-tight mb-3">
            Search a <span className="text-purple-400">Token</span>
          </h2>
          <p className="text-[#9DA0B0] text-sm">
            Enter a token address to visualize holder distribution, detect bots, and trace funding.
          </p>
        </div>

        <motion.form
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSearch}
          className="rounded-2xl border border-white/5 bg-white/[0.015] p-4"
        >
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-[#5C6080] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Token address (e.g. EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v)"
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
              {submitted ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
              Analyze
            </button>
          </div>
          <p className="text-[10px] text-[#5C6080] mt-3">
            Tip: paste a full token address for best results. Names are resolved to the closest address match.
          </p>
        </motion.form>
      </main>
    </div>
  )
}
