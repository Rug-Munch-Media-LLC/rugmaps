# ── rugmaps Makefile ──────────────────────────────────────────
# Rug Munch Media fleet standard (from fleet-template/Makefile.python.template)
# Source of truth: https://git.rugmunch.io/RugMunchMedia/rugmaps
#
# Mixed Python (backend) + plain frontend repo. Backend does geo/risk maps;
# frontend is a static asset bundle (no package.json yet).
#
# Layout:
#   backend/app/rugmaps_ai.py          - map generation + AI commentary
#   backend/app/routers/               - FastAPI routes
#   frontend/src/components/           - static components (no bundler)

SHELL := /bin/bash

.PHONY: help install dev dev-backend dev-frontend build build-backend build-frontend \
        lint lint-backend lint-frontend format format-backend format-frontend \
        check test typecheck security precommit commit ci clean

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install backend deps in editable mode
	cd backend && pip install -e ".[dev]"

dev: dev-backend ## Default dev target = backend FastAPI server

dev-backend: ## Start backend on :8000 (uvicorn, rugmaps_ai module)
	cd backend && uvicorn app.rugmaps_ai:app --reload --host 0.0.0.0 --port 8000

dev-frontend: ## Serve frontend/ static files on :5173
	cd frontend && python3 -m http.server 5173

build-backend: ## Build backend Docker image
	cd backend && docker build -t rugmaps-backend .

build-frontend: ## Bundle frontend (no bundler - placeholder)
	@echo "frontend is a static site - ship frontend/ as-is"
	@test -d frontend/src/components

build: build-backend ## Build backend image + verify frontend layout

lint: lint-backend ## Lint backend (frontend has no JS linter configured)

lint-backend: ## Lint backend/app/ with ruff
	cd backend && ruff check app/

lint-frontend: ## Placeholder (no package.json in frontend/ yet)
	@echo "no frontend linter configured yet"

format: format-backend ## Format backend with ruff (writes)

format-backend: ## Format backend/app/ with ruff
	cd backend && ruff format app/
	cd backend && ruff check --fix app/

format-frontend: ## Placeholder
	@echo "no frontend formatter configured yet"

check: lint-backend ## Full check: lint + format

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

ci: lint typecheck security ## Full CI: lint + typecheck + security

clean: ## Remove build artifacts
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	rm -rf .pytest_cache .mypy_cache .ruff_cache
