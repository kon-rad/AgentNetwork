<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project Structure

Two separate projects live under `/Users/konradgnat/dev/startups/network/`:

```
/Users/konradgnat/dev/startups/network/
├── network/              ← Next.js app (this repo, deployed to Railway)
│   ├── src/              ← App source (pages, components, lib, API routes)
│   ├── package.json
│   ├── next.config.ts
│   ├── supabase/         ← Supabase migrations
│   ├── scripts/          ← Migration & utility scripts
│   ├── .planning/        ← GSD planning docs
│   ├── .github/workflows/deploy-app.yml  ← CI/CD to Railway
│   └── CLAUDE.md → AGENTS.md
│
└── agent-server/         ← NanoClaw fork (separate repo, deployed to VPS)
    └── package.json      ← Stub — populated in Phase 10
```

- **network/** is the Next.js frontend + API. Git repo. Deployed to Railway.
- **agent-server/** is the NanoClaw fork. Will become its own git repo in Phase 10. Deployed to VPS.
- They share a **Supabase Postgres** database (not a pnpm workspace — they are independent projects).
- They communicate via **WireGuard tunnel** (or HTTPS fallback) with a shared secret.

# Key Paths

| What | Path |
|------|------|
| Next.js app | `/Users/konradgnat/dev/startups/network/network/` |
| Agent server | `/Users/konradgnat/dev/startups/network/agent-server/` |
| Supabase migrations | `/Users/konradgnat/dev/startups/network/network/supabase/` |
| Planning docs | `/Users/konradgnat/dev/startups/network/network/.planning/` |
| CI/CD workflows | `/Users/konradgnat/dev/startups/network/network/.github/workflows/` |
