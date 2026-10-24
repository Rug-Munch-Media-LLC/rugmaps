# rugmaps

Two visualisations over wallet data: a bubble map of a token's holders clustered by
funding lineage, and a honeypot map showing where a scam token's liquidity went.
The main app embeds it; it also runs standalone.

**Status:** beta · **Licence:** MIT, see [LICENSE](LICENSE).

Canonical: https://git.rugmunch.io/RugMunchMedia/rugmaps

## Quickstart

Python 3.11+ for the backend, Vite for the frontend.

```bash
git clone https://git.rugmunch.io/RugMunchMedia/rugmaps.git
cd rugmaps
make install
make dev              # backend on :8002 (matches the systemd unit)
```

```bash
make dev-frontend     # Vite on :5173, proxies to :8002
```

Compose builds both images:

```bash
docker compose up -d
```

`curl -s localhost:8002/health` is the liveness check.

## What it does

- **Bubble maps.** `app/bubble_maps.py` groups holders into clusters using
  funding relationships, then lays them out so a coordinated wallet set is
  visually obvious rather than a list of addresses.
- **Honeypot maps.** `app/routers/honeypot_map.py` traces where liquidity moved
  after a token trapped buyers.
- **Label enrichment.** `app/auto_labeler.py` attaches entity names to addresses
  so a cluster reads as an exchange, a deployer, or a fresh wallet.
- **Address similarity.** `app/ann_index.py` gives approximate nearest-neighbour
  lookup over address behaviour vectors, used to spot near-duplicate clusters.

## How it is put together

```
backend/app/
  main.py                FastAPI app, CORS, health
  routers/bubble_maps    cluster graph endpoint
  routers/honeypot_map   flow endpoint
  bubble_maps.py         clustering
  auto_labeler.py        label lookup
  ann_index.py           ANN over behaviour vectors
frontend/                Vite app
```

## Configuration

| Variable | Purpose |
|---|---|
| `PORT` | backend port; the systemd unit expects 8002 |
| `CORS_ORIGINS` | allowed origins for the frontend |
| `REDIS_URL` | cache for cluster and label lookups |
| `RMI_BACKEND_URL` | upstream labels and transfer data |

## Known limits

- Cluster inference is a heuristic. Two wallets funded from the same exchange
  deposit address will look related; that is the cost of the method.
- Large holder sets are capped before clustering, so a 200k-holder token is
  sampled, not exhaustive.
- The layout is computed per request; nothing is precomputed or cached across
  tokens.

## Licence

MIT.
