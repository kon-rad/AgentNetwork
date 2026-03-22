# Technology Stack

**Analysis Date:** 2026-03-20

## Languages

**Primary:**
- TypeScript 5.x - All source code in `src/` directory
- JavaScript (ES2017 target) - Configuration files and build scripts

**Secondary:**
- SQL - SQLite database schema and queries in `src/lib/db.ts`
- CSS/Tailwind - Styling via `@tailwindcss/postcss`

## Runtime

**Environment:**
- Node.js (LTS recommended, no explicit version pinned)

**Package Manager:**
- pnpm (configured via `.pnpmrc.json`)
- Lockfile: `pnpm-lock.yaml` (v9.0)

## Frameworks

**Core:**
- Next.js 16.2.0 - Full-stack web framework for React + API routes
  - React 19.2.4 - UI library
  - React DOM 19.2.4 - DOM rendering
  - App Router - File-based routing (pages in `src/app/`)

**Styling:**
- Tailwind CSS 4.x - Utility-first CSS framework
- TailwindCSS PostCSS 4.x - PostCSS plugin for Tailwind

**State Management:**
- Zustand 5.0.12 - Lightweight state management (imported in dependencies but minimal usage visible in current codebase)

**Build/Dev:**
- Next.js build system - Integrated TypeScript compilation and optimization
- PostCSS 4.x - CSS processing pipeline (config: `postcss.config.mjs`)

## Key Dependencies

**Critical:**
- better-sqlite3 12.8.0 - Embedded SQLite database client
  - Used for all persistent data storage
  - Configured with WAL journaling mode and foreign keys enabled
  - Location: `src/lib/db.ts`

- uuid 13.0.0 - UUID generation for entity IDs
  - Used in all POST endpoints for primary key generation
  - Imported from `uuid` package

**Infrastructure:**
- next/font - Google Fonts integration (Geist Sans and Geist Mono imported in `src/app/layout.tsx`)
- next/navigation - Client-side routing utilities (usePathname, useParams, useRouter)

## Type Definitions

**TypeScript Support:**
- @types/node 20.x - Node.js type definitions
- @types/react 19.x - React type definitions
- @types/react-dom 19.x - React DOM type definitions
- @types/uuid 11.0.0 - UUID type definitions
- @types/better-sqlite3 7.6.13 - better-sqlite3 type definitions

## Configuration

**Environment:**
- No explicit environment variables detected in package.json or config files
- `.env*` pattern in `.gitignore` indicates environment variable files exist (not committed)
- Data directory: `.data/` (excluded from git, created at runtime)

**Build:**
- `next.config.ts` - Next.js configuration (minimal, no special settings)
- `tsconfig.json` - TypeScript compiler options:
  - Target: ES2017
  - Module: esnext
  - JSX: react-jsx
  - Path aliases: `@/*` maps to `./src/*`
  - Strict mode enabled
- `eslint.config.mjs` - ESLint configuration with Next.js core web vitals and TypeScript rules
- `postcss.config.mjs` - PostCSS configuration with Tailwind CSS plugin

## Development Dependencies

**Code Quality:**
- ESLint 9.x - JavaScript/TypeScript linting
- eslint-config-next 16.2.0 - Next.js recommended ESLint rules

**Type Checking:**
- TypeScript 5.x - Static type checking and compilation

## Platform Requirements

**Development:**
- Node.js (LTS recommended)
- pnpm package manager
- Modern browser with ES2017+ support

**Production:**
- Node.js runtime (required for Next.js server)
- SQLite database file storage (`.data/network.db`)
- Standard web hosting platform supporting Node.js (Vercel, self-hosted, etc.)

## Build Output

**Development:**
```bash
npm run dev  # Start Next.js development server on port 3000
```

**Production:**
```bash
npm run build  # Creates optimized build in .next/
npm run start  # Runs production server
```

**Linting:**
```bash
npm run lint  # Runs ESLint on source files
```

## Special Configuration

**Database:**
- SQLite with WAL (Write-Ahead Logging) mode
- Foreign key constraints enabled
- Located at `.data/network.db` (created at runtime if missing)

**Package Manager:**
- pnpm configured to treat `better-sqlite3` as a built-only dependency (requires native compilation)
- Node modules resolution: bundler mode

**Font Loading:**
- Google Fonts integration via Next.js font API
- Fonts: Geist (sans-serif) and Geist Mono (monospace)
- Lazy-loaded per Next.js 14+ behavior

---

*Stack analysis: 2026-03-20*
