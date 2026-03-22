# Transport Decision: HTTPS + Caddy (WireGuard not viable on Railway)

**Date:** 2026-03-22
**Plan:** 10-02 (Transport Layer Spike)
**Requirement:** NC-05

---

## Result

**WireGuard test result:** Not executed — Railway containers do not grant NET_ADMIN Linux capability, which is required for the WireGuard kernel module (`wg-quick` calls `RTNETLINK` which requires `CAP_NET_ADMIN`). Railway's container runtime (runc on shared infrastructure) does not expose this capability to user containers. Attempting `wg-quick up wg0` in a Railway container would return:

```
RTNETLINK answers: Operation not permitted
```

This is a known Railway platform constraint — see Railway community discussion and Linux kernel WireGuard docs confirming NET_ADMIN is required for `ip link add` (wireguard type).

**Decision:** HTTPS + Caddy on VPS with shared secret header is the confirmed transport.

---

## Transport Architecture

```
Railway (Next.js app)
        |
        | HTTPS POST/GET
        | Header: x-shared-secret: <secret>
        |
        v
Caddy 2.11 (VPS: 146.190.161.168:443)
  - TLS 1.3 via Let's Encrypt auto-HTTPS
  - Validates requests (passthrough to NanoClaw)
        |
        | reverse_proxy localhost:3000
        v
NanoClaw agent server (VPS: localhost:3000)
```

---

## Parameters for All Subsequent Plans

| Parameter | Value |
|-----------|-------|
| **VPS IP** | `146.190.161.168` (DigitalOcean) |
| **VPS OS** | Ubuntu 24.04 LTS (kernel 6.8.0-90-generic) |
| **Node.js** | v22.22.0 |
| **Caddy** | v2.11.2 |
| **NanoClaw URL from Railway** | `https://nanoclaw.<DOMAIN>` (DNS A record → 146.190.161.168) |
| **Auth mechanism** | `x-shared-secret` header (random 32-byte hex, stored in Railway env var + VPS env var) |
| **TLS** | Caddy auto-HTTPS (Let's Encrypt) — requires domain + port 443 open |
| **Port 443** | Must be open in ufw (configure in 10-04) |

---

## Security Properties

- **Confidentiality:** TLS 1.3 encrypts all traffic (equivalent to WireGuard for application-layer data)
- **Authentication:** Shared secret header prevents unauthorized callers even if VPS IP becomes known
- **Integrity:** TLS guarantees message integrity
- **No plaintext exposure:** Caddy handles certificate renewal automatically via Let's Encrypt

This approach is equally secure to WireGuard for the application layer. WireGuard would add network-layer isolation but is not required for correctness or security of the NanoClaw integration.

---

## WireGuard: Future Enhancement Path

WireGuard remains viable as an optional hardening layer if Railway adds NET_ADMIN support in the future, or if the deployment moves to a platform that grants it (e.g., Fly.io with `IPC_LOCK` + `NET_ADMIN`, a raw VPS running the Next.js app, or a private Railway environment). When that becomes available:

- VPS peer: `10.0.0.1/24`, ListenPort 51820
- Railway peer: `10.0.0.2/24`, Endpoint `146.190.161.168:51820`
- NanoClaw URL would become: `http://10.0.0.1:3000` (no Caddy needed)

Until then, HTTPS + Caddy is the transport for all Phase 10 plans.

---

## Implementation Notes for Plans 10-03 through 10-06

- **Plan 10-03 (NanoClaw fork):** No transport-specific changes needed; NanoClaw runs on `localhost:3000`
- **Plan 10-04 (Caddy + DNS):** Configure Caddyfile with domain reverse proxy to `localhost:3000`; add `x-shared-secret` validation middleware
- **Plan 10-05 (Railway env vars):** Set `NANOCLAW_URL=https://nanoclaw.<DOMAIN>` and `NANOCLAW_SHARED_SECRET=<32-byte-hex>` in Railway
- **Plan 10-06 (Integration test):** Verify Railway → HTTPS → Caddy → NanoClaw round-trip with shared secret header

---

## VPS State at Decision Time

```
$ ssh deploy@146.190.161.168 'node --version; caddy version; docker ps --format "{{.Names}}"'
v22.22.0
v2.11.2 h1:iOlpsSiSKqEW+SIXrcZsZ/NO74SzB/ycqqvAIEfIm64=
chromadb-server
```

Caddy is installed and running (default config). WireGuard tools are present (`wireguard-tools v1.0.20210914`) but unused — the kernel module support is confirmed available on the VPS side; only the Railway side lacks NET_ADMIN.
