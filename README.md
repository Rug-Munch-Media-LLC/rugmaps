# RugMaps

> Visual wallet-intelligence maps — entity relationships, token flows and bubble-map token visualization for crypto forensics.

**License:** [MIT](LICENSE) · **Canonical:** https://git.rugmunch.io/RugMunchMedia/rugmaps
**Mirrors:** [GitHub](https://github.com/Rug-Munch-Media-LLC) · [GitLab](https://gitlab.com/rug-munch-media-group) · [Codeberg](https://codeberg.org/RugMunchMedia)

**Clone over Nostr:** `git clone nostr://npub1e97559tn2j6j02shalmn5x6xv5jt8ejlclh6sta8nln0n55whwtszyrqud/git.cryptorugmunch.com/rugmaps` (GRASP)

> **Platform:** 21 networks (20 EVM-family chains incl. Tron, plus Solana) · ~422k labels · 283M indexed transfers (+628M internal) · 50+ security modules.

> ✅ **ACTIVE STANDALONE PRODUCT (2026-08-30).** RugMaps is a standalone
> product: this repo carries its own backend engine + frontend. The
> production API that serves [rugmaps.rugmunch.io](https://rugmaps.rugmunch.io)
> is implemented in [`rmi-backend`](https://git.rugmunch.io/RugMunchMedia/rmi-backend)
> (`app/routers/rugmaps_router.py` → `/api/v1/rugmaps/*`, engine in
> `app/domains/scanner/rugmaps/`) — this repo is the standalone/open-core
> distribution of the same product. Develop, deploy, and file issues here.

**Visual wallet-intelligence maps — entity relationships, token flows, and
bubble-map token visualization for crypto forensics.**

RugMaps turns raw on-chain data into navigable visual maps: who is connected
to whom, how funds move between wallets and tokens, and where risk clusters
form. Part of the [Rug Munch](https://rugmunch.io) intelligence suite.

| Layer   | Stack                                                        |
|---------|--------------------------------------------------------------|
| Backend | Python · FastAPI · vector ANN index · AI-assisted labeling   |
| Frontend| React 19 · Vite · TypeScript (`@rugmunch/rugmaps-frontend`)  |

## Features

- **Entity relationship graphs** — wallet ↔ wallet ↔ token linkage maps
- **Bubble maps** — proportional token-supply/holdings visualization
- **ANN similarity index** — fast nearest-cluster lookups at scale
- **Auto-labeling** — heuristic + AI-assisted entity classification (CEX,
  deployer, sniper, LP, …)
- **Risk clustering** — surface coordinated wallets and wash-trading rings

## Repository Layout

```
backend/    FastAPI service (app/main.py, routers/, ann_index.py, bubble_maps.py)
frontend/   React + Vite map UI (src/components, src/services)
```

## Quick Start

```bash
# backend (port 8002)
make install
make dev            # = make dev-backend (uvicorn)

# frontend
cd frontend
npm install
npm run dev
```

Run `make help` for all targets. Lint and typecheck gates run via the repo
Makefile and CI.

## API

The backend exposes a versioned REST API under `/api` — interactive docs at
`http://localhost:8002/docs` when running locally.

## Open-Core Model

This repository is open source (MIT): it demonstrates entity-mapping and
cluster-visualization patterns for crypto forensics. The managed platform at
[rugmunch.io](https://rugmunch.io) runs the production wallet-intelligence
infrastructure. See [OPEN-CORE.md](OPEN-CORE.md).

## Contributing

Conventional commits (`feat(scope):`, `fix(scope):`, `docs:`), tests for new
code paths, lint clean. See [CONTRIBUTING.md](CONTRIBUTING.md) and
[AGENTS.md](AGENTS.md) for the agent contract.

## License

[MIT](./LICENSE) © Rug Munch Media LLC

## FAQ

See [docs/FAQ.md](docs/FAQ.md) for frequently asked questions.
