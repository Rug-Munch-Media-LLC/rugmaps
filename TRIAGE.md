# Product Triage
rugmaps
Decision: ACTIVE DEVELOPMENT (supersedes 2026-07 MERGE→ARCHIVE decision)
Reason: RugMaps is a deployed product — `rugmaps-backend.service` runs on Talos
(:8002) and the wallet-cluster surface is served through rmi-frontend's
premium `/rugmaps` route. The 2026-07 "orphaned, no deploy" assessment was
stale (corrected in the 2026-08-24 full audit,
/root/.knowledge/RUGMAPS_FULL_AUDIT_2026-08-24.md).

Current track:
1. Engine quality: BFS traversal with intra-cluster edges, parallel DataBus
   fetches, verdict guards (no SAFE on insufficient data).
2. Data pipeline: service-keyed DataBus ingest (X-RMI-Key) is live; fetch-side
   credentials are the next unlock.
3. Rebrand: competitor naming ("bubblemaps") being scrubbed toward RugMaps.
4. The merge into rmi-backend remains a long-term option but is NOT the
   active disposition — do not archive this repo.
