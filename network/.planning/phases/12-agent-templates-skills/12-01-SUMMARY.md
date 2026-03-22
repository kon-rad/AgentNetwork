---
phase: 12-agent-templates-skills
plan: "01"
subsystem: database
tags: [supabase, postgres, sql, migration, agent-templates, soul-md]

# Dependency graph
requires:
  - phase: 11-subscriptions-payments
    provides: subscriptions table and Supabase integration patterns
provides:
  - agent_templates Supabase table with DDL + 5 seed rows
  - AgentTemplate TypeScript type exported from src/lib/types.ts
affects: [12-02, 13-agent-chat, 14-agent-management, container-provisioning]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SQL $$ dollar-quoting for multi-line soul_md text blocks"
    - "INSERT ... ON CONFLICT DO UPDATE for idempotent seed data"

key-files:
  created:
    - supabase/migrations/003_agent_templates.sql
  modified:
    - src/lib/types.ts

key-decisions:
  - "agent_type TEXT PRIMARY KEY (not UUID) — agent type name is the natural key; no surrogate ID needed"
  - "ON CONFLICT DO UPDATE pattern ensures migration is safe to re-run (idempotent seeds)"
  - "mcp_packages left empty (ARRAY[]::TEXT[]) — populated in Phase 13/14 when MCP tools are configured"

patterns-established:
  - "Phase 12: soul_md column holds full CLAUDE.md content written to container at subscription time"
  - "Phase 12: skill_set TEXT[] maps to skill directory names mounted at container start"

requirements-completed: [TMPL-01]

# Metrics
duration: 2min
completed: 2026-03-22
---

# Phase 12 Plan 01: Agent Templates DB + Types Summary

**PostgreSQL agent_templates table with soul_md personality content and skill_set arrays for 5 agent types, plus AgentTemplate TypeScript type**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-22T11:59:32Z
- **Completed:** 2026-03-22T12:01:05Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created `supabase/migrations/003_agent_templates.sql` with DDL + 5 idempotent seed rows
- Soul.md personality content written for filmmaker, coder, trader, auditor, and clipper agent types
- Skill set arrays defined per agent type (e.g., coder gets `code-execution, git-ops, filecoin-storage`)
- `AgentTemplate` TypeScript interface appended to `src/lib/types.ts` matching table schema exactly

## Task Commits

Each task was committed atomically:

1. **Task 1: Create agent_templates migration with seed data** - `006e525` (feat)
2. **Task 2: Add AgentTemplate TypeScript type** - `593120f` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `supabase/migrations/003_agent_templates.sql` - DDL for agent_templates table plus 5 seeded agent type rows with soul_md, skill_set, mcp_packages
- `src/lib/types.ts` - AgentTemplate interface appended (existing types unchanged)

## Decisions Made
- `agent_type TEXT PRIMARY KEY` — natural key; no UUID surrogate needed since agent type names are unique stable identifiers
- `ON CONFLICT DO UPDATE` — migration is safe to re-run; seed data stays current without manual deletes
- `mcp_packages ARRAY[]::TEXT[]` — left empty for now; Phase 13/14 populates with npm package names when MCP tools are wired up

## Deviations from Plan

None - plan executed exactly as written.

## User Setup Required

**Manual SQL migration required.** Apply via the Supabase SQL editor:
- URL: https://supabase.com/dashboard/project/ghkmhcptwaoibpnjzqea/sql/new
- File: `supabase/migrations/003_agent_templates.sql`
- Run the full file contents to create the table and seed the 5 agent type rows.

## Next Phase Readiness
- `agent_templates` table ready for Plan 12-02 (container skill files)
- `AgentTemplate` type available for any UI or API code that reads templates
- Supabase migration must be applied manually before Plan 12-02 or later plans that query `agent_templates`

---
*Phase: 12-agent-templates-skills*
*Completed: 2026-03-22*
