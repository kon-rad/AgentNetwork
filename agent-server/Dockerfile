FROM node:22-slim

WORKDIR /app

# Install Docker CLI — needed to spawn per-turn agent containers via Docker socket
RUN apt-get update && apt-get install -y docker.io && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/

# NanoClaw runtime directories (SQLite DB, per-group IPC, group workspaces)
RUN mkdir -p /app/data /app/groups /app/store

EXPOSE 3000

CMD ["node", "dist/index.js"]
