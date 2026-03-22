---
phase: 10-nanoclaw-vps-deployment
plan: "05"
subsystem: infra
tags: [github-actions, cicd, ssh, docker, vps, nanoclaw]

# Dependency graph
requires:
  - phase: 10-nanoclaw-vps-deployment
    provides: NanoClaw fork on VPS with docker compose, Caddy, systemd
provides:
  - GitHub Actions workflow deploy-agent.yml in agent-server repo
  - Automated VPS deployment triggered on agent-server/** pushes to main
  - CICD-03 — automated deployment pipeline for NanoClaw fork
  - CICD-04 — nanoclaw-agent container image rebuilt on deploy (new turns pick up updated image)
affects: [10-06, phase-11, phase-12, phase-13]

# Tech tracking
tech-stack:
  added: [appleboy/ssh-action@v1.2.5]
  patterns: [path-filtered GitHub Actions workflow, SSH deploy via appleboy/ssh-action]

key-files:
  created:
    - agent-server/.github/workflows/deploy-agent.yml
  modified: []

key-decisions:
  - "deploy-agent.yml lives in agent-server repo (separate git repo from network/), not network/ repo"
  - "Path filter agent-server/** prevents false positive triggers on Next.js app changes"
  - "CICD-04: docker build nanoclaw-agent:latest + docker compose up --force-recreate nanoclaw restarts host with updated image"
  - "workflow_dispatch included for manual first-run verification before secrets are tested via push"

patterns-established:
  - "Path-filtered CI/CD: use paths: [agent-server/**] to scope triggers to relevant file changes"
  - "SSH deploy pattern: appleboy/ssh-action@v1.2.5 with VPS_HOST/VPS_USER/VPS_SSH_KEY secrets"

requirements-completed: [CICD-03, CICD-04]

# Metrics
duration: 5min
completed: 2026-03-22
---

# Phase 10 Plan 05: GitHub Actions CI/CD Workflow Summary

**GitHub Actions SSH deploy workflow for NanoClaw VPS: path-filtered on agent-server/**, rebuilds nanoclaw-agent:latest, restarts host via docker compose --force-recreate**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-22T10:41:04Z
- **Completed:** 2026-03-22T10:46:00Z
- **Tasks:** 1 of 2 complete (Task 2 is human-verify checkpoint — awaiting GitHub Secrets setup)
- **Files modified:** 1

## Accomplishments
- Created .github/workflows/deploy-agent.yml in the agent-server repo
- Path filter on agent-server/** ensures the workflow only triggers on NanoClaw changes
- Documents all 3 required GitHub Secrets inline as comments
- CICD-04 compliance: nanoclaw-agent container image rebuilt on every deploy; in-flight containers unaffected

## Task Commits

Each task was committed atomically:

1. **Task 1: Create GitHub Actions deploy-agent workflow** - `23c028b` (feat)

**Plan metadata commit:** (pending — after Task 2 checkpoint cleared)

## Files Created/Modified
- `agent-server/.github/workflows/deploy-agent.yml` — GitHub Actions workflow: SSH to VPS, git pull, npm ci, npm run build, docker build nanoclaw-agent:latest, docker compose up --force-recreate nanoclaw

## Decisions Made
- workflow lives in agent-server/ repo (separate git repo), not in network/ repo — correct location for agent-server CI/CD
- Used git pull origin main on VPS (agent-server is its own git repo cloned to /opt/agent-server)
- docker compose up -d --force-recreate nanoclaw restarts only the NanoClaw host service, not Caddy
- Verification step checks `docker compose ps nanoclaw` for "running" or "Up" status after 3s sleep
- On failure: prints last 20 lines of nanoclaw logs before exiting 1

## Deviations from Plan

None — plan executed exactly as written. The additional context confirmed the VPS uses docker compose (not bare systemd) as primary host management.

## User Setup Required

**GitHub Secrets must be configured before the workflow can run.**

Add these 3 secrets at: GitHub repo (agent-server) → Settings → Secrets and variables → Actions:

| Secret | Value |
|--------|-------|
| `VPS_HOST` | `146.190.161.168` (or hostname) |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | SSH private key for the deploy user |

To generate a dedicated deploy key:
```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/nanoclaw_deploy_key -N ""
ssh-copy-id -i ~/.ssh/nanoclaw_deploy_key.pub deploy@146.190.161.168
# Copy private key contents for VPS_SSH_KEY secret:
cat ~/.ssh/nanoclaw_deploy_key
```

## Next Phase Readiness
- CI/CD pipeline code is complete — workflow file committed to agent-server repo
- Awaiting human verification: add GitHub Secrets and run workflow_dispatch to confirm SSH deploy works
- Once verified, pushing any change under agent-server/ to main auto-deploys to VPS

## Self-Check: PASSED

- FOUND: agent-server/.github/workflows/deploy-agent.yml
- FOUND: .planning/phases/10-nanoclaw-vps-deployment/10-05-SUMMARY.md
- FOUND: commit 23c028b (feat(10-05): add GitHub Actions CI/CD workflow for VPS deploy)

---
*Phase: 10-nanoclaw-vps-deployment*
*Completed: 2026-03-22*
