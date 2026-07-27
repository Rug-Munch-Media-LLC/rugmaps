import { motion } from 'framer-motion'
import { CheckCircle2, Copy, Download, ExternalLink, FileJson, Share2 } from 'lucide-react'
import { useState } from 'react'
import type { AIAnalysisResult, RugMapsReport, ScanResult, SentinelResult } from '@/types'

interface ExportPanelProps {
  tokenAddress: string
  chain: string
  scanData: ScanResult
  aiResult: AIAnalysisResult
  sentinelResult: SentinelResult
}

export default function ExportPanel({ tokenAddress, chain, scanData, aiResult, sentinelResult }: ExportPanelProps) {
  const [exported, setExported] = useState(false)
  const [shareUrl, setShareUrl] = useState('')

  const generateJSON = () => {
    const report: RugMapsReport = {
      version: '2.5',
      generated_at: new Date().toISOString(),
      token: { address: tokenAddress, chain },
      scan: scanData,
      ai_analysis: aiResult,
      sentinel: sentinelResult,
      hash: '', // SHA-256 of report for verification
    }

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rugmaps-report-${tokenAddress.slice(0, 8)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setExported(true)
    setTimeout(() => setExported(false), 3000)
  }

  const generateShareLink = () => {
    // In production: upload to R2, return shareable URL
    const mockUrl = `https://rugmunch.io/report/${tokenAddress.slice(0, 16)}`
    setShareUrl(mockUrl)
    navigator.clipboard.writeText(mockUrl)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-[16px] p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-[9px] bg-[#10B981]/10 flex items-center justify-center">
          <Download className="w-[15px] h-[15px] text-[#10B981]" />
        </div>
        <div>
          <h3 className="text-[14px] font-semibold text-[#F1F1F6]">Export Report</h3>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={generateJSON} className="btn btn-ghost btn-sm flex items-center gap-2">
          <FileJson className="w-4 h-4" />
          JSON
        </button>
        <button onClick={generateShareLink} className="btn btn-ghost btn-sm flex items-center gap-2">
          <Share2 className="w-4 h-4" />
          Share Link
        </button>
      </div>

      {exported && (
        <div className="mt-3 p-2 rounded-[8px] bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="text-[11px] text-emerald-400">Report exported!</span>
        </div>
      )}

      {shareUrl && (
        <div className="mt-3 p-2 rounded-[8px] bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)] flex items-center gap-2">
          <ExternalLink className="w-4 h-4 text-purple-400" />
          <span className="text-[11px] text-purple-400 flex-1 truncate">{shareUrl}</span>
          <Copy className="w-3.5 h-3.5 text-[#5C6080] cursor-pointer" />
        </div>
      )}
    </motion.div>
  )
}
