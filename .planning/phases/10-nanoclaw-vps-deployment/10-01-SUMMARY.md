---
phase: 10-nanoclaw-vps-deployment
plan: "01"
subsystem: infra
tags: [vps, docker, nodejs, caddy, wireguard, hetzner, ubuntu, bash]

# Dependency graph
requires: []
provides:
  - "VPS provider decision: Hetzner CPX22 (Ashburn VA, $7.59/mo)"
  - "Idempotent VPS provisioning script: agent-server/scripts/provision-vps.sh"
affects:
  - 10-nanoclaw-vps-deployment
  - all subsequent Phase 10 plans (NanoClaw fork, CI/CD, tunnel)

# Tech tracking
tech-stack:
  added:
    - "Docker Engine 27.x + Compose plugin (official apt repo)"
    - "Node.js 20 LTS (NodeSource apt repo)"
    - "Caddy 2.x (Cloudsmith apt repo)"
    - "WireGuard tools (kernel built-in on Ubuntu 22.04+)"
    - "ufw firewall"
  patterns:
    - "Idempotent bash provisioning: check before each install step, safe to re-run"
    - "SSH key propagation: copy root authorized_keys to deploy user at provision time"
    - "Firewall-first provisioning: allow ports before ufw --force enable"

key-files:
  created:
    - "agent-server/scripts/provision-vps.sh"
  modified: []

key-decisions:
  - "Chose Hetzner CPX22 (Ashburn VA, $7.59/mo) over DigitalOcean Basic 4GB ($24/mo) — 3x cheaper, same specs"
  - "HTTPS+Caddy as primary Railway-to-VPS transport (WireGuard optional hardening only after core working)"
  - "deploy user receives root's authorized_keys at provision time — no separate SSH key setup required"
  - "ufw allows SSH (22) + HTTPS (443) + WireGuard (51820/udp) only — all other inbound denied"

patterns-established:
  - "Pattern: idempotent bash via 'command -v' and 'id user' checks before installation"
  - "Pattern: colour log() / warn() functions for clear provision output"

requirements-completed: [NC-03]

# Metrics
duration: 15min
completed: 2026-03-22
---

# Phase 10 Plan 01: VPS Provider Selection and Provisioning Script Summary

**Hetzner CPX22 selected (Ashburn VA, $7.59/mo); idempotent Ubuntu 22.04 bootstrap script created installing Docker 27.x, Node.js 20 LTS, Caddy 2.x, ufw firewall, and deploy user with Docker access**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-22T09:10:00Z
- **Completed:** 2026-03-22T09:26:10Z
- **Tasks:** 2 of 2 (script complete; VPS live verification awaits user creating the Hetzner VPS)
- **Files modified:** 1

## Accomplishments

- User selected Hetzner CPX22 in Ashburn VA ($7.59/month, 2 AMD vCPU, 4 GB RAM, 80 GB SSD)
- Created `agent-server/scripts/provision-vps.sh` — 183-line idempotent bash script validated with `bash -n`
- Script installs Docker Engine 27.x (official apt), Node.js 20 LTS (NodeSource), Caddy 2.x (Cloudsmith), WireGuard tools
- Script creates `deploy` user, adds to docker group, copies root's authorized_keys, creates `/opt/agent-server`
- Script configures ufw: SSH (22/tcp), HTTPS (443/tcp), WireGuard (51820/udp) — all other inbound denied

## Task Commits

1. **Task 1: Choose VPS provider** — Checkpoint decision (no commit — user decision)
2. **Task 2: Write VPS provisioning script** — `97ce7ae` (chore, agent-server repo)

## Files Created/Modified

- `/Users/konradgnat/dev/startups/network/agent-server/scripts/provision-vps.sh` — Idempotent VPS bootstrap; run once via `ssh root@VPS_IP 'bash -s' < scripts/provision-vps.sh`

## Decisions Made

- **Hetzner CPX22 chosen** over DigitalOcean Basic 4GB — 3x cheaper ($7.59 vs $24/mo), identical hardware (2 vCPU, 4 GB RAM, 80 GB SSD). Ashburn VA gives low latency to Railway US East.
- **deploy user SSH access** handled by copying root's authorized_keys at provision time — the same key that reaches root will reach deploy without extra key management.
- **ufw enabled with explicit allowlist** before broader hardening — SSH access preserved by allowing 22/tcp before `ufw --force enable`.
- **HTTPS+Caddy as primary transport** (WireGuard optional) — aligns with STATE.md decision and avoids Railway NET_ADMIN uncertainty.

## Deviations from Plan

None — plan executed exactly as written. The "run script against VPS" step in Task 2 is deferred to the human-action checkpoint below because the VPS does not yet exist.

## User Setup Required

**VPS must be created before verification can run.**

Steps:
1. Create Hetzner account at https://www.hetzner.com/cloud
2. Create a new server: **CPX22**, **Ubuntu 22.04 LTS**, **US — Ashburn, VA** location
3. Add your SSH public key during creation (or add it in the Hetzner console)
4. Note the assigned VPS IP address
5. Run the provisioning script:
   ```bash
   ssh -o StrictHostKeyChecking=no root@VPS_IP 'bash -s' \
     < /Users/konradgnat/dev/startups/network/agent-server/scripts/provision-vps.sh
   ```
6. Verify as deploy user:
   ```bash
   ssh deploy@VPS_IP 'docker ps && node --version && caddy version && whoami'
   ```
   Expected: empty docker table, `v20.x.x`, `v2.x.x`, `deploy`
7. Provide the VPS IP address to continue with Phase 10 Plan 02

## Next Phase Readiness

- Provisioning script is complete and syntax-validated
- Once VPS is live and script is run, Phase 10 Plan 02 (NanoClaw fork) can proceed
- Blocker: user must create the Hetzner VPS and share the IP address

---
*Phase: 10-nanoclaw-vps-deployment*
*Completed: 2026-03-22*
