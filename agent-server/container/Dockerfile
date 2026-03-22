FROM node:22-slim

WORKDIR /app

# Install claude-code CLI — the Claude Agent SDK used by NanoClaw per-turn containers
RUN npm install -g @anthropic-ai/claude-code typescript

# Copy and install agent-runner dependencies
COPY agent-runner/package*.json ./
RUN npm install

# Build the agent-runner TypeScript
COPY agent-runner/tsconfig.json ./
COPY agent-runner/src/ ./src/
RUN npx tsc

# Copy shared skills (Tier 1)
COPY skills/ /app/skills/

# Workspace directories are provided via volume mounts at container startup:
#   /workspace/project  — host project root (read-only)
#   /workspace/group    — per-group workspace (read-write, contains CLAUDE.md)
#   /workspace/ipc      — per-group IPC directory (read-write)
#   /home/node/.claude  — per-group Claude sessions dir (read-write)
#   /app/src            — per-group agent-runner source (read-write)

# ANTHROPIC_BASE_URL is injected by container-runner.ts at spawn time, pointing to
# the credential proxy at http://host.docker.internal:3001 — containers never receive
# ANTHROPIC_API_KEY directly (NC-04).

# Run as non-root user — Claude Code CLI refuses --dangerously-skip-permissions as root
# Use uid 1000 (node) — matches NanoClaw's container-runner mount paths (/home/node/.claude)
RUN mkdir -p /home/node/.claude && \
    chown -R node:node /app /home/node
USER node
ENV HOME=/home/node

CMD ["node", "dist/index.js"]
