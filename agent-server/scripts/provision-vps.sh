#!/usr/bin/env bash
# provision-vps.sh — Idempotent VPS bootstrap for NanoClaw agent server
#
# Run once as root via:
#   ssh -o StrictHostKeyChecking=no root@VPS_IP 'bash -s' < provision-vps.sh
#
# Installs: Docker Engine 27.x, Docker Compose Plugin, Node.js 20 LTS,
#           Caddy 2.x, WireGuard tools
# Creates:  deploy user with Docker access, /opt/agent-server directory
# Firewall: SSH (22), HTTPS (443), WireGuard (51820/udp) only
#
# Tested against: Ubuntu 22.04 LTS (Hetzner CPX22)
# Idempotent: safe to re-run — all steps check before acting

set -euo pipefail

# ── Colour helpers ────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[provision]${NC} $*"; }
warn() { echo -e "${YELLOW}[provision]${NC} $*"; }

# ── 0. Root check ─────────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  echo "ERROR: This script must be run as root." >&2
  exit 1
fi

ARCH=$(dpkg --print-architecture)
CODENAME=$(lsb_release -cs)

log "Starting NanoClaw VPS provisioning (Ubuntu ${CODENAME} / ${ARCH})"

# ── 1. System update & prerequisites ─────────────────────────────────────────
log "Step 1/9 — Updating apt and installing prerequisites"
apt-get update -qq
apt-get install -y \
  curl \
  gnupg \
  ca-certificates \
  lsb-release \
  git \
  wireguard-tools \
  ufw \
  debian-keyring \
  debian-archive-keyring \
  apt-transport-https

# ── 2. Docker Engine ──────────────────────────────────────────────────────────
log "Step 2/9 — Installing Docker Engine"

if ! command -v docker &>/dev/null; then
  # Add Docker's official GPG key
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  # Add Docker apt repository
  echo "deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu ${CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list

  apt-get update -qq
  apt-get install -y \
    docker-ce \
    docker-ce-cli \
    containerd.io \
    docker-buildx-plugin \
    docker-compose-plugin
else
  warn "Docker already installed — skipping"
fi

# ── 3. Enable and start Docker ────────────────────────────────────────────────
log "Step 3/9 — Enabling Docker service"
systemctl enable docker
systemctl start docker

# ── 4. Node.js 20 LTS ────────────────────────────────────────────────────────
log "Step 4/9 — Installing Node.js 20 LTS"

if ! node --version 2>/dev/null | grep -q '^v20\.'; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
else
  warn "Node.js 20 already installed — skipping"
fi

# ── 5. Caddy ──────────────────────────────────────────────────────────────────
log "Step 5/9 — Installing Caddy"

if ! command -v caddy &>/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y caddy
else
  warn "Caddy already installed — skipping"
fi

# ── 6. Enable and start Caddy ─────────────────────────────────────────────────
log "Step 6/9 — Enabling Caddy service"
systemctl enable caddy
systemctl start caddy

# ── 7. Deploy user ────────────────────────────────────────────────────────────
log "Step 7/9 — Creating deploy user"

if ! id deploy &>/dev/null; then
  useradd -m -s /bin/bash deploy
  log "  Created user: deploy"
else
  warn "  User deploy already exists — skipping useradd"
fi

# Always ensure deploy is in docker group (idempotent)
usermod -aG docker deploy

# Copy root's authorized_keys to deploy if not already present
# (so the same SSH key that reached root can also reach deploy)
DEPLOY_SSH_DIR="/home/deploy/.ssh"
ROOT_AUTH_KEYS="/root/.ssh/authorized_keys"

if [[ -f "${ROOT_AUTH_KEYS}" ]] && [[ ! -f "${DEPLOY_SSH_DIR}/authorized_keys" ]]; then
  mkdir -p "${DEPLOY_SSH_DIR}"
  cp "${ROOT_AUTH_KEYS}" "${DEPLOY_SSH_DIR}/authorized_keys"
  chown -R deploy:deploy "${DEPLOY_SSH_DIR}"
  chmod 700 "${DEPLOY_SSH_DIR}"
  chmod 600 "${DEPLOY_SSH_DIR}/authorized_keys"
  log "  Copied root authorized_keys to deploy user"
elif [[ -f "${DEPLOY_SSH_DIR}/authorized_keys" ]]; then
  warn "  deploy authorized_keys already exists — skipping copy"
else
  warn "  No root authorized_keys found — you must add an SSH key to deploy manually"
fi

# ── 8. /opt/agent-server ──────────────────────────────────────────────────────
log "Step 8/9 — Creating /opt/agent-server"
mkdir -p /opt/agent-server
chown deploy:deploy /opt/agent-server

# ── 9. Firewall (ufw) ────────────────────────────────────────────────────────
log "Step 9/9 — Configuring firewall"

# Allow required ports before enabling (avoid locking ourselves out)
ufw allow 22/tcp    comment 'SSH'
ufw allow 443/tcp   comment 'HTTPS (Caddy)'
ufw allow 51820/udp comment 'WireGuard'

# Default policy: deny inbound, allow outbound
ufw default deny incoming
ufw default allow outgoing

# Enable non-interactively
ufw --force enable

log "Firewall rules applied (SSH + HTTPS + WireGuard)"

# ── Verification ──────────────────────────────────────────────────────────────
echo ""
log "============================================================"
log "Provisioning complete. Verification:"
log "============================================================"

DOCKER_VER=$(docker --version)
NODE_VER=$(node --version)
CADDY_VER=$(caddy version)

log "  Docker:  ${DOCKER_VER}"
log "  Node.js: ${NODE_VER}"
log "  Caddy:   ${CADDY_VER}"

echo ""
log "Next steps:"
log "  1. Create the VPS on Hetzner (CPX22, Ubuntu 22.04, US Ashburn)"
log "  2. Run: ssh -o StrictHostKeyChecking=no root@VPS_IP 'bash -s' < scripts/provision-vps.sh"
log "  3. Verify: ssh deploy@VPS_IP 'docker ps && node --version && caddy version && whoami'"
log "  4. Provide VPS IP to continue Phase 10"
