# Phase 10: NanoClaw VPS Deployment - Research

**Researched:** 2026-03-22
**Domain:** VPS infrastructure, NanoClaw fork, Docker orchestration, WireGuard/HTTPS tunnel, CI/CD via SSH
**Confidence:** MEDIUM — VPS pricing HIGH from official sources; NanoClaw channel API MEDIUM from DeepWiki+GitHub; Railway UDP status MEDIUM (conflicting signals, verify first)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| NC-01 | NanoClaw forked with all messaging channels disabled; only webapp HTTP channel active | Channel barrel-import pattern documented; fork steps defined |
| NC-02 | Custom webapp HTTP channel accepts messages from Next.js and streams responses via SSE | Channel interface (6 methods) documented; Express HTTP server pattern confirmed |
| NC-03 | NanoClaw deployed on VPS with Docker and nanoclaw-agent Docker image | VPS options compared; Docker install commands documented; systemd pattern confirmed |
| NC-04 | Credential proxy shares single Claude subscription across all agent containers | Proxy architecture confirmed (src/credential-proxy.ts, port 3001); injection pattern documented |
| NC-05 | WireGuard tunnel encrypts all traffic between Railway and VPS | WireGuard outbound UDP on Railway confirmed possible; but NET_ADMIN cap likely blocked — primary path is HTTPS+Caddy |
| NC-06 | Shared secret header authenticates requests from Next.js to NanoClaw | Standard HTTP header pattern; no library needed |
| NC-07 | NanoClaw can register new agent groups programmatically when subscription purchased | Group registration via SQLite insert or MCP tool `mcp__nanoclaw__register_group` documented |
| CICD-03 | GitHub Actions deploys agent-server/ changes to VPS via SSH | appleboy/ssh-action v1.2.5 confirmed; path filtering pattern documented |
| CICD-04 | Agent container image rebuilds update skills/MCP without restarting NanoClaw host process | docker build + compose up --force-recreate pattern; host process untouched |

</phase_requirements>

---

## Summary

Phase 10 deploys a forked NanoClaw instance to a VPS, establishes secure communication from Railway (Next.js) to the VPS (NanoClaw), and proves the full message round-trip with a curl test. There are three distinct work streams: (1) VPS provisioning and Docker setup, (2) NanoClaw fork with webapp channel, and (3) CI/CD pipeline for automated deploys.

The most critical decision is the **Railway-to-VPS transport**: WireGuard (UDP) is documented as supported for *outbound* connections from Railway, but Railway containers are managed PaaS environments that likely do not grant `NET_ADMIN` capability required for the WireGuard kernel interface. This must be verified as the very first task. The HTTPS+Caddy alternative is simpler, equally secure with a shared secret, and should be treated as the primary implementation path unless WireGuard is confirmed viable. The STATE.md already notes this concern.

The NanoClaw fork requires two focused changes: (a) strip all upstream channels from the barrel import (`src/channels/index.ts`), and (b) add a custom `webapp` channel that opens an Express HTTP server, writes incoming messages to NanoClaw's SQLite, and streams agent turn results back via SSE. The channel interface is well-defined (6 required methods). The credential proxy (`src/credential-proxy.ts`) and container runner are used as-is from upstream.

**Primary recommendation:** Provision a Hetzner CPX22 ($7.59/month, US Ashburn) or DigitalOcean Basic 4GB ($24/month, existing account), implement HTTPS+Caddy as the primary transport (shared secret header for auth), and add WireGuard as an optional hardening layer only after core functionality is proven.

---

## VPS Provider Comparison

All providers support Docker and WireGuard (WireGuard is a Linux kernel feature available on any Ubuntu 22.04+ VPS).

| Provider | Plan | vCPU | RAM | Disk | Price/mo | US Location | Notes |
|----------|------|------|-----|------|----------|-------------|-------|
| **Hetzner** | CPX22 | 2 (AMD) | 4 GB | 80 GB | **$7.59** | Ashburn VA, Hillsboro OR | Best value; US bandwidth limited to 1-8 TB vs 20 TB EU; price rises to ~$8.49 after Apr 1 2026 |
| **Hetzner** | CX23 | 2 (shared) | 4 GB | 40 GB | **$4.09** | EU only (no US) | Cheapest but EU-only; latency from Railway US to EU ~100ms |
| **DigitalOcean** | Basic 2vCPU | 2 | 4 GB | 80 GB | **$24.00** | NYC, SFO, others | Existing account is an advantage; most mature platform; $24 is 3x Hetzner |
| **Vultr** | Cloud Compute | 2 | 4 GB | 25 GB | **$24.00** | Multiple US | Same price as DO; no advantage |
| **Linode/Akamai** | Shared 4GB | 2 | 4 GB | 80 GB | **$24.00** | Multiple US | 1 TB outbound bandwidth included; same price tier |
| **OVH** | VPS 4GB | 2 | 4 GB | 40 GB | **~$10-12** | US-East | OVH pricing opaque; website timed out; not recommended without pricing confirmation |

**Recommendation:** Use **Hetzner CPX22 in Ashburn VA** ($7.59/month before April 2026 price increase, ~$8.49 after). Ashburn is on the East Coast — Railway's US East regions have low latency to Ashburn. If the user prefers to stay on DigitalOcean (existing account, familiar dashboard), the Basic 4GB droplet at $24/month is fully viable. Both providers support Docker natively (install from apt) and WireGuard (kernel built-in on Ubuntu 22.04+).

**Confidence:** MEDIUM — Hetzner CPX22 US price ($7.59) verified from costgoat.com pricing calculator (March 2026); DigitalOcean $24 verified from official pricing page.

### Hetzner Gotchas

- US locations (Ashburn, Hillsboro) have significantly reduced bandwidth vs EU (1-8 TB vs 20 TB)
- CX23 (the $4 plan) is EU-only — not available in US
- Price adjustment effective April 1, 2026 raises all CPX plans ~$2/mo
- Account requires credit card verification; no trial tier

### DigitalOcean Advantage

- User already has an account — zero onboarding friction
- $5 Basic droplets exist (1GB RAM) but are insufficient for 10-15 concurrent containers
- Managed Docker Droplets or Docker 1-click Apps available
- Billing already set up

---

## Standard Stack

### Core (VPS / Infrastructure)

| Technology | Version | Purpose | Why Standard |
|------------|---------|---------|--------------|
| Ubuntu | 22.04 LTS or 24.04 LTS | VPS OS | LTS support until 2027/2029; WireGuard built-in; Docker officially supported |
| Docker Engine | 27.x (latest stable) | Container runtime for NanoClaw | Official Docker apt repo; required by NanoClaw architecture |
| Docker Compose Plugin | v2.x | Orchestrate NanoClaw + Caddy | Part of docker-ce install; no separate compose v1 needed |
| Node.js | 20 LTS or 22 LTS | Run NanoClaw host process | NanoClaw requires Node.js 20+; use NodeSource repo for latest |
| Caddy | 2.x | HTTPS reverse proxy with auto TLS | Zero-config Let's Encrypt; single binary; handles cert renewal |
| WireGuard | kernel built-in | Optional VPN tunnel | Linux 5.6+ built-in; only viable if Railway grants NET_ADMIN |

### Core (NanoClaw Fork)

| Technology | Version | Purpose | Why Standard |
|------------|---------|---------|--------------|
| NanoClaw upstream | main branch | Base agent orchestrator | ~12 files; container-runner, credential-proxy, group-queue, IPC — all used as-is |
| Express | ^5.1.0 | HTTP server for webapp channel | Minimal addition to fork; fits NanoClaw philosophy |
| TypeScript | 5.x | Fork language | Already in NanoClaw |
| SQLite (better-sqlite3) | ^9.x | NanoClaw internal state | Already in NanoClaw; messages, groups, sessions |
| @supabase/supabase-js | ^2.99.3 | Write agent_events from VPS | Shared DB with Next.js; service role key injected via credential proxy config |

### CI/CD

| Technology | Version | Purpose | Why Standard |
|------------|---------|---------|--------------|
| appleboy/ssh-action | v1.2.5 | SSH deploy to VPS from GitHub Actions | 130K+ repos; latest stable Jan 2026 |
| GitHub Actions path filters | N/A | Only build on agent-server/ changes | Prevents unnecessary deploys |

### Supporting (HTTPS Fallback)

| Technology | Version | Purpose | When to Use |
|------------|---------|---------|-------------|
| Caddy | 2.x | TLS termination + reverse proxy | Primary transport when WireGuard not viable on Railway |
| systemd | built-in | NanoClaw host process management | Auto-restart on crash; start on boot |

**Installation (on VPS):**
```bash
# Docker (official repo)
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
apt update && apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Node.js 20 (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# WireGuard tools (kernel module built-in on Ubuntu 22.04+)
apt install -y wireguard-tools

# Caddy
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy
```

**Installation (in agent-server/):**
```bash
# After cloning NanoClaw and setting up fork
pnpm add express
pnpm add -D @types/express
pnpm add @supabase/supabase-js
```

---

## Architecture Patterns

### Recommended Project Structure

```
agent-server/                     # NanoClaw fork root (becomes its own git repo)
├── container/
│   └── Dockerfile                # nanoclaw-agent:latest — Node.js 22 slim + Claude SDK
├── src/
│   ├── channels/
│   │   ├── index.ts              # barrel — ONLY imports webapp channel (all others removed)
│   │   ├── registry.ts           # registerChannel() + getRegisteredChannelNames() — upstream
│   │   └── webapp/
│   │       └── index.ts          # NEW: Express HTTP server, self-registers as 'webapp'
│   ├── index.ts                  # upstream orchestrator — minimal changes
│   ├── db.ts                     # upstream SQLite (messages, registered_groups, sessions)
│   ├── container-runner.ts       # upstream — spawns per-turn Docker containers
│   ├── credential-proxy.ts       # upstream — MITM at :3001, injects ANTHROPIC_API_KEY
│   ├── group-queue.ts            # upstream — concurrency limiter (max 5 containers)
│   ├── ipc.ts                    # upstream — file-based host-container communication
│   ├── router.ts                 # upstream — message formatting, outbound routing
│   ├── task-scheduler.ts         # upstream — cron/interval/once job runner
│   ├── mount-security.ts         # upstream — validates container volume allowlist
│   ├── types.ts                  # upstream — Channel interface, ChannelFactory, etc.
│   ├── config.ts                 # upstream + WEBAPP_PORT, WEBAPP_SHARED_SECRET additions
│   └── supabase-logger.ts        # NEW: writes agent_events to Supabase after each turn
├── package.json
├── tsconfig.json
├── Dockerfile                    # NanoClaw host process (for docker compose)
├── docker-compose.yml            # NanoClaw + Caddy services
└── .env.example                  # ANTHROPIC_API_KEY, WEBAPP_PORT, WEBAPP_SHARED_SECRET, etc.
```

### Pattern 1: NanoClaw Fork — Stripping Channels

**What:** NanoClaw's channel discovery is barrel-import-driven. Removing a channel is done by deleting its import from `src/channels/index.ts`.

**When to use:** Fork setup — do this before anything else.

```typescript
// src/channels/index.ts — UPSTREAM (has all channels)
import './whatsapp'   // triggers registerChannel('whatsapp', factory)
import './telegram'   // triggers registerChannel('telegram', factory)
import './discord'    // triggers registerChannel('discord', factory)
import './slack'      // triggers registerChannel('slack', factory)
import './gmail'      // triggers registerChannel('gmail', factory)

// src/channels/index.ts — OUR FORK (webapp only)
import './webapp'     // only this line — webapp channel self-registers
```

### Pattern 2: Webapp Channel Interface

**What:** The webapp channel implements NanoClaw's `Channel` interface and starts an Express HTTP server.

**When to use:** This is the core NC-01 + NC-02 deliverable.

```typescript
// src/channels/webapp/index.ts
import express from 'express'
import { registerChannel } from '../registry'
import type { Channel, ChannelOpts } from '../../types'

registerChannel('webapp', (opts: ChannelOpts): Channel | null => {
  if (!process.env.WEBAPP_PORT) return null  // skip if not configured

  const app = express()
  app.use(express.json())

  // Shared secret auth middleware
  app.use((req, res, next) => {
    const secret = req.headers['x-shared-secret']
    if (secret !== process.env.WEBAPP_SHARED_SECRET) {
      return res.status(401).json({ error: 'unauthorized' })
    }
    next()
  })

  // Receive message from Next.js; write to NanoClaw SQLite
  app.post('/message', async (req, res) => {
    const { agentId, message, sessionToken } = req.body
    const jid = `${agentId}@webapp`
    // 1. Store message via opts.onMessage callback (triggers NanoClaw pipeline)
    opts.onMessage({ jid, text: message, sender: sessionToken, senderName: 'user' })
    res.json({ queued: true })
  })

  // SSE stream — browser polls for agent response
  app.get('/stream/:agentId', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    // TODO: hook into IPC result; send SSE data events
  })

  app.listen(parseInt(process.env.WEBAPP_PORT!))

  return {
    name: 'webapp',
    connect: async () => {},
    sendMessage: async (jid: string, text: string) => {
      // Route agent response back via SSE — implementation needed
    },
    isConnected: () => true,
    ownsJid: (jid: string) => jid.endsWith('@webapp'),
    disconnect: async () => {},
  }
})
```

**Note:** The `sendMessage()` implementation (routing agent response to the waiting SSE client) is the most complex part of NC-02. The agent turn result comes back via IPC file system, not directly. The webapp channel must watch IPC for the response and pipe it to the open SSE response. See Pattern 4 for IPC details.

### Pattern 3: HTTPS+Caddy Transport (Primary Path)

**What:** NanoClaw's Express server listens on localhost; Caddy terminates TLS and reverse-proxies with auto-issued Let's Encrypt certificate. Next.js calls `https://nanoclaw.yourdomain.com/message` with `x-shared-secret` header.

**When to use:** This is the primary approach. WireGuard should only be pursued if NET_ADMIN capability is confirmed available in Railway containers.

```
# /etc/caddy/Caddyfile (on VPS)
nanoclaw.yourdomain.com {
    reverse_proxy localhost:3000  # WEBAPP_PORT
    tls {
        protocols tls1.3
    }
}
```

```yaml
# docker-compose.yml on VPS
services:
  nanoclaw:
    build: .
    restart: always
    ports:
      - "3000:3000"   # webapp channel HTTP (only localhost-accessible)
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - WEBAPP_PORT=3000
      - WEBAPP_SHARED_SECRET=${WEBAPP_SHARED_SECRET}
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
    volumes:
      - ./data:/app/data          # SQLite + group workspaces
      - /var/run/docker.sock:/var/run/docker.sock  # needed to spawn containers
```

**Security:** HTTPS ensures transit encryption; `x-shared-secret` header ensures only Railway can call the endpoint (NC-06). Do not expose port 3000 publicly — Caddy should proxy on 443, or bind 3000 to 127.0.0.1 only.

### Pattern 4: IPC — How Agent Turn Results Flow

**What:** NanoClaw uses file-based IPC between host and container. After a container turn completes, the agent-runner writes JSON to `data/ipc/{folder}/output/`. The host IPC watcher polls for these files and routes responses via the channel's `sendMessage()`.

**When to use:** Critical for implementing `sendMessage()` in the webapp channel to stream responses back.

```
data/
└── ipc/
    └── {group-folder}/
        ├── tasks/       ← host writes task JSON for container
        └── output/      ← container writes result JSON; host polls this
```

The host calls `channel.sendMessage(jid, responseText)` after reading IPC output. The webapp channel's `sendMessage()` must forward this text to the waiting SSE client. This requires keeping a map of `jid → SSE response object`.

### Pattern 5: Programmatic Group Registration (NC-07)

**What:** When a user subscribes and pays, Next.js calls a NanoClaw API endpoint to create a new agent group. NanoClaw inserts a row into `registered_groups` and creates the group's workspace directory.

**How:** Two options exist:
1. **Direct HTTP endpoint** (add `POST /group` to webapp channel) — Next.js POSTs `{ agentId, folder, claudeMdContent }` to NanoClaw
2. **MCP tool** — NanoClaw's `mcp__nanoclaw__register_group` tool can be called from within an agent turn

**Recommended:** Add `POST /register-group` to the webapp channel's Express server (same server as `/message`). This keeps the registration flow synchronous and verifiable.

```typescript
app.post('/register-group', async (req, res) => {
  const { agentId, folder, claudeMdContent } = req.body
  // 1. Insert into registered_groups SQLite table
  // 2. Create data/groups/{folder}/CLAUDE.md with template content
  // 3. Return { success: true, groupId: agentId }
  res.json({ success: true })
})
```

### Pattern 6: GitHub Actions SSH Deploy (CICD-03)

**What:** On push to `main` when `agent-server/**` files change, deploy to VPS via SSH.

```yaml
# .github/workflows/deploy-agent.yml
name: Deploy agent-server to VPS
on:
  push:
    branches: [main]
    paths: ['agent-server/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: appleboy/ssh-action@v1.2.5
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /opt/agent-server
            git pull origin main
            npm install --frozen-lockfile
            docker build -t nanoclaw-agent:latest ./container
            docker compose up -d --force-recreate
            systemctl --user restart nanoclaw  # or: docker compose restart nanoclaw
```

**CICD-04 (no host process restart):** `docker compose up -d --force-recreate` only restarts the NanoClaw host container. The `nanoclaw-agent:latest` image rebuild only affects future container spawns — in-flight containers are unaffected. The host process NanoClaw itself sees the new image on next `docker run` call.

### Anti-Patterns to Avoid

- **Never expose port 3000 publicly without Caddy:** NanoClaw's Express server has no rate limiting or full TLS; always put Caddy in front
- **Never mount Docker socket in container without cgroup limit:** NanoClaw spawns Docker-in-Docker — set `--cpus` and `--memory` limits in container-runner config to prevent runaway containers
- **Never store ANTHROPIC_API_KEY in container env:** The credential proxy pattern exists specifically to prevent this; use `ANTHROPIC_API_KEY=proxy-managed` + proxy injection
- **Never write WEBAPP_SHARED_SECRET to logs:** Treat it like a password; redact in any debug output
- **Don't poll IPC with setInterval in webapp channel:** Use `fs.watch()` or `chokidar` — polling creates latency and CPU waste

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TLS certificate management | Custom cert renewal scripts | Caddy 2.x auto-HTTPS | Caddy handles ACME, renewal, OCSP — 3 lines of Caddyfile |
| Container orchestration | Custom Docker spawn logic | NanoClaw's `container-runner.ts` | Already handles volume mounts, concurrency limits, IPC, mount security |
| Credential injection | Pass API key via env var directly | NanoClaw's `credential-proxy.ts` | Existing MITM proxy at :3001 — containers can't access real key |
| SSH deploy script | Shell scripts with ssh/scp | `appleboy/ssh-action@v1.2.5` | Handles key management, error reporting, multi-host; 130K repos |
| Channel discovery | Manual channel registration | NanoClaw barrel-import pattern | Side-effect registration already implemented in `registry.ts` |
| Agent group workspace | Manual directory creation | NanoClaw's `db.ts` group insert + IPC | Group initialization creates CLAUDE.md and session atomically |

**Key insight:** NanoClaw provides ~12 source files that cover all infrastructure concerns (container spawning, credential isolation, IPC, group management). The only greenfield work is the webapp channel implementation and CI/CD workflow.

---

## Common Pitfalls

### Pitfall 1: Railway Cannot Run WireGuard as a Kernel Client

**What goes wrong:** The plan assumes Railway container can act as a WireGuard peer. Railway containers run on shared infrastructure without `NET_ADMIN` capability. `wg-quick up wg0` fails silently or with a permission error. No encrypted tunnel is established. Falling back to plaintext HTTP between Railway and VPS exposes API calls.

**Why it happens:** WireGuard requires the Linux kernel network interface (`tun` device) and `NET_ADMIN` Linux capability. Managed PaaS platforms (Railway, Render, Fly.io) typically do not grant these to containers. Railway's documentation confirms outbound UDP is supported but does not document `NET_ADMIN` or `SYS_MODULE` capability grants.

**How to avoid:** Treat HTTPS+Caddy as the **primary** path from the start. Phase 10 begins by testing `wg-quick up` in a Railway container as a spike (Task 1). If it fails → proceed with HTTPS. The shared secret header provides authentication; HTTPS provides encryption. This satisfies NC-05's security intent even without WireGuard.

**Warning signs:** `wg-quick up wg0` returns "Operation not permitted" or "RTNETLINK answers: Operation not permitted" in Railway container logs.

**Confidence:** MEDIUM — Railway employee confirms outbound UDP works, but `NET_ADMIN` capability is unconfirmed. BoringTun (userspace WireGuard) theoretically only needs `NET_ADMIN` not `SYS_MODULE`, but Railway's capability grants are undocumented.

### Pitfall 2: Docker Socket Mount Breaks on Some VPS Providers

**What goes wrong:** NanoClaw mounts `/var/run/docker.sock` to spawn agent containers. On some VPS providers running containerd-based infrastructure (rare but possible), the Docker socket path differs or requires explicit permissions.

**Why it happens:** Standard Docker installation creates the socket at `/var/run/docker.sock` owned by root:docker. If the NanoClaw user isn't in the docker group, container spawning silently fails.

**How to avoid:** Add the VPS deploy user to the `docker` group: `usermod -aG docker $USER`. Verify socket access with `docker ps` as the deploy user before running NanoClaw.

**Warning signs:** NanoClaw starts but no containers are spawned on message receipt; logs show "permission denied while trying to connect to the Docker daemon socket".

### Pitfall 3: NanoClaw's 2-Second Poll Loop Creates Noticeable Chat Latency

**What goes wrong:** NanoClaw polls SQLite every 2 seconds for new messages. After Next.js writes a message via the webapp channel, the user waits up to 2 seconds before the container even starts. Add container startup (~2-3s) and the Claude API call (~2-5s) and the first response can take 6-10 seconds.

**Why it happens:** NanoClaw was designed for async messaging platforms (WhatsApp, Telegram) where 2-second latency is acceptable. Synchronous chat UI expects near-instant response starts.

**How to avoid:** For Phase 10, this only affects the curl proof-of-concept test — not the actual chat UI (that's Phase 13). However, the STACK.md documents this as a known issue: "spike before building chat UI in Phase 13." Optionally, reduce `POLL_INTERVAL` in `src/config.ts` from 2000ms to 500ms for Phase 10 testing.

**Warning signs:** SSE response doesn't start for 4-6 seconds after curl is sent; test feels unresponsive.

### Pitfall 4: SSE Response Stream Closed Before Agent Finishes

**What goes wrong:** The Express SSE endpoint (`/stream/:agentId`) holds an open HTTP connection. If Caddy has a default timeout (e.g., 30 seconds), it closes the connection mid-stream while the Claude Agent SDK is still running.

**Why it happens:** Reverse proxies default to request timeouts for long-running connections. SSE needs the connection alive for the full agent turn duration (potentially minutes).

**How to avoid:** Configure Caddy with no timeout for the stream endpoint, or increase it to 5 minutes:
```
nanoclaw.yourdomain.com {
    handle /stream/* {
        reverse_proxy localhost:3000 {
            transport http {
                response_header_timeout 300s
                read_timeout 300s
            }
        }
    }
    reverse_proxy localhost:3000
}
```

**Warning signs:** SSE stream cuts off after exactly 30 or 60 seconds; partial agent response arrives then connection drops.

### Pitfall 5: NanoClaw Tries to Write agent_events Before Supabase Is Configured

**What goes wrong:** `supabase-logger.ts` is added to the NanoClaw fork to write observability events. If `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is missing at startup, the entire NanoClaw process may crash or silently fail to log.

**Why it happens:** Supabase client initialization throws or returns null if env vars are absent.

**How to avoid:** Guard the Supabase logger initialization:
```typescript
// src/supabase-logger.ts
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[supabase-logger] Supabase env vars missing — agent_events will not be logged')
  export const logEvent = async () => {}  // no-op
} else {
  // initialize client and export real logEvent
}
```

**Warning signs:** NanoClaw crashes on startup with "supabaseUrl is required"; observability dashboard shows no events.

### Pitfall 6: Agent Containers Cannot Reach credential-proxy on host.docker.internal

**What goes wrong:** NanoClaw containers use `ANTHROPIC_BASE_URL=http://host.docker.internal:3001` to route through the credential proxy. On Linux (unlike macOS/Windows), `host.docker.internal` is NOT automatically available; Docker on Linux requires `--add-host=host.docker.internal:host-gateway` flag on the container run command.

**Why it happens:** Docker Desktop (macOS/Windows) adds `host.docker.internal` DNS automatically. Docker Engine on Linux (which is what a VPS runs) does not.

**How to avoid:** Verify NanoClaw's `container-runner.ts` passes `--add-host=host.docker.internal:host-gateway` in the Docker run command. If not, add it. Alternatively, use the VPS's `docker0` bridge IP (usually `172.17.0.1`) directly as the proxy host.

**Warning signs:** Agent containers start but all Anthropic API calls fail with "connection refused" or "host not found"; credential proxy logs show no requests despite containers running.

---

## Code Examples

### Minimal Webapp Channel Registration

```typescript
// src/channels/index.ts (fork — stripped down)
// All upstream channel imports REMOVED
// Only webapp channel remains:
import './webapp'
```

```typescript
// src/channels/webapp/index.ts
import express from 'express'
import { registerChannel } from '../registry'
import type { Channel, ChannelOpts, IncomingMessage } from '../../types'

// Map of agentJid -> active SSE response object
const sseClients = new Map<string, import('express').Response>()

registerChannel('webapp', (opts: ChannelOpts): Channel | null => {
  const port = parseInt(process.env.WEBAPP_PORT || '3000')
  const secret = process.env.WEBAPP_SHARED_SECRET
  if (!secret) {
    console.warn('[webapp] WEBAPP_SHARED_SECRET not set — channel disabled')
    return null
  }

  const app = express()
  app.use(express.json())

  // Auth middleware
  app.use((req, res, next) => {
    if (req.headers['x-shared-secret'] !== secret) {
      return res.status(401).json({ error: 'unauthorized' })
    }
    next()
  })

  // Next.js sends message here
  app.post('/message', (req, res) => {
    const { agentId, message, senderAddress } = req.body
    const jid = `${agentId}@webapp`
    const incoming: IncomingMessage = {
      jid,
      text: message,
      sender: senderAddress,
      senderName: 'user',
      timestamp: Date.now(),
    }
    opts.onMessage(incoming)  // enters NanoClaw's SQLite + queue pipeline
    res.json({ ok: true })
  })

  // Next.js opens SSE stream here to receive agent response
  app.get('/stream/:agentId', (req, res) => {
    const jid = `${req.params.agentId}@webapp`
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()
    sseClients.set(jid, res)
    req.on('close', () => sseClients.delete(jid))
  })

  // Group registration endpoint (for NC-07)
  app.post('/register-group', (req, res) => {
    const { agentId, folder, claudeMdContent } = req.body
    // Insert into registered_groups, create workspace directory
    // (implementation uses db.ts insertGroup)
    res.json({ ok: true })
  })

  app.listen(port, () => console.log(`[webapp] Listening on :${port}`))

  return {
    name: 'webapp',
    connect: async () => {},
    disconnect: async () => {},
    isConnected: () => true,
    ownsJid: (jid: string) => jid.endsWith('@webapp'),
    sendMessage: async (jid: string, text: string) => {
      // Called by NanoClaw router after agent turn completes
      const client = sseClients.get(jid)
      if (client) {
        client.write(`data: ${JSON.stringify({ text })}\n\n`)
        // Optional: close stream after final message
      }
    },
  }
})
```

### WireGuard VPS Server Config (for optional use)

```ini
# /etc/wireguard/wg0.conf (on VPS — server role)
[Interface]
Address = 10.0.0.1/24
ListenPort = 51820
PrivateKey = <VPS_PRIVATE_KEY>
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE

[Peer]
# Railway container
PublicKey = <RAILWAY_PUBLIC_KEY>
AllowedIPs = 10.0.0.2/32
```

```ini
# Railway container wg client (only viable if NET_ADMIN confirmed available)
[Interface]
Address = 10.0.0.2/24
PrivateKey = <RAILWAY_PRIVATE_KEY>
DNS = 1.1.1.1

[Peer]
PublicKey = <VPS_PUBLIC_KEY>
Endpoint = <VPS_IP>:51820
AllowedIPs = 10.0.0.1/32  # only route VPS traffic through tunnel
PersistentKeepalive = 25
```

### Caddy Config (Primary Transport)

```
# /etc/caddy/Caddyfile on VPS
nanoclaw.yourdomain.com {
    handle /stream/* {
        reverse_proxy localhost:3000 {
            transport http {
                response_header_timeout 5m
                read_timeout 5m
            }
        }
    }
    reverse_proxy localhost:3000
}
```

### GitHub Actions Deploy Workflow

```yaml
# .github/workflows/deploy-agent.yml
name: Deploy agent-server

on:
  push:
    branches: [main]
    paths:
      - 'agent-server/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: appleboy/ssh-action@v1.2.5
        with:
          host: ${{ secrets.VPS_HOST }}
          username: deploy
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            set -e
            cd /opt/agent-server
            git pull origin main
            npm ci --production=false
            npx tsc --noEmit  # type-check before rebuild
            docker build -t nanoclaw-agent:latest ./container
            docker compose up -d --force-recreate nanoclaw
            echo "Deploy complete: $(date)"
```

### Curl Test (Phase 10 Proof of Concept)

```bash
# 1. POST a message to NanoClaw webapp channel
curl -X POST https://nanoclaw.yourdomain.com/message \
  -H "Content-Type: application/json" \
  -H "x-shared-secret: $WEBAPP_SHARED_SECRET" \
  -d '{"agentId":"test-agent-001","message":"Say hello","senderAddress":"0xtest"}'

# 2. Stream the response via SSE
curl -N https://nanoclaw.yourdomain.com/stream/test-agent-001 \
  -H "x-shared-secret: $WEBAPP_SHARED_SECRET"
# Expected: data: {"text":"Hello! I'm your AI agent..."} events
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| OpenVPN for VPN tunnels | WireGuard (kernel native) | 2020 (Linux 5.6) | 25x faster; single config file; built-in on Ubuntu 22.04+ |
| NGINX for TLS termination | Caddy 2 (auto-HTTPS) | 2019+ | Zero-config Let's Encrypt; no certbot cron job needed |
| docker-compose v1 (separate binary) | Docker Compose Plugin v2 (built-in) | 2022 | `docker compose` (no hyphen) is now the standard |
| appleboy/ssh-action v0.x | v1.2.5 | Jan 2026 | Streamlined output handling; Node.js 20 runner |
| NanoClaw personal SSH setup | Docker partner integration | March 2026 | `nanoclaw-agent:latest` image is now officially maintained with Docker |

**Current NanoClaw state (March 2026):**
- NanoClaw launched January 31, 2026; surpassed 20,000 GitHub stars
- March 13, 2026: Docker partnership announced — Docker Sandboxes (MicroVM) now officially supported
- The `nanoclaw-agent:latest` Docker image is maintained by NanoCo
- Container image base: Node.js 22 slim + Chromium + Claude Agent SDK + Bash
- Channel credential proxy uses port 3128 (MITM HTTPS proxy), not 3001 as previously documented in STACK.md — **verify in source before implementing**

---

## Open Questions

1. **Railway NET_ADMIN Capability**
   - What we know: Railway confirms outbound UDP works; WireGuard requires `NET_ADMIN` Linux capability to create a `tun` interface
   - What's unclear: Whether Railway grants `NET_ADMIN` to user containers (most managed PaaS do not)
   - Recommendation: Spike this as Task 1 of Phase 10. Add a Railway Dockerfile that runs `ip link add wg0 type wireguard` and check logs. If "Operation not permitted" → proceed with HTTPS+Caddy. Do NOT block phase progress on this.

2. **Credential Proxy Port — 3001 vs 3128**
   - What we know: DeepWiki says port 3001; docker-sandboxes.md says port 3128 (MITM HTTPS proxy)
   - What's unclear: Whether the proxy was updated in the Docker partnership; which port is canonical
   - Recommendation: Read `src/credential-proxy.ts` in the NanoClaw source on first clone to confirm actual port before writing any configuration.

3. **IPC-to-SSE Bridge Timing**
   - What we know: NanoClaw IPC is file-based; `sendMessage()` in the webapp channel must relay results to the open SSE client
   - What's unclear: Whether NanoClaw's router calls `channel.sendMessage()` with partial tokens (streaming) or only with the complete response
   - Recommendation: Read `src/router.ts` and `src/container-runner.ts` on first clone. If only complete-turn `sendMessage()` calls are made, SSE will deliver the whole response at once (acceptable for Phase 10; streaming can be added in Phase 13).

4. **VPS Provider Final Choice**
   - What we know: Hetzner CPX22 US is ~$7.59/month; DigitalOcean Basic 4GB is $24/month
   - What's unclear: User preference (existing DigitalOcean account vs Hetzner savings)
   - Recommendation: Use DigitalOcean if the user wants to stay on a single account with zero new vendor setup. Use Hetzner if minimizing recurring cost is the priority. Both are equally capable for this workload.

5. **agent-server Git Repository Strategy**
   - What we know: AGENTS.md says agent-server will "become its own git repo in Phase 10"
   - What's unclear: Whether it's a submodule of the main network/ repo, a completely separate repo, or stays in the monorepo
   - Recommendation: Keep as a separate directory in the same monorepo (not a submodule). GitHub Actions path filters (`paths: ['agent-server/**']`) correctly scope the deploy workflow. Submodules add complexity without benefit at this scale.

---

## Sources

### Primary (HIGH confidence)
- [DigitalOcean Droplet Pricing](https://www.digitalocean.com/pricing/droplets) — 4GB Basic at $24/mo confirmed
- [Hetzner costgoat.com calculator](https://costgoat.com/pricing/hetzner) — CPX22 US $7.59/mo, CX23 EU-only $4.09
- [Docker Engine Install Ubuntu](https://docs.docker.com/engine/install/ubuntu/) — apt installation commands
- [NanoClaw GitHub](https://github.com/qwibitai/nanoclaw) — architecture, channel interface, Docker image
- [NanoClaw DeepWiki](https://deepwiki.com/qwibitai/nanoclaw) — SQLite schema, source file list, group registration
- [NanoClaw channel guide](https://zread.ai/qwibitai/nanoclaw/13-adding-a-new-channel-as-a-skill-the-barrel-import-and-branch-workflow) — Channel interface (6 methods), registerChannel() pattern
- [appleboy/ssh-action releases](https://github.com/appleboy/ssh-action/releases) — v1.2.5 confirmed Jan 2026
- [Railway Station UDP thread](https://station.railway.com/feedback/allow-outbound-udp-traffic-0f74101c) — Railway employee confirms outbound UDP supported; inbound UDP not supported

### Secondary (MEDIUM confidence)
- [NanoClaw docker-sandboxes.md](https://github.com/qwibitai/nanoclaw/blob/main/docs/docker-sandboxes.md) — credential proxy via MITM port 3128, container env vars
- [NanoClaw DeepWiki installation](https://deepwiki.com/qwibitai/nanoclaw/2.1-installation-and-setup) — systemd service pattern, ANTHROPIC_API_KEY env var
- [NanoClaw VPS deploy guide](https://www.bitdoze.com/nanoclaw-deploy-guide/) — server requirements, systemd unit file example
- [Hetzner price adjustment docs](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/) — April 1 2026 price increase confirmed
- [Caddy reverse proxy docs](https://caddyserver.com/docs/quick-starts/reverse-proxy) — auto-HTTPS, Caddyfile syntax
- [WireGuard quickstart](https://www.wireguard.com/quickstart/) — peer config format, key generation

### Tertiary (LOW confidence — verify before use)
- Railway NET_ADMIN capability: NOT documented; assumed unavailable — verify with spike
- NanoClaw credential proxy port (3001 vs 3128): Conflicting sources — read source directly
- NanoClaw `onMessage` callback signature: Inferred from architecture docs — read `src/types.ts` directly

---

## Metadata

**Confidence breakdown:**
- VPS pricing: HIGH — official pricing pages and pricing calculator verified March 2026
- NanoClaw channel interface: MEDIUM — documented in DeepWiki and zread.ai; verify against source on clone
- Railway UDP/WireGuard: MEDIUM — outbound UDP confirmed by Railway employee; NET_ADMIN status unconfirmed
- Docker/Caddy/systemd patterns: HIGH — official documentation and 2026 guides
- appleboy/ssh-action v1.2.5: HIGH — GitHub releases confirmed

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (30 days for stable infra; Hetzner pricing changes April 1 2026)
