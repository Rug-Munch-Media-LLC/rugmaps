// Dead-endpoint regression guard.
//
// The 2026-08-21 audit found components raw-fetching routes that do not exist
// on the backend (/rugmaps/deployer-tokens, /investigate/fund-flow) — every
// call 404'd and the panels silently rendered fake-empty states. All API
// access must go through services/rugmapsApi.ts (which targets routes
// verified live 2026-08-21). This test scans the source tree and fails if any
// file re-introduces a fetch() to a path outside the live allow-list.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC_ROOT = join(__dirname, '..')

// Route prefixes verified LIVE on rmi-backend (2026-08-21 probes):
//   /api/v1/rugmaps/analyze|entity|fund-flows|token-graph|map|health|ai-health...
//   /api/v1/scoring/deployer/...
// The typed client in services/rugmapsApi.ts is the gateway — allow it to
// build URLs, but no component may fetch anything else.
const LIVE_PATH_ALLOWLIST = [
  '/api/v1/rugmaps/analyze/',
  '/api/v1/rugmaps/entity/',
  '/api/v1/rugmaps/fund-flows',
  '/api/v1/rugmaps/token-graph',
  '/api/v1/scoring/deployer/',
]

// Paths that historically 404'd — fail hard if any of them come back.
const DEAD_PATHS = [
  '/rugmaps/scan',
  '/rugmaps/deployer-tokens',
  '/rugmaps/rug-warning',
  '/rugmaps/holders',
  '/investigate/fund-flow',
  '/rugcharts/plugins/all',
]

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue
      out.push(...walk(full))
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith('.d.ts')) {
      out.push(full)
    }
  }
  return out
}

describe('no raw fetches to dead endpoints', () => {
  const files = walk(SRC_ROOT)

  it('source tree is non-empty (guard self-check)', () => {
    expect(files.length).toBeGreaterThan(5)
  })

  for (const file of files) {
    const rel = relative(SRC_ROOT, file)
    // The typed API client itself builds the URLs; everything else must not
    // call fetch() on API paths directly.
    if (rel.replace(/\\/g, '/') === 'services/rugmapsApi.ts') continue

    it(`${rel} has no direct fetch() to an /api/ path`, () => {
      const src = readFileSync(file, 'utf8')
      const fetchCalls = [...src.matchAll(/fetch\(\s*[`'"]([^`'"]+)/g)].map((m) => m[1] ?? '')
      for (const url of fetchCalls) {
        if (!url.includes('/api/')) continue
        const allowed = LIVE_PATH_ALLOWLIST.some((p) => url.includes(p))
        expect(allowed, `${rel}: fetch('${url}') is not a verified-live route — use services/rugmapsApi.ts`).toBe(true)
      }
    })
  }

  it('no source file references a known-dead path', () => {
    const offenders: string[] = []
    for (const file of files) {
      // The typed client documents the dead paths in its header comment as
      // the regression context — it never fetches them.
      if (relative(SRC_ROOT, file).replace(/\\/g, '/') === 'services/rugmapsApi.ts') continue
      const src = readFileSync(file, 'utf8')
      for (const dead of DEAD_PATHS) {
        if (src.includes(dead)) {
          offenders.push(`${relative(SRC_ROOT, file)}: ${dead}`)
        }
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })
})
