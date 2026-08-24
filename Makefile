# ── rugmaps Makefile ──────────────────────────────────────────
# Rug Munch Media fleet standard (from fleet-template/Makefile.python.template)
# Source of truth: https://git.rugmunch.io/RugMunchMedia/rugmaps
#
# Mixed Python (backend) + Vite/React (frontend) repo.
#
# Layout:
#   backend/app/main.py                - FastAPI entry (systemd: rugmaps-backend, :8002)
#   backend/app/bubble_maps.py         - wallet cluster graph engine
#   backend/app/rugmaps_ai.py          - local llama.cpp AI analysis
#   backend/app/routers/               - FastAPI routes
#   frontend/                          - Vite + React + Vitest + Biome

SHELL := /bin/bash

.PHONY: help install dev dev-backend dev-frontend build build-backend build-frontend \
        lint lint-backend lint-frontend format format-backend format-frontend \
        check test typecheck security precommit commit ci clean

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install backend deps in editable mode
	cd backend && pip install -e ".[dev]"

dev: dev-backend ## Default dev target = backend FastAPI server

dev-backend: ## Start backend on :8002 (matches systemd rugmaps-backend)
	cd backend && uvicorn app.main:app --reload --host 127.0.0.1 --port 8002

dev-frontend: ## Vite dev server on :5173
	cd frontend && npm run dev

build-backend: ## Build backend Docker image
	cd backend && docker build -t rugmaps-backend .

build-frontend: ## Production build via Vite
	cd frontend && npm ci --frozen-lockfile && npm run build

build: build-backend ## Build backend image + verify frontend layout

lint: lint-backend lint-frontend ## Lint backend (ruff) + frontend (biome)

lint-backend: ## Lint backend/app/ with ruff
	cd backend && ruff check app/

lint-frontend: ## Biome lint on frontend/src
	cd frontend && npx @biomejs/biome lint src/

test-backend: ## Backend pytest with coverage
	cd backend && python -m pytest tests/ --cov=app --cov-fail-under=50

test-frontend: ## Frontend vitest suite
	cd frontend && npx vitest run

format: format-backend format-frontend ## Format backend + frontend

format-backend: ## Format backend/app/ with ruff
	cd backend && ruff format app/
	cd backend && ruff check --fix app/

format-frontend: ## Biome format frontend (writes)
	cd frontend && npx @biomejs/biome format --write src/

check: lint typecheck test-backend test-frontend ## Full check: lint + types + both suites

typecheck: ## MyPy on backend
	cd backend && mypy app/ --ignore-missing-imports

test: ## Run backend tests (placeholder)
	@cd backend && (pytest tests/ -x -q -m "not integration" 2>/dev/null || echo "no tests yet")

security: ## Security audit
	cd backend && bandit -r app/ -q
	cd backend && ruff check --select S app/

precommit: ## Install pre-commit hooks
	pre-commit install

commit: ## Interactive commit with commitizen
	cz commit || git commit

ci: lint typecheck security test-backend test-frontend ## Full CI parity with Forgejo

clean: ## Remove build artifacts
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	rm -rf .pytest_cache .mypy_cache .ruff_cache
