# RugMaps

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
