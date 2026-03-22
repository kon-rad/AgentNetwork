---
phase: 12-agent-templates-skills
plan: "03"
subsystem: api, ui
tags: [supabase, next-js, agent-templates, soul-md, nanoclaw, subscription]

# Dependency graph
requires:
  - phase: 12-agent-templates-skills/12-01
    provides: agent_templates table migration and AgentTemplate TypeScript type
  - phase: 11-subscriptions-payments
    provides: subscription POST API at /api/subscriptions/route.ts and subscribe page

provides:
  - GET /api/templates/[type] public endpoint returning template metadata (excludes soul_md)
  - Subscribe page showing template description and skill tags above payment button
  - Subscription POST API fetches soul_md from agent_templates and passes to NanoClaw register-group as claudeMdContent

affects:
  - phase-13 (any phase that builds on subscription or template flows)
  - nanoclaw-vps-deployment (register-group now receives claudeMdContent for CLAUDE.md injection)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Template data fetched lazily in subscribe page after agent load (chained fetches)"
    - "soul_md excluded from public API — server-side only construct"
    - "NanoClaw register-group uses agentId field (not name), claudeMdContent for CLAUDE.md injection"

key-files:
  created:
    - src/app/api/templates/[type]/route.ts
  modified:
    - src/app/subscribe/[agentId]/page.tsx
    - src/app/api/subscriptions/route.ts

key-decisions:
  - "soul_md is intentionally excluded from the GET /api/templates/[type] public endpoint — it is a server-side personality construct only used during subscription provisioning"
  - "NanoClaw register-group body uses agentId field (not name) and drops trigger — webapp channel handler uses @agentId as trigger internally"
  - "Template data loaded lazily in subscribe page: chained fetch after agent data resolves to avoid extra round-trip when no service_type"

patterns-established:
  - "Public template API: expose display_name, description, skill_set, mcp_packages — never soul_md"
  - "Subscription API: fire-and-forget NanoClaw registration with claudeMdContent from agent_templates.soul_md"

requirements-completed: [TMPL-02, TMPL-03]

# Metrics
duration: 3min
completed: 2026-03-22
---

# Phase 12 Plan 03: Agent Templates Subscribe UI + Soul.md Injection Summary

**Public template metadata API added; subscribe page shows description and skill tags; subscription API injects soul_md as CLAUDE.md content into NanoClaw agent group registration**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-22T12:04:34Z
- **Completed:** 2026-03-22T12:06:52Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created GET /api/templates/[type] endpoint that queries agent_templates table and returns template metadata without exposing soul_md
- Enhanced subscribe page to fetch and display template description + skill tags as cyberpunk-styled cyan badge chips above the price block
- Updated subscription POST API to fetch soul_md from agent_templates via service_type lookup and pass it as claudeMdContent to NanoClaw register-group
- Fixed NanoClaw register-group call: uses agentId (not name) and drops trigger field, matching the webapp channel handler signature

## Task Commits

Each task was committed atomically:

1. **Task 1: GET /api/templates/[type] route** - `14f27df` (feat)
2. **Task 2: Subscribe page UI + subscription API Soul.md injection** - `7847ef2` (feat)

**Plan metadata:** (pending docs commit)

## Files Created/Modified
- `src/app/api/templates/[type]/route.ts` - Public GET endpoint for template metadata (agent_type, display_name, description, skill_set, mcp_packages — no soul_md)
- `src/app/subscribe/[agentId]/page.tsx` - Added template state, chained fetch after agent load, cyberpunk skill tag display section above price
- `src/app/api/subscriptions/route.ts` - NanoClaw registration block updated: fetches soul_md from agent_templates, sends claudeMdContent in register-group body, uses agentId field

## Decisions Made
- soul_md excluded from public template API — personality content should not be exposed to browsers; only used server-side during subscription provisioning
- NanoClaw body corrected from `{ name, folder, trigger }` to `{ agentId, folder, claudeMdContent }` — aligning with webapp channel register-group handler expectation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Template browser UI and Soul.md injection complete for Phase 12
- Phase 12 plan 03 is the final plan — Phase 12 is complete
- Agents subscribing will now receive their personality/skill configuration via CLAUDE.md written to their NanoClaw group folder

---
*Phase: 12-agent-templates-skills*
*Completed: 2026-03-22*
