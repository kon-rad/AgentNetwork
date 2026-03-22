---
phase: 10-nanoclaw-vps-deployment
plan: "03"
subsystem: infra
tags: [nanoclaw, express, sse, supabase, typescript, agent-server, vps]

# Dependency graph
requires:
  - phase: 10-01
    provides: agent-server/ stub directory and provision-vps.sh
  - phase: 10-02
    provides: HTTPS+Caddy transport decision, shared-secret auth pattern

provides:
  - NanoClaw fork compiled TypeScript project in agent-server/
  - Webapp HTTP channel (POST /message, GET /stream/:agentId, POST /register-group)
  - SSE streaming of agent turn results back to Next.js (NC-02)
  - Shared-secret auth middleware on every request (NC-06)
  - Supabase event logger guarded against missing env vars (NC-03)
  - Group registration with workspace directory creation (NC-07)

affects: [10-04, 10-05, 10-06, 13-nanoclaw-chat-ui]

# Tech tracking
tech-stack:
  added:
    - express@5.1.0 (HTTP server for webapp channel)
    - "@supabase/supabase-js@2.99.3" (event logging)
    - better-sqlite3@11.8.1 (NanoClaw SQLite — upstream dependency)
    - pino@9.6.0 + pino-pretty@13.0.0 (structured logging)
    - cron-parser, yaml, zod (upstream NanoClaw dependencies)
    - tsx@4.19.0 (TypeScript execution for dev)
  patterns:
    - ESM module format ("type":"module") with .js extensions in all imports
    - Channel self-registration barrel pattern (channels/index.ts imports → triggers registerChannel())
    - SSE connection map (Map<jid, Response>) for routing agent responses to waiting clients
    - Guard pattern for optional services (supabase-logger checks env vars, returns no-op if absent)

key-files:
  created:
    - agent-server/src/channels/webapp/index.ts
    - agent-server/src/supabase-logger.ts
    - agent-server/src/channels/index.ts
    - agent-server/tsconfig.json
    - agent-server/.gitignore
    - "agent-server/src/* (19 upstream NanoClaw core files)"
  modified:
    - agent-server/package.json (full deps + ESM type:module)
    - agent-server/src/config.ts (WEBAPP_PORT, WEBAPP_SHARED_SECRET, SUPABASE_URL added)
    - agent-server/.env.example (updated with all new env vars)

key-decisions:
  - "NanoClaw upstream repo: qwibitai/nanoclaw@d768a04 — this is the main NanoClaw project with WhatsApp, Telegram, Slack, Discord channels (all stripped in fork)"
  - "Channel interface has no sendDone() — turn completion signaled inline in sendMessage() by writing done:true then ending SSE stream"
  - "setRegisteredGroup takes full RegisteredGroup object (name, folder, trigger, added_at) — not just a folder string as plan template assumed"
  - "OnInboundMessage callback signature is (chatJid: string, message: NewMessage) — not IncomingMessage type as plan template assumed; NewMessage is the correct upstream type"
  - "ESM module format required (.js extensions in all imports) — upstream uses NodeNext moduleResolution"
  - "Added .gitignore to agent-server/ (was missing) as Rule 2 deviation — required for correct git operation"

patterns-established:
  - "Webapp channel uses jid format: {agentId}@webapp — ownsJid() checks endsWith('@webapp')"
  - "SSE client map keyed by jid; sendMessage() delivers text + done:true then ends stream"
  - "All Express route handlers return early (no next() after res.status()) for Express 5 compatibility"
  - "Credential proxy pattern preserved from upstream — ANTHROPIC_API_KEY never passes through agent code directly"

requirements-completed: [NC-01, NC-02, NC-04, NC-06, NC-07]

# Metrics
duration: 4min
completed: 2026-03-22
---

# Phase 10 Plan 03: NanoClaw Fork Setup Summary

**NanoClaw fork in agent-server/ with Express SSE webapp channel (POST /message, GET /stream/:agentId, POST /register-group) and guarded Supabase event logger; zero TypeScript errors**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-22T10:11:37Z
- **Completed:** 2026-03-22T10:15:44Z
- **Tasks:** 2
- **Files modified:** 27

## Accomplishments

- Cloned NanoClaw upstream (qwibitai/nanoclaw@d768a04) and copied 19 core source files into agent-server/src/, stripping all channel implementations
- Implemented webapp channel with Express 5: POST /message routes messages through NanoClaw pipeline, GET /stream/:agentId delivers SSE responses, POST /register-group creates workspace directories
- x-shared-secret header validation on every request (NC-06); SSE heartbeat every 15s for proxy keep-alive
- Supabase event logger with full guard pattern — missing SUPABASE_URL or key logs a warning and returns no-ops, never crashes agent turns
- pnpm build (tsc) produces zero TypeScript errors across all 21 source files

## Task Commits

1. **Tasks 1 + 2: Bootstrap NanoClaw fork, webapp channel, Supabase logger** - `147159d` (feat)

## Files Created/Modified

- `agent-server/src/channels/webapp/index.ts` — Express HTTP webapp channel (NC-02), 148 lines
- `agent-server/src/supabase-logger.ts` — Supabase agent_events logger, guarded (NC-03)
- `agent-server/src/channels/index.ts` — Barrel importing only webapp channel
- `agent-server/src/config.ts` — Added WEBAPP_PORT, WEBAPP_SHARED_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
- `agent-server/package.json` — Full dependency list with type:module
- `agent-server/tsconfig.json` — NodeNext module resolution (matches upstream)
- `agent-server/.env.example` — Updated with all new env vars
- `agent-server/.gitignore` — Created (was missing)
- `agent-server/src/*.ts` (19 files) — Upstream NanoClaw core (db, container-runner, credential-proxy, ipc, router, task-scheduler, etc.)

## NanoClaw Upstream Details

- **Repo:** https://github.com/qwibitai/nanoclaw
- **Commit:** d768a0484355414f7ce7481db5ee237e18a8a1d6
- **Upstream channels stripped:** Telegram, WhatsApp, Discord, Slack, Gmail (none copied)
- **Upstream files preserved as-is:** All core files except config.ts (WEBAPP_* additions appended)

## Type Adaptations Required

The plan template contained inaccuracies vs actual upstream types:

1. **`OnInboundMessage` signature:** `(chatJid: string, message: NewMessage)` — not `IncomingMessage`. Fixed: webapp channel creates `NewMessage` objects with `id`, `chat_jid`, `sender`, `sender_name`, `content`, `timestamp` fields.
2. **`setRegisteredGroup` signature:** Takes `(jid: string, group: RegisteredGroup)` — not `(jid, folder)`. Fixed: register-group endpoint constructs full `RegisteredGroup` object.
3. **`Channel` interface:** Has no `sendDone()` method. Fixed: turn completion signaled inline in `sendMessage()` by writing `{done:true}` data event then calling `res.end()`.

## Decisions Made

- Used pino logger (upstream pattern) instead of console.log throughout webapp channel
- Workspace directories created under `groups/{folder}` (matches upstream `GROUPS_DIR`) not `data/groups/{folder}`
- `requiresTrigger: false` for webapp agents — webapp agents respond to all messages, no group trigger needed
- Added .gitignore with node_modules/, dist/, .env, data/, groups/, store/

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added .gitignore to agent-server/**
- **Found during:** Task 1 (bootstrap)
- **Issue:** agent-server/ had no .gitignore — node_modules/ and dist/ would have been committed
- **Fix:** Created .gitignore excluding node_modules/, dist/, .env, data/, groups/, store/
- **Files modified:** agent-server/.gitignore
- **Verification:** git status correctly ignores node_modules and dist
- **Committed in:** 147159d (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing critical)
**Impact on plan:** Essential hygiene fix. No scope creep.

## Issues Encountered

- Plan template assumed `IncomingMessage` type and simplified `setRegisteredGroup` signature — both were incorrect vs actual upstream. Adapted implementation to match real types without changing architecture.

## User Setup Required

None — no external service configuration required at this stage. WEBAPP_SHARED_SECRET and SUPABASE_* env vars documented in .env.example; set in 10-05 (Railway env vars plan).

## Next Phase Readiness

- agent-server/ compiles cleanly and is ready for Caddy + DNS configuration (10-04)
- Webapp channel runs on WEBAPP_PORT (default 3000) behind Caddy reverse proxy
- SSE streaming and group registration are fully implemented
- Credential proxy (credential-proxy.ts) preserved as-is from upstream (NC-04)

---
*Phase: 10-nanoclaw-vps-deployment*
*Completed: 2026-03-22*
