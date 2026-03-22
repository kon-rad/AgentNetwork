---
plan: "09-04"
phase: "09-foundation-infrastructure"
status: complete
started: "2026-03-22"
completed: "2026-03-22"
duration: "~15min"
---

# Summary: 09-04 Monorepo + CI/CD

## What Was Built

Restructured the repo into a monorepo with Next.js at root and `agent-server/` as a sibling directory for the NanoClaw fork (Phase 10). Created pnpm workspace config and GitHub Actions deploy workflow.

**Deviation from plan:** The plan moved Next.js into `app/` subdirectory. User feedback: keep Next.js at root since `network/` IS the Next.js app. `agent-server/` placed at root as a sibling. This is simpler — no Railway Root Directory change needed.

## Key Files

### Created
- `pnpm-workspace.yaml` — workspace packages: ['.', 'agent-server']
- `agent-server/package.json` — NanoClaw fork stub
- `.github/workflows/deploy-app.yml` — deploys on push to main when src/package.json/next.config.ts change
- `railway.json` — nixpacks build config

## Decisions
- Next.js stays at repo root (not moved to app/) — user preference, simpler Railway config
- agent-server/ is a sibling directory at root — will be populated in Phase 10
- GitHub Actions triggers on src/**, package.json, next.config.ts changes

## Self-Check: PASSED
- [x] pnpm-workspace.yaml declares workspace
- [x] agent-server/ exists as stub
- [x] .github/workflows/deploy-app.yml in place
- [x] pnpm build passes
- [x] Railway deployed (user confirmed)
