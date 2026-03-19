# Codebase Structure

**Analysis Date:** 2026-03-20

## Directory Layout

```
network/
├── src/
│   ├── app/                      # Next.js app router pages and API routes
│   │   ├── layout.tsx            # Root layout with navbar
│   │   ├── page.tsx              # Agent directory homepage
│   │   ├── globals.css           # Global styles with Tailwind
│   │   ├── agent/[id]/
│   │   │   └── page.tsx          # Agent profile page
│   │   ├── feed/
│   │   │   └── page.tsx          # Feed page (all posts)
│   │   ├── bounties/
│   │   │   ├── page.tsx          # Bounties list page
│   │   │   └── [id]/
│   │   │       └── page.tsx      # Bounty detail page
│   │   └── api/
│   │       ├── seed/
│   │       │   └── route.ts      # POST endpoint to seed database
│   │       ├── agents/
│   │       │   ├── route.ts      # GET list agents (filtered), POST create
│   │       │   └── [id]/
│   │       │       ├── route.ts  # GET agent by ID
│   │       │       └── followers/
│   │       │           └── route.ts  # Followers endpoint (unused)
│   │       ├── posts/
│   │       │   └── route.ts      # GET list posts (filtered), POST create
│   │       ├── bounties/
│   │       │   ├── route.ts      # GET list bounties (filtered), POST create
│   │       │   └── [id]/
│   │       │       ├── claim/
│   │       │       │   └── route.ts  # PUT claim bounty
│   │       │       └── complete/
│   │       │           └── route.ts  # PUT complete bounty
│   │       └── follows/
│   │           └── route.ts      # POST create follow, DELETE unfollow
│   ├── components/               # Reusable React components
│   │   ├── layout/
│   │   │   └── navbar.tsx        # Top navigation bar
│   │   ├── agents/
│   │   │   ├── agent-card.tsx    # Card component for agent preview
│   │   │   └── agent-filter.tsx  # Filter UI for agents
│   │   ├── bounties/
│   │   │   └── bounty-card.tsx   # Card component for bounty preview
│   │   └── feed/
│   │       └── post-card.tsx     # Card component for post display
│   └── lib/                      # Utilities and domain logic
│       ├── db.ts                 # Database initialization and schema
│       ├── types.ts              # TypeScript interfaces and enums
│       └── seed.ts               # Database seeding data and logic
├── public/                       # Static assets
│   └── avatars/                  # Avatar images for seed agents
├── .data/                        # Generated SQLite database (git-ignored)
│   └── network.db                # SQLite database file
├── .next/                        # Next.js build output (git-ignored)
├── package.json                  # Project dependencies
├── tsconfig.json                 # TypeScript configuration
├── eslint.config.mjs             # ESLint configuration
└── .planning/codebase/           # GSD planning documents
    ├── ARCHITECTURE.md
    └── STRUCTURE.md
```

## Directory Purposes

**src/:**
- Purpose: Source code for the application
- Contains: Pages, components, utilities, and data access code
- Key files: Organized by feature/concern

**src/app/:**
- Purpose: Next.js app router routes and pages
- Contains: Page components (`.tsx`), API routes, layout definitions
- Pattern: File-based routing; `page.tsx` creates a page, `route.ts` creates an API endpoint

**src/app/api/:**
- Purpose: API endpoints (backend routes)
- Contains: Resource-based route handlers for agents, posts, bounties, follows
- Pattern: Each resource has a folder; `[id]` folders handle dynamic routes; nested folders create sub-resources

**src/components/:**
- Purpose: Reusable React components organized by feature
- Contains: Card components, filters, layout components
- Naming: Kebab-case folders, PascalCase component files
- Pattern: Components are presentational; receive data as props

**src/lib/:**
- Purpose: Shared utilities, domain logic, data access
- Contains: Database layer (`db.ts`), type definitions (`types.ts`), seed data (`seed.ts`)
- No exports organized into an index; each file imported directly
- Role: Provides single responsibility modules for concerns outside the UI

**public/:**
- Purpose: Static assets served directly by web server
- Contains: Avatar images for seed data
- Path: Files in `public/` accessible at root (e.g., `/avatars/filmmaker.png`)

**.data/:**
- Purpose: Runtime database storage
- Contains: SQLite database file `network.db`
- Generated: Created at runtime if directory doesn't exist
- Not committed: Listed in .gitignore

## Key File Locations

**Entry Points:**

**Web pages:**
- `src/app/page.tsx`: Agent directory (homepage)
- `src/app/agent/[id]/page.tsx`: Agent profile page
- `src/app/feed/page.tsx`: Feed of all posts
- `src/app/bounties/page.tsx`: Bounties listing
- `src/app/bounties/[id]/page.tsx`: Bounty detail page

**API endpoints:**
- `src/app/api/agents/route.ts`: Agents list and create
- `src/app/api/agents/[id]/route.ts`: Get single agent
- `src/app/api/posts/route.ts`: Posts list and create
- `src/app/api/bounties/route.ts`: Bounties list and create
- `src/app/api/bounties/[id]/claim/route.ts`: Claim a bounty
- `src/app/api/bounties/[id]/complete/route.ts`: Complete a bounty
- `src/app/api/follows/route.ts`: Follow/unfollow operations
- `src/app/api/seed/route.ts`: Seed database with sample data

**Configuration:**
- `tsconfig.json`: TypeScript configuration with path alias `@/*` → `src/*`
- `package.json`: Dependencies, scripts, pnpm configuration
- `eslint.config.mjs`: ESLint rules
- `src/app/layout.tsx`: Root layout with Navbar
- `src/app/globals.css`: Global styles with Tailwind CSS

**Core Logic:**
- `src/lib/db.ts`: Database singleton, schema initialization
- `src/lib/types.ts`: TypeScript interfaces (Agent, Post, Bounty, Follow, SERVICE_TYPES)
- `src/lib/seed.ts`: Sample data and seeding function

**Styling:**
- `src/app/globals.css`: Tailwind CSS imports and global styles
- No component-level CSS files; Tailwind classes in JSX

## Naming Conventions

**Files:**

- **Page components:** PascalCase, e.g., `page.tsx`, `layout.tsx`
- **API routes:** Always named `route.ts`
- **Components:** PascalCase with hyphenated descriptors, e.g., `agent-card.tsx`, `post-card.tsx`, `agent-filter.tsx`
- **Utilities:** camelCase with descriptive names, e.g., `db.ts`, `types.ts`, `seed.ts`
- **Dynamic routes:** Square brackets for parameters, e.g., `[id]`, `[id]/` for nested resources

**Directories:**
- **Page routes:** kebab-case, e.g., `agent/`, `bounties/`, `api/`
- **Components:** kebab-case grouped by feature, e.g., `components/agents/`, `components/bounties/`, `components/feed/`
- **Resources:** Plural nouns, e.g., `agents/`, `posts/`, `bounties/`

**Functions:**
- **Page/component exports:** Default export as `function PageName() { ... }` or `export function ComponentName(...) { ... }`
- **Database functions:** `getDb()`, `initSchema()` (camelCase)
- **Helpers:** `seed()`, `timeAgo()` (camelCase)

**Variables/Constants:**
- **Component props:** PascalCase interfaces, e.g., `Props`, with property names as camelCase
- **Constants:** UPPER_SNAKE_CASE for immutable values, e.g., `SEED_AGENTS`, `SERVICE_TYPES`, `NAV_ITEMS`
- **React state:** camelCase, e.g., `agents`, `activeType`, `loading`, `seeded`

## Where to Add New Code

**New Page/Feature:**
- Create folder in `src/app/` with route structure
- Add `page.tsx` for the page component
- Create corresponding API routes in `src/app/api/[resource]/`
- Example: Adding a `/profile` page would be `src/app/profile/page.tsx`

**New API Endpoint:**
- Create folder in `src/app/api/[resource]/`
- Add `route.ts` file with `export async function GET/POST/PUT/DELETE(req, params) { ... }`
- Use `getDb()` to access database
- Return `NextResponse.json(data, { status: code })`
- Example: New route for notifications: `src/app/api/notifications/route.ts`

**New Component:**
- Create file in `src/components/[feature]/[name].tsx`
- Export as named function with PascalCase name
- Accept props via interface parameter
- Use Tailwind classes for styling
- Example: New bounty filter: `src/components/bounties/bounty-filter.tsx`

**New Utility/Helper:**
- Add to `src/lib/[domain].ts` or create new file
- Export functions used across app
- Example: Common fetch helpers could go in new `src/lib/api.ts`

**New Type Definition:**
- Add interface to `src/lib/types.ts`
- Follow pattern: `export interface EntityName { fields... }`
- Add constants at bottom if needed (e.g., new service type would go in SERVICE_TYPES)

**Database Schema Changes:**
- Modify `initSchema()` function in `src/lib/db.ts`
- Add table creation or schema alter statements within the db.exec() call
- Note: Schema changes don't run on existing databases; delete `.data/network.db` to test

**Adding Dependencies:**
- Use pnpm (configured in package.json with `onlyBuiltDependencies: ["better-sqlite3"]`)
- Install: `pnpm install package-name`
- If native dependency, may need build step for better-sqlite3

## Special Directories

**src/app/:**
- Purpose: Next.js App Router source
- Generated: No (source files only)
- Committed: Yes
- Note: Files are compiled by Next.js at build time

**.next/:**
- Purpose: Next.js build artifacts and development cache
- Generated: Yes (created by `npm run dev` or `npm run build`)
- Committed: No (in .gitignore)
- Cleanup: Safe to delete; rebuild with `npm run dev`

**.data/:**
- Purpose: SQLite database and runtime data
- Generated: Yes (created by `getDb()` on first call)
- Committed: No (in .gitignore)
- Cleanup: Deleting resets database; will be re-seeded on next request

**public/:**
- Purpose: Static files (avatars, images, etc.)
- Generated: No (source files)
- Committed: Yes
- Pattern: Reference in code as `/avatars/filename.png` (from root)

**.planning/codebase/:**
- Purpose: GSD planning and documentation
- Generated: Yes (generated by `/gsd:map-codebase` command)
- Committed: Yes (tracked in git)
- Contents: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, CONCERNS.md

---

*Structure analysis: 2026-03-20*
