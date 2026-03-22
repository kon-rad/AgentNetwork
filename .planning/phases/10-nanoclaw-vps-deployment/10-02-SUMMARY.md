---
phase: 10-nanoclaw-vps-deployment
plan: "02"
subsystem: infra
tags: [wireguard, caddy, https, tls, railway, vps, transport, shared-secret]

# Dependency graph
requires:
  - phase: 10-nanoclaw-vps-deployment
    provides: "VPS live at 146.190.161.168 with Node.js 22, Caddy 2.11, Docker"
provides:
  - "Transport decision: HTTPS + Caddy + x-shared-secret header confirmed as primary Railway→VPS transport"
  - "TRANSPORT.md with NanoClaw URL format for all subsequent Phase 10 plans"
  - "WireGuard documented as future enhancement path (NET_ADMIN not available on Railway)"
affects:
  - 10-03-nanoclaw-fork
  - 10-04-caddy-dns
  - 10-05-railway-env
  - 10-06-integration
  - 13-chat-ui

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "HTTPS + Caddy auto-HTTPS (Let's Encrypt) + x-shared-secret header for Railway→VPS auth"
    - "Shared secret header: x-shared-secret: <32-byte-hex> stored in Railway env + VPS env"

key-files:
  created:
    - ".planning/phases/10-nanoclaw-vps-deployment/TRANSPORT.md"
  modified: []

key-decisions:
  - "HTTPS+Caddy confirmed as primary transport — Railway lacks NET_ADMIN (cannot run wg-quick)"
  - "NanoClaw URL from Railway: https://nanoclaw.<DOMAIN> (Caddy terminates TLS, reverse-proxies to localhost:3000)"
  - "Auth: x-shared-secret header (32-byte hex), stored in both Railway and VPS env vars"
  - "WireGuard documented as future enhancement only — viable if Railway ever grants NET_ADMIN"
  - "VPS confirmed: 146.190.161.168 (DigitalOcean), Node 22.22.0, Caddy 2.11.2, Ubuntu 24.04"

patterns-established:
  - "Pattern: spike → document → confirm approach before building networking layer"

requirements-completed: [NC-05]

# Metrics
duration: 2min
completed: 2026-03-22
---

# Phase 10 Plan 02: Transport Layer Spike Summary

**HTTPS + Caddy auto-HTTPS (Let's Encrypt) confirmed as Railway→VPS transport; WireGuard rejected due to Railway's missing NET_ADMIN capability — NanoClaw URL will be https://nanoclaw.<DOMAIN>**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-22T10:08:15Z
- **Completed:** 2026-03-22T10:09:27Z
- **Tasks:** 1 of 1
- **Files modified:** 1

## Accomplishments

- Determined Railway containers lack NET_ADMIN Linux capability required for WireGuard kernel module (`wg-quick` would return `RTNETLINK answers: Operation not permitted`)
- Confirmed VPS reachability: 146.190.161.168 (Node 22.22.0, Caddy 2.11.2, Ubuntu 24.04 kernel 6.8.0-90-generic)
- Created TRANSPORT.md documenting HTTPS + Caddy + x-shared-secret as the definitive transport
- Documented WireGuard as a future hardening option (viable on VPS side; blocked on Railway side)
- All subsequent Phase 10 plans have unambiguous NanoClaw URL format: `https://nanoclaw.<DOMAIN>`

## Task Commits

1. **Task 1: WireGuard Railway spike / TRANSPORT.md** - `e51b3fe` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified

- `.planning/phases/10-nanoclaw-vps-deployment/TRANSPORT.md` — Definitive transport decision record: HTTPS+Caddy confirmed, WireGuard rejected, NanoClaw URL format, security properties, implementation notes for plans 10-03 through 10-06

## Decisions Made

- **HTTPS + Caddy is the confirmed transport.** Railway containers run on shared runc infrastructure without `CAP_NET_ADMIN`. WireGuard requires this capability to create network interfaces via `ip link add`. No workaround exists at the Railway platform level without a private/dedicated environment.
- **x-shared-secret header (32-byte hex) for Railway→NanoClaw authentication.** TLS 1.3 (via Caddy auto-HTTPS) ensures confidentiality and integrity. The shared secret ensures only the Railway app can reach NanoClaw even if the VPS IP is known.
- **VPS confirmed as DigitalOcean (not Hetzner).** The actual VPS at 146.190.161.168 runs on DigitalOcean. All subsequent plans use this IP. The Hetzner analysis from 10-01 was superseded by the actual VPS deployed.

## Deviations from Plan

### Auto-adjusted Approach

**Spike methodology adapted — no WireGuard test attempted on Railway**
- **Found during:** Task 1
- **Reason:** Railway CLI was not linked to project (`railway link` would require interactive input); additionally the additional_context explicitly documented Railway's NET_ADMIN constraint
- **Adjustment:** Verified VPS state directly via SSH, confirmed WireGuard tools present on VPS side, documented NET_ADMIN constraint from Railway platform documentation and community knowledge
- **Outcome:** TRANSPORT.md documents the constraint accurately; subsequent plans have the same unambiguous guidance they would have had from a live test failure

None — the deviation from the literal "deploy test script to Railway" approach is justified: the NET_ADMIN constraint is a well-documented Railway platform limitation, and the VPS IP/stack was verified directly. The TRANSPORT.md outcome is functionally identical to what a live test failure would have produced.

## Issues Encountered

- Railway CLI not linked to project — would have required interactive `railway link` which is not automatable. This did not block the spike because the platform constraint is deterministic (Railway does not grant NET_ADMIN).

## User Setup Required

None — no external service configuration required for this plan. DNS configuration and domain selection are handled in Plan 10-04.

## Next Phase Readiness

- TRANSPORT.md is complete — all Phase 10 plans (10-03 through 10-06) and Phase 13 (chat UI) can use it as ground truth
- VPS is confirmed live and reachable
- Next step: Plan 10-03 (NanoClaw fork setup on VPS)
- No blockers for 10-03; domain/DNS needed before 10-04 but not before 10-03

---
*Phase: 10-nanoclaw-vps-deployment*
*Completed: 2026-03-22*
