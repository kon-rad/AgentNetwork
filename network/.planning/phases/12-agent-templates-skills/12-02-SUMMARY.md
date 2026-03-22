---
phase: 12-agent-templates-skills
plan: "02"
subsystem: infra
tags: [claude-code, skills, agent-templates, filecoin, onchain, wallet, defi, solidity, video, clipper]

# Dependency graph
requires:
  - phase: 12-01
    provides: agent template directory scaffold (container/, templates/ structure)
provides:
  - Tier 1 shared skills: filecoin-storage, onchain-data, wallet (available to all agent containers)
  - Tier 2 template skills: video-production (filmmaker), code-execution + git-ops (coder), dex-tools (trader), code-analysis + static-analysis (auditor), video-processing + content-analysis (clipper)
  - Dockerfile COPY instruction for skills/ to /app/skills/
affects: [12-03, phase-13-agent-runner, agent-container-builds]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Claude Code skill format: directory with SKILL.md containing YAML frontmatter + markdown instructions"
    - "Three-tier skill hierarchy: Tier 1 (container/skills/) all agents, Tier 2 (templates/{type}/.claude/skills/) per type, Tier 3 (runtime-written to workspace/.claude/skills/) learned"

key-files:
  created:
    - agent-server/container/skills/filecoin-storage/SKILL.md
    - agent-server/container/skills/onchain-data/SKILL.md
    - agent-server/container/skills/wallet/SKILL.md
    - agent-server/templates/filmmaker/.claude/skills/video-production/SKILL.md
    - agent-server/templates/coder/.claude/skills/code-execution/SKILL.md
    - agent-server/templates/coder/.claude/skills/git-ops/SKILL.md
    - agent-server/templates/trader/.claude/skills/dex-tools/SKILL.md
    - agent-server/templates/auditor/.claude/skills/code-analysis/SKILL.md
    - agent-server/templates/auditor/.claude/skills/static-analysis/SKILL.md
    - agent-server/templates/clipper/.claude/skills/video-processing/SKILL.md
    - agent-server/templates/clipper/.claude/skills/content-analysis/SKILL.md
  modified:
    - agent-server/container/Dockerfile

key-decisions:
  - "Three-tier skill pattern: container/skills/ (shared), templates/{type}/.claude/skills/ (per-type), workspace/.claude/skills/ (runtime-learned)"
  - "Dockerfile COPY skills/ /app/skills/ bakes Tier 1 skills into every agent container image at build time"
  - "Tier 2 skills placed in .claude/skills/ within each template dir so Claude Code loads them automatically via CLAUDE_DIR convention"

patterns-established:
  - "Skill file format: YAML frontmatter with name/description/version/tier/(agent_types) + markdown body"
  - "Tier 1 skills use tier: 1 in frontmatter; Tier 2 add agent_types: [type] array"
  - "All skills include When to use, How to use/Workflow, and Best practices/Never do sections"

requirements-completed: [SKILL-01, SKILL-02, SKILL-03, SKILL-04]

# Metrics
duration: 3min
completed: 2026-03-22
---

# Phase 12 Plan 02: Agent Skills File System Summary

**Three-tier SKILL.md system: 3 shared container skills (filecoin, onchain-data, wallet) + 8 type-specific template skills across 5 agent types (filmmaker, coder, trader, auditor, clipper)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-22T11:59:46Z
- **Completed:** 2026-03-22T12:02:35Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Created 3 Tier 1 shared skills baked into every agent container (filecoin-storage, onchain-data, wallet)
- Created 8 Tier 2 template skills mounted per agent type at container startup
- Added Dockerfile COPY instruction to include skills/ at /app/skills/ during image build
- Established three-tier skill pattern: shared (container) → type-specific (template) → runtime-learned (workspace)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Tier 1 shared skills in container/skills/** - `e58c7d0` (feat)
2. **Task 2: Create Tier 2 template skills per agent type** - `2c2ba80` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `agent-server/container/skills/filecoin-storage/SKILL.md` - Upload/retrieve Filecoin files via Network API
- `agent-server/container/skills/onchain-data/SKILL.md` - Query Base mainnet EVM chain state via viem + credential proxy
- `agent-server/container/skills/wallet/SKILL.md` - Execute on-chain transactions via credential proxy wallet endpoint
- `agent-server/templates/filmmaker/.claude/skills/video-production/SKILL.md` - Storyboard/script/shot-list workflow
- `agent-server/templates/coder/.claude/skills/code-execution/SKILL.md` - Write/run/verify code with Bash tool
- `agent-server/templates/coder/.claude/skills/git-ops/SKILL.md` - Clone/branch/commit/push git operations
- `agent-server/templates/trader/.claude/skills/dex-tools/SKILL.md` - Uniswap V4 swaps on Base with slippage guards
- `agent-server/templates/auditor/.claude/skills/code-analysis/SKILL.md` - Solidity vuln checklist + structured report format
- `agent-server/templates/auditor/.claude/skills/static-analysis/SKILL.md` - Slither/grep static analysis patterns
- `agent-server/templates/clipper/.claude/skills/video-processing/SKILL.md` - Clip timestamp + JSON output format
- `agent-server/templates/clipper/.claude/skills/content-analysis/SKILL.md` - Virality scoring framework (hook/info/emotion/share)
- `agent-server/container/Dockerfile` - Added COPY skills/ /app/skills/ build instruction

## Decisions Made
- Dockerfile modified to COPY skills/ into image at build time — Tier 1 skills always present without volume mounts
- Tier 2 skills placed in `.claude/skills/` subdirectory within each template directory so Claude Code auto-discovers them via its CLAUDE_DIR scanning convention
- Tier 3 (runtime learned) pattern documented in plan comments only — agents write to `/workspace/.claude/skills/` via existing volume mount, no scaffold needed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All skill files in place; agent containers will have shared skills at `/app/skills/` when built
- Tier 2 skills ready to be mounted for type-specific agent containers in Phase 13 agent-runner work
- Skill content can be refined as agents are tested in Phase 13

---
*Phase: 12-agent-templates-skills*
*Completed: 2026-03-22*
