import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Code, FileCode, Percent, XCircle } from 'lucide-react'
import { useState } from 'react'
import { fetchTokenGraph } from '@/services/rugmapsApi'

interface ContractFunction {
  name: string
  visibility: 'public' | 'external' | 'internal' | 'private'
  mutability: 'pure' | 'view' | 'payable' | 'nonpayable'
  params: string[]
  suspicious: boolean
  reason?: string
}

interface ContractDeepDiveProps {
  tokenAddress: string
  chain: string
}

// Map AI-analysis red flags onto concrete contract functions. The live
// token-graph route returns an AI analysis block (red_flags / green_flags /
// verdict) — we surface those as a function-level contract audit.
const FLAG_TO_FUNCTION: Array<{ flag: RegExp; fn: ContractFunction }> = [
  {
    flag: /mint|infinite mint|unlimited mint/i,
    fn: {
      name: 'mint',
      visibility: 'external',
      mutability: 'nonpayable',
      params: ['address', 'uint256'],
      suspicious: true,
      reason: 'Infinite mint possible',
    },
  },
  {
    flag: /blacklist|block sell/i,
    fn: {
      name: 'blacklist',
      visibility: 'public',
      mutability: 'nonpayable',
      params: ['address', 'bool'],
      suspicious: true,
      reason: 'Can block sells',
    },
  },
  {
    flag: /tax|fee|transfer fee/i,
    fn: {
      name: 'setTax',
      visibility: 'external',
      mutability: 'nonpayable',
      params: ['uint256'],
      suspicious: true,
      reason: 'Owner can set tax',
    },
  },
  {
    flag: /hidden tax|transfer tax/i,
    fn: {
      name: '_transfer',
      visibility: 'internal',
      mutability: 'nonpayable',
      params: ['address', 'address', 'uint256'],
      suspicious: true,
      reason: 'Hidden tax logic',
    },
  },
  {
    flag: /pause|can pause/i,
    fn: {
      name: 'pause',
      visibility: 'public',
      mutability: 'nonpayable',
      params: [],
      suspicious: true,
      reason: 'Can pause trading',
    },
  },
  {
    flag: /ownership|renounce/i,
    fn: { name: 'renounceOwnership', visibility: 'public', mutability: 'nonpayable', params: [], suspicious: false },
  },
]

/** Derive a contract-function audit from the live AI analysis block. */
function deriveContractFunctions(analysis: Record<string, any> | undefined): ContractFunction[] {
  const redFlags: string[] = Array.isArray(analysis?.red_flags) ? analysis.red_flags : []
  const greenFlags: string[] = Array.isArray(analysis?.green_flags) ? analysis.green_flags : []
  const text = [analysis?.verdict, analysis?.reasoning, ...redFlags, ...greenFlags].filter(Boolean).join(' ')

  const functions: ContractFunction[] = []
  for (const { flag, fn } of FLAG_TO_FUNCTION) {
    if (flag.test(text)) functions.push(fn)
  }

  // Always include the standard transfer entry point.
  functions.unshift({
    name: 'transfer',
    visibility: 'public',
    mutability: 'nonpayable',
    params: ['address', 'uint256'],
    suspicious: false,
  })

  return functions
}

export default function ContractDeepDive({ tokenAddress, chain }: ContractDeepDiveProps) {
  const [expanded, setExpanded] = useState(false)
  const [functions, setFunctions] = useState<ContractFunction[]>([])
  const [analyzed, setAnalyzed] = useState(false)
  const [loading, setLoading] = useState(false)

  const analyze = () => {
    setLoading(true)
    // Live route: GET /api/v1/rugmaps/token-graph — the backend returns an AI
    // contract analysis (red_flags / green_flags / verdict) which we map to a
    // function-level audit. TODO: a dedicated contract-audit endpoint would
    // return the actual ABI function list; for now we derive from the flags.
    fetchTokenGraph(tokenAddress, chain)
      .then((graph) => {
        setFunctions(deriveContractFunctions(graph?.analysis))
        setAnalyzed(true)
      })
      .finally(() => setLoading(false))
  }

  if (!analyzed) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-[16px] p-5"
      >
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-[9px] bg-[#06B6D4]/10 flex items-center justify-center">
            <FileCode className="w-[15px] h-[15px] text-[#06B6D4]" />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-[#F1F1F6]">Contract Deep Dive</h3>
          </div>
        </div>
        <button onClick={analyze} disabled={loading} className="btn btn-primary w-full">
          <Code className="w-4 h-4 mr-2" />
          {loading ? 'Analyzing contract...' : 'Analyze Contract'}
        </button>
      </motion.div>
    )
  }

  const suspiciousCount = functions.filter((f) => f.suspicious).length
  const hasMint = functions.some((f) => f.name.toLowerCase().includes('mint'))
  const hasBlacklist = functions.some((f) => f.name.toLowerCase().includes('blacklist'))
  const hasTax = functions.some((f) => f.name.toLowerCase().includes('tax') || f.name.toLowerCase().includes('fee'))

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-[16px] p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-[9px] bg-[#06B6D4]/10 flex items-center justify-center">
          <FileCode className="w-[15px] h-[15px] text-[#06B6D4]" />
        </div>
        <div>
          <h3 className="text-[14px] font-semibold text-[#F1F1F6]">Contract Analysis</h3>
        </div>
        <span
          className={`badge ml-auto text-[9.5px] ${suspiciousCount > 2 ? 'badge-danger' : suspiciousCount > 0 ? 'badge-warning' : 'badge-live'}`}
        >
          {suspiciousCount} suspicious
        </span>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div
          className={`p-2 rounded-[8px] border ${hasMint ? 'bg-[#FF3366]/5 border-[#FF3366]/20' : 'bg-emerald-500/5 border-emerald-500/10'}`}
        >
          <div className="flex items-center gap-1">
            {hasMint ? (
              <XCircle className="w-3.5 h-3.5 text-[#FF3366]" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span className={`text-[10px] ${hasMint ? 'text-[#FF3366]' : 'text-emerald-400'}`}>Mint</span>
          </div>
        </div>
        <div
          className={`p-2 rounded-[8px] border ${hasBlacklist ? 'bg-[#FF3366]/5 border-[#FF3366]/20' : 'bg-emerald-500/5 border-emerald-500/10'}`}
        >
          <div className="flex items-center gap-1">
            {hasBlacklist ? (
              <XCircle className="w-3.5 h-3.5 text-[#FF3366]" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span className={`text-[10px] ${hasBlacklist ? 'text-[#FF3366]' : 'text-emerald-400'}`}>Blacklist</span>
          </div>
        </div>
        <div
          className={`p-2 rounded-[8px] border ${hasTax ? 'bg-[#F59E0B]/5 border-[#F59E0B]/20' : 'bg-emerald-500/5 border-emerald-500/10'}`}
        >
          <div className="flex items-center gap-1">
            <Percent className={`w-3.5 h-3.5 ${hasTax ? 'text-[#F59E0B]' : 'text-emerald-400'}`} />
            <span className={`text-[10px] ${hasTax ? 'text-[#F59E0B]' : 'text-emerald-400'}`}>Tax</span>
          </div>
        </div>
      </div>

      {/* Function List */}
      <div className="space-y-1.5">
        {functions.slice(0, expanded ? functions.length : 4).map((fn, i) => (
          <div
            key={i}
            className={`flex items-center justify-between p-2 rounded-[8px] ${fn.suspicious ? 'bg-[#FF3366]/5 border border-[#FF3366]/10' : 'bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)]'}`}
          >
            <div className="flex items-center gap-2">
              {fn.suspicious ? (
                <AlertTriangle className="w-3.5 h-3.5 text-[#FF3366]" />
              ) : (
                <Code className="w-3.5 h-3.5 text-[#5C6080]" />
              )}
              <span className={`text-[11px] font-mono ${fn.suspicious ? 'text-[#FF3366]' : 'text-[#9DA0B0]'}`}>
                {fn.name}
              </span>
              <span className="text-[9px] text-[#5C6080]">{fn.visibility}</span>
            </div>
            {fn.suspicious && fn.reason && <span className="text-[9px] text-[#FF3366]">{fn.reason}</span>}
          </div>
        ))}
      </div>

      {functions.length > 4 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] text-purple-400 mt-2 hover:text-purple-300"
        >
          {expanded ? 'Show less' : `Show ${functions.length - 4} more functions`}
        </button>
      )}
    </motion.div>
  )
}
