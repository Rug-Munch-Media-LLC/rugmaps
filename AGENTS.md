[//]: # (SPDX-License-Identifier: MIT)
[//]: # (Copyright (c) 2026 Rug Munch Media LLC)
# AGENTS.md — rugmaps

> AI agent contract. Read this before touching anything in this repo.

## Status
canonical · owner=crmuncher · last_updated=2026-08-24

## What This Repo Is
rugmaps — wallet cluster visualization and AI-powered token investigation.
Deployed: `rugmaps-backend.service` on Talos (:8002); product surface served
via rmi-frontend's premium `/rugmaps` route. Current status: active product
(active development) disposition.

## Type
`product` · backend (FastAPI) + frontend (Vite/React) · deployed service

## Where It Lives
- Source: `https://git.rugmunch.io/RugMunchMedia/rugmaps`
- Deployment: systemd `rugmaps-backend.service`, 127.0.0.1:8002
- DataBus auth: `RMI_INTERNAL_KEY` via `/srv/secrets/rugmaps.env`
  (systemd drop-in) — required for DataBus ingest writeback.

## Built With
- Backend: FastAPI, httpx, pytest (55% coverage floor in CI), ruff, mypy, bandit
- Frontend: Vite, React, Vitest + covgate (60% per-diff gate), Biome
- AI: local llama.cpp (no paid APIs)

## 🚨 CRITICAL RULES

1. **Verdict guard is sacred.** Never return SAFE/verdicts on insufficient
   graph data (< MIN_NODES_FOR_VERDICT nodes). Empty data ≠ safe token.
2. **No nested repos.** Don't commit other complete project trees inside this one.
3. **No secrets.** Never commit `.secrets/`, `.env`, `*.pem`, `*.key`, `*.crt`.
   Service keys come from gopass → /srv/secrets → systemd env only.
4. **No data blobs.** Don't commit `*.zip`, `*.parquet`, model weights, sqlite files.
5. **Competitor naming.** Do not introduce new "bubblemaps"/"BubbleMaps.com"
   references — brand everything RugMaps (rebrand scrub in progress).
6. **Run the suites before pushing.** `make ci` parity: ruff, mypy, bandit,
   pytest (cov ≥50%), vitest.

## Commands
- `make dev-backend`   # uvicorn on :8002 (matches systemd)
- `make test-backend`  # pytest + coverage floor 50%
- `make test-frontend` # vitest
- `make ci`            # full parity with Forgejo CI

## Status

Status: active product under active development.

## Owners
- Primary: crmuncher
- Backup: TBD

## Related Repos
- `rmi-backend/` — canonical destination for merged code
- See product documentation for available products

## Open-Core Protection

This repo is open source (MIT) and under active development as a product.
The code demonstrates entity mapping patterns for crypto forensics — it is NOT
the complete RugMunch production wallet intelligence infrastructure. The
managed platform at rugmunch.io includes proprietary enhancements.

See [CONTRIBUTING.md](CONTRIBUTING.md) for project methodology.
for details on what information belongs in public vs private repos.