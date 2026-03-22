---
phase: 14-observability-dashboard
plan: "01"
subsystem: database
tags: [supabase, realtime, migration, typescript]
dependency_graph:
  requires: [agents table]
  provides: [agent_events table, AgentEvent type]
  affects: [14-03-dashboard-page]
tech_stack:
  added: []
  patterns: [supabase migration SQL, ALTER PUBLICATION for Realtime]
key_files:
  created:
    - supabase/migrations/005_agent_events.sql
  modified:
    - src/lib/types.ts
decisions:
  - "Migration must be applied via Supabase dashboard SQL Editor — not supabase db push (consistent with all prior migrations in this project)"
  - "payload typed as Record<string, unknown> — per-event_type sub-types are NOT in types.ts; dashboard will inline-cast as needed"
metrics:
  duration: "1 min"
  completed: "2026-03-22"
  tasks_completed: 2
  files_changed: 2
---

# Phase 14 Plan 01: Agent Events Table and Type Summary

agent_events Supabase table with Realtime publication and matching AgentEvent TypeScript interface in Next.js types.

## What Was Built

- `supabase/migrations/005_agent_events.sql`: CREATE TABLE agent_events with 5 columns (id, agent_id, event_type, payload, created_at), CHECK constraint on event_type, index on (agent_id, created_at ASC), and ALTER PUBLICATION supabase_realtime ADD TABLE agent_events
- `src/lib/types.ts`: AgentEvent interface appended after AgentStatus — event_type union exactly matches the SQL CHECK constraint values

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | agent_events Supabase migration | 71e6027 | supabase/migrations/005_agent_events.sql |
| 2 | AgentEvent TypeScript type | bb83e3b | src/lib/types.ts |

## Verification

1. 005_agent_events.sql contains CREATE TABLE IF NOT EXISTS agent_events with 5 columns — PASSED
2. ALTER PUBLICATION supabase_realtime ADD TABLE agent_events present — PASSED
3. AgentEvent exported from src/lib/types.ts — PASSED
4. npx tsc --noEmit — 0 errors — PASSED

## Manual Step Required

The migration file is ready but must be applied by the user via the Supabase dashboard SQL Editor:
https://supabase.com/dashboard/project/ghkmhcpnjzqea/sql/new

Open 005_agent_events.sql, paste the full contents into the SQL Editor, and click Run. This is consistent with how all prior migrations (001–004) were applied in this project.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- supabase/migrations/005_agent_events.sql: FOUND
- src/lib/types.ts contains AgentEvent: FOUND
- Commits 71e6027 and bb83e3b: FOUND
