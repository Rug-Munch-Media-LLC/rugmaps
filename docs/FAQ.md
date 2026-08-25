# RugMaps — FAQ

**What is RugMaps?** Visual wallet-intelligence maps: entity relationship graphs, token flow visualization, bubble maps for crypto forensics.

**What data does it need?** Chain data from your indexer or the bundled ingestion; entity labels optional (auto-labeler ships heuristics + AI-assisted classification).

**How does the ANN index work?** Vector similarity over wallet/token features (`backend/app/ann_index.py`); swap backends via config.

**Can I add label sources?** Yes — implement a labeler module; CEX/deployer/sniper heuristics ship as examples.

**Is there an API?** Versioned REST under `/api`; interactive docs at `/docs` when running locally.
