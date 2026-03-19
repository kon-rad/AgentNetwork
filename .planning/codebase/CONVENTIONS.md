# Coding Conventions

**Analysis Date:** 2026-03-20

## Naming Patterns

**Files:**
- React components (`.tsx`): PascalCase with hyphens for multi-word names
  - Examples: `agent-card.tsx`, `agent-filter.tsx`, `post-card.tsx`
- Pages (Next.js): lowercase with hyphens, brackets for dynamic routes
  - Examples: `page.tsx`, `[id]/page.tsx`, `bounties/page.tsx`
- API routes: lowercase with hyphens
  - Examples: `route.ts`, `[id]/claim/route.ts`
- Utilities and libraries: camelCase
  - Examples: `db.ts`, `seed.ts`, `types.ts`
- Configuration files: kebab-case or standard format
  - Examples: `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`

**Functions:**
- Async handler functions: descriptive names following verb-noun pattern
  - Examples: `fetchAgents()`, `getDb()`, `initSchema()`
- Component functions: PascalCase (React components)
  - Examples: `AgentCard`, `AgentFilter`, `Navbar`
- Event handlers: `on[Action]` pattern
  - Examples: `onTypeChange()`, `onSearchChange()`, `onClick()`

**Variables:**
- State variables: camelCase
  - Examples: `agents`, `activeType`, `loading`, `seeded`, `bounty`
- Constants: UPPER_SNAKE_CASE for exported module-level constants
  - Examples: `SERVICE_COLORS`, `STATUS_STYLES`, `NAV_ITEMS`, `DATA_DIR`
- Database parameters: snake_case (matching database column names)
  - Examples: `follower_id`, `following_id`, `creator_id`, `display_name`
- Type/Interface parameters: camelCase
  - Examples: `agent`, `post`, `bounty`, `req`, `res`

**Types:**
- Interfaces: PascalCase
  - Examples: `Agent`, `Post`, `Follow`, `Bounty`
- Type unions and generics: PascalCase
  - Example: `type ServiceType = (typeof SERVICE_TYPES)[number]`
- Props interfaces: `[ComponentName]Props` or descriptive `Props`
  - Examples: `Props` (anonymous), implicit typing in function params

## Code Style

**Formatting:**
- Formatter: Not configured (relying on developer consistency)
- Indentation: 2 spaces (implicit in code samples)
- Line length: No strict limit observed, but generally stays under 100 characters
- Trailing semicolons: Present in TypeScript, absent in JSX expressions
- Quotes: Double quotes for strings, single quotes in JSX

**Linting:**
- Tool: ESLint with Next.js config
- Config file: `eslint.config.mjs`
- Rules: `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- Suppressions: `// eslint-disable-next-line react-hooks/exhaustive-deps` for intentional dependencies
- Location of config: `/Users/konradgnat/dev/startups/network/eslint.config.mjs`

## Import Organization

**Order:**
1. External library imports (React, Next.js)
2. Relative imports with path aliases (`@/`)
3. Type imports (prefixed with `type`)

**Pattern:**
```typescript
import { useEffect, useState } from "react";
import { NextRequest, NextResponse } from "next/server";
import Link from "next/link";
import { useParams } from "next/navigation";

import { getDb } from "@/lib/db";
import { Navbar } from "@/components/layout/navbar";
import type { Agent, Post } from "@/lib/types";
```

**Path Aliases:**
- `@/*` maps to `./src/*` (configured in `tsconfig.json`)
- Consistently used across the codebase for absolute imports

## Error Handling

**Patterns:**
- API routes: Return `NextResponse.json()` with error object and appropriate HTTP status code
  - Example: `NextResponse.json({ error: "Agent not found" }, { status: 404 })`
  - Status codes used: 201 (created), 400 (bad request), 404 (not found), 409 (conflict), 500 (server error)
- Database operations: Wrapped in try-catch blocks when insert operations may conflict
  - Example: Follows route catches constraint violations and returns 409
- Client-side fetches: `.then((r) => r.json()).then(data => ...)` chaining
  - No error boundaries or catch handlers currently implemented in client components
  - UI shows "Loading..." or "No [items] found" fallback states

**Error Responses:**
- Format: `{ error: "[message]" }` or `{ ok: true }`
- Validation: Pre-request validation on required parameters (e.g., follower_id, following_id)

## Logging

**Framework:** `console` (standard output)

**Patterns:**
- Location: `src/lib/seed.ts`
- Usage: Informational logging during database seeding
- Examples:
  ```typescript
  console.log("Database already seeded, skipping.");
  console.log("Seeding database...");
  console.log(`Seeded ${agentIds.length} agents, ${SEED_POSTS.length} posts, ${SEED_BOUNTIES.length} bounties.`);
  ```
- No structured logging, error logging, or log levels implemented
- No logging in API routes or client components

## Comments

**When to Comment:**
- Minimal commenting throughout codebase
- No JSDoc/TSDoc documentation found
- Comments used primarily for:
  - Config file overrides: `// Override default ignores of eslint-config-next`
  - Data structure alignment in seeds: comments align with database schema

**JSDoc/TSDoc:**
- Not used in the codebase
- Type safety relies on TypeScript interfaces and proper typing

## Function Design

**Size:**
- Most functions keep to single responsibility (fetch, render, insert)
- Largest files: ~137 lines (detail pages with full UI), mostly due to JSX
- API route handlers: 12-60 lines typically

**Parameters:**
- Explicit typing for all function parameters
- Async functions marked with `async` keyword
- Next.js route handlers follow standard signature: `(req: NextRequest, options)` or `(req: NextRequest)`
- React components accept typed `Props` interface or spread props

**Return Values:**
- API routes: Always return `NextResponse` objects with `.json()` payload
- Database queries: Return raw database results (objects or arrays)
- React components: Implicitly return JSX/ReactNode
- Utility functions: Return typed values (Database instances, arrays, objects)

## Module Design

**Exports:**
- Named exports used consistently: `export function ComponentName()`, `export async function GET()`, `export interface TypeName`
- Default exports for Next.js pages: `export default function PageName()`
- API routes: Export individual handler functions (`GET`, `POST`, `DELETE`)

**Barrel Files:**
- Not used in current structure
- Imports are direct: `import { AgentCard } from "@/components/agents/agent-card"`

**File Colocation:**
- Separate directory structure for components (`src/components/`), pages (`src/app/`), and utilities (`src/lib/`)
- Database, seed, and types in `src/lib/` as utilities
- No component tests co-located with components (no tests found)

---

*Convention analysis: 2026-03-20*
