---
phase: 09-foundation-infrastructure
plan: "04"
subsystem: infra
tags: [pnpm, monorepo, railway, github-actions, cicd]

# Dependency graph
requires:
  - phase: 09-foundation-infrastructure
    provides: Supabase migration, SIWE auth guards (09-02, 09-03)
provides:
  - pnpm monorepo with app/ (Next.js) and agent-server/ (stub) workspaces
  - GitHub Actions workflow for Railway auto-deploy on app/** pushes to main
  - railway.json nixpacks build config
  - agent-server/ stub ready for NanoClaw fork in Phase 10
affects: [phase-10, phase-11, phase-12, phase-13]

# Tech tracking
tech-stack:
  added: [pnpm-workspaces]
  patterns: [monorepo-layout, path-filtered-cicd]

key-files:
  created:
    - pnpm-workspace.yaml
    - package.json (workspace root)
    - agent-server/package.json
    - railway.json
    - .github/workflows/deploy-app.yml
    - app/.env.local (symlink to root .env.local)
  modified:
    - app/package.json (name changed to "app", pnpm field removed)
    - .gitignore (node_modules and .next/ now match subdirs too)

key-decisions:
  - "app/.env.local is a symlink to root .env.local — keeps env vars at root per plan, Next.js can read them from app/"
  - "pnpm.onlyBuiltDependencies moved from app/package.json to root package.json (pnpm workspace requirement)"
  - "Railway Root Directory must be set to app in dashboard before auto-deploy works (manual step pending)"

patterns-established:
  - "Monorepo pattern: workspace root has no source code, only scripts and workspace config"
  - "Path-filtered CI/CD: deploy-app.yml only triggers on app/** or pnpm-workspace.yaml changes"

requirements-completed: [CICD-01, CICD-02]

# Metrics
duration: 15min
completed: 2026-03-22
---

# Phase 09 Plan 04: Monorepo Restructure + CI/CD Summary

**pnpm monorepo with app/ (Next.js) and agent-server/ (NanoClaw stub) — GitHub Actions deploys app/ to Railway on push to main**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-22
- **Completed:** 2026-03-22
- **Tasks:** 1/2 fully automated (Task 2 paused at checkpoint for human Railway config)
- **Files modified:** 107 files (renames + new config files)

## Accomplishments

- All Next.js source moved into app/ subdirectory using git mv (preserves history)
- Root package.json replaced with pnpm workspace root (scripts delegate to --filter app)
- pnpm-workspace.yaml declares app/ and agent-server/ workspaces
- agent-server/package.json stub created for NanoClaw fork (Phase 10)
- railway.json created with nixpacks builder pointing to app/
- .github/workflows/deploy-app.yml created with paths filter on app/** and pnpm-workspace.yaml
- Build verified: `pnpm --filter app build` exits 0 with all 37 routes compiled

## Task Commits

1. **Task 1: Restructure repo into monorepo + create workflow file** - `844eafb` (feat)

**Plan metadata:** (pending — created at checkpoint return)

## Files Created/Modified

- `pnpm-workspace.yaml` - Workspace config listing app/ and agent-server/
- `package.json` - Workspace root: scripts delegate to pnpm --filter app, pnpm config moved here
- `agent-server/package.json` - NanoClaw fork stub for Phase 10
- `railway.json` - Nixpacks builder + start command config for Railway
- `.github/workflows/deploy-app.yml` - Deploy to Railway on app/** push to main
- `app/package.json` - Renamed to "app", pnpm field removed (moved to root)
- `app/.env.local` - Symlink to root .env.local for local Next.js dev
- `.gitignore` - node_modules and .next/ now match subdirectory patterns

## Decisions Made

- `app/.env.local` is a symlink to root `.env.local` — the plan says do not move `.env.local`, but Next.js requires env vars in its project root. Symlink satisfies both constraints.
- `pnpm.onlyBuiltDependencies` field moved from `app/package.json` to root `package.json` — pnpm warns that this field has no effect in workspace packages (only root is read).
- Railway Root Directory (`app`) is a manual dashboard step — cannot be automated via CLI.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Created app/.env.local symlink to root .env.local**
- **Found during:** Task 1 (verifying build)
- **Issue:** `pnpm --filter app build` failed with "supabaseUrl is required" because Next.js in app/ couldn't find .env.local (which is at root per plan's "Do NOT move .env.local")
- **Fix:** Created `app/.env.local` as symlink to `../.env.local` — satisfies Next.js env resolution without moving the file
- **Files modified:** app/.env.local (new symlink)
- **Verification:** Build succeeded after symlink creation (all 37 routes compiled)
- **Committed in:** 844eafb (Task 1 commit)

**2. [Rule 1 - Bug] Fixed trailing comma in app/package.json causing JSON parse error**
- **Found during:** Task 1 (after removing pnpm field from app/package.json)
- **Issue:** Edit left a trailing comma before closing `}` — pnpm failed with JSON parse error
- **Fix:** Removed trailing comma
- **Files modified:** app/package.json
- **Verification:** `python3 -c "import json; json.load(open('app/package.json'))"` returned VALID JSON
- **Committed in:** 844eafb (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 bug)
**Impact on plan:** Both necessary for correct operation. No scope creep.

## User Setup Required

Before GitHub Actions can deploy to Railway, two manual steps are required:

### Step A — Add GitHub Secrets
1. Go to GitHub repo Settings → Secrets and variables → Actions → New repository secret
2. Add `RAILWAY_TOKEN`: Railway Dashboard → Account Settings → Tokens → Create token
3. Add `RAILWAY_SERVICE_ID`: Railway project → Next.js service → Settings → Service ID

### Step B — Set Railway Root Directory
1. Railway Dashboard → your project → Next.js service → Settings → Source
2. Set "Root Directory" to: `app`
3. Save → Railway will redeploy using app/ as the root

### Verify
- Push a trivial change to app/src/app/page.tsx
- GitHub Actions tab → "Deploy app to Railway" workflow should show green checkmark
- Railway Deployments shows a new deployment triggered

## Issues Encountered

- pnpm install prompted interactively for reinstall confirmation — used `printf "y\n" | pnpm install` to handle it

## Next Phase Readiness

- Monorepo structure complete and build verified — Phase 10 (NanoClaw fork) can now be added in agent-server/
- GitHub Actions workflow is in place — becomes active once GitHub Secrets and Railway Root Directory are configured
- agent-server/ stub is in place for Phase 10 to populate

---
*Phase: 09-foundation-infrastructure*
*Completed: 2026-03-22*

## Self-Check: PASSED

- FOUND: pnpm-workspace.yaml
- FOUND: app/package.json
- FOUND: agent-server/package.json
- FOUND: railway.json
- FOUND: .github/workflows/deploy-app.yml
- FOUND: app/src/
- FOUND: commit 844eafb
