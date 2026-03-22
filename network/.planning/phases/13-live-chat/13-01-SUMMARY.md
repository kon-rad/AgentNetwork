---
phase: 13-live-chat
plan: "01"
subsystem: database
tags: [chat, migration, types, supabase]
dependency_graph:
  requires: []
  provides: [chat_messages table DDL, ChatMessage interface, AgentStatus type]
  affects: [src/lib/types.ts, supabase/migrations]
tech_stack:
  added: []
  patterns: [SQL migrations with table+column comments, TypeScript interface aligned to DB schema]
key_files:
  created:
    - supabase/migrations/004_chat_messages.sql
  modified:
    - src/lib/types.ts
decisions:
  - "Ownership enforcement is application-layer via requireOwnership(); RLS policies deferred to v3.0 — matches existing subscriptions table pattern"
  - "AgentStatus exported from types.ts (not declared in chat component) to avoid redeclaration across CHAT-04 and beyond"
metrics:
  duration: "~1 minute"
  completed: "2026-03-22"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
---

# Phase 13 Plan 01: Chat Messages DB Schema and Types Summary

chat_messages Supabase table DDL and ChatMessage/AgentStatus TypeScript types ready for message history persistence.

## What Was Built

### chat_messages migration (004_chat_messages.sql)

SQL migration that creates the `chat_messages` table backing live chat history. Columns: `id` (UUID text PK), `agent_id` (FK to agents with cascade delete), `role` (CHECK constraint: 'user' | 'assistant'), `content` (text), `created_at` (timestamptz). Composite index on `(agent_id, created_at ASC)` supports ordered history retrieval. Table and column COMMENT statements follow the pattern established in 002_subscriptions.sql.

### ChatMessage type (src/lib/types.ts)

`ChatMessage` interface mirrors the table schema exactly — enables type-safe reads from Supabase and write payloads in API routes without casting.

`AgentStatus` string union (`'idle' | 'thinking' | 'using tool'`) exported here so downstream components (CHAT-04) import from a single source of truth rather than re-declaring.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | chat_messages Supabase migration | d2a54ff | supabase/migrations/004_chat_messages.sql (created) |
| 2 | ChatMessage TypeScript type | 9780234 | src/lib/types.ts (modified) |

## Verification

- `supabase/migrations/004_chat_messages.sql` contains `CREATE TABLE IF NOT EXISTS chat_messages` — confirmed
- `grep -n "ChatMessage\|AgentStatus" src/lib/types.ts` returns both at lines 123 and 131 — confirmed
- `npx tsc --noEmit` — no errors (clean output)

## Deviations from Plan

None — plan executed exactly as written.

## Next Steps

Apply the migration manually via the Supabase SQL editor before implementing API routes in 13-02:
https://supabase.com/dashboard/project/ghkmhcptwaoibpnjzqea/sql/new
