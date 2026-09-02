import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AIAnalysisResult, ScanResult, SentinelResult } from '@/types'
import ExportPanel from '../ExportPanel'

// ExportPanel must export the REAL data it is given — the 2026-08-21 audit
// flagged fabricated panel data across the rugcharts/rugmaps frontends. The
// JSON report must carry the exact scan/ai/sentinel payloads passed in.

const scanData = {
  risk_score: 72,
  risk_level: 'high',
  flags: ['lp_unlocked', 'mint_enabled'],
} as unknown as ScanResult

const aiResult = {
  summary: 'High rug risk — LP unlocked and mint enabled.',
  confidence: 0.91,
} as unknown as AIAnalysisResult

const sentinelResult = {
  verdict: 'DANGER',
  honeypot_probability: 0.77,
} as unknown as SentinelResult

const captured: { blob: Blob | null; revoked: string[] } = { blob: null, revoked: [] }

beforeEach(() => {
  captured.blob = null
  captured.revoked = []
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn((blob: Blob) => {
      captured.blob = blob
      return 'blob:mock-url'
    }),
    revokeObjectURL: vi.fn((url: string) => {
      captured.revoked.push(url)
    }),
  })
  // jsdom/happy-dom anchor.click() does not navigate; spy to avoid errors.
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('ExportPanel', () => {
  it('renders with the real report inputs', () => {
    render(
      <ExportPanel
        tokenAddress="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
        chain="solana"
        scanData={scanData}
        aiResult={aiResult}
        sentinelResult={sentinelResult}
      />,
    )
    expect(screen.getByText('Export Report')).toBeInTheDocument()
  })

  it('JSON export contains the REAL passed-in data (no fabricated values)', async () => {
    render(
      <ExportPanel
        tokenAddress="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
        chain="solana"
        scanData={scanData}
        aiResult={aiResult}
        sentinelResult={sentinelResult}
      />,
    )

    fireEvent.click(screen.getByText('JSON'))

    await waitFor(() => expect(captured.blob).not.toBeNull())
    const text = await (captured.blob as Blob).text()
    const report = JSON.parse(text)

    expect(report.token).toEqual({ address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', chain: 'solana' })
    expect(report.scan).toEqual(scanData)
    expect(report.ai_analysis).toEqual(aiResult)
    expect(report.sentinel).toEqual(sentinelResult)
    expect(report.version).toBeTruthy()
    expect(report.generated_at).toBeTruthy()
    expect(captured.blob?.type).toBe('application/json')
    // Object URL is released after the download click.
    expect(captured.revoked).toContain('blob:mock-url')
  })

  it('shows the exported confirmation after generating JSON', async () => {
    render(
      <ExportPanel
        tokenAddress="0x0000000000000000000000000000000000000000"
        chain="ethereum"
        scanData={scanData}
        aiResult={aiResult}
        sentinelResult={sentinelResult}
      />,
    )
    fireEvent.click(screen.getByText('JSON'))
    expect(await screen.findByText('Report exported!')).toBeInTheDocument()
  })
})
