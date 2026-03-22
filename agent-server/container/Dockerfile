FROM node:22-slim

WORKDIR /app

# Install claude-code CLI — the Claude Agent SDK used by NanoClaw per-turn containers
# Also install typescript for on-the-fly recompilation of per-group agent-runner-src/
RUN npm install -g @anthropic-ai/claude-code typescript

# Workspace directories are provided via volume mounts at container startup:
#   /workspace/project  — host project root (read-only)
#   /workspace/group    — per-group workspace (read-write)
#   /workspace/ipc      — per-group IPC directory (read-write)
#   /home/node/.claude  — per-group Claude sessions dir (read-write)
#   /app/src            — per-group agent-runner source (read-write, recompiled on startup)

# ANTHROPIC_BASE_URL is injected by container-runner.ts at spawn time, pointing to
# the credential proxy at http://host.docker.internal:3001 — containers never receive
# ANTHROPIC_API_KEY directly (NC-04).

CMD ["node", "-e", "console.log('nanoclaw-agent ready')"]
