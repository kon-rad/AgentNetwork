---
phase: quick
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/api/templates/route.ts
  - src/app/launch/page.tsx
  - src/components/layout/sidebar.tsx
  - src/components/layout/navbar.tsx
  - src/app/page.tsx
autonomous: true
requirements: [LAUNCH-FLOW]
must_haves:
  truths:
    - "GET /api/templates returns all agent templates from agent_templates table"
    - "User sees /launch page with hero section showing value prop and 100 USDC/month pricing"
    - "User can pick a template, configure agent name/bio/avatar, pay 100 USDC, and launch"
    - "Launch Agent link appears prominently in sidebar nav and navbar"
    - "Directory page has a hero CTA linking to /launch"
  artifacts:
    - path: "src/app/api/templates/route.ts"
      provides: "GET endpoint listing all agent templates"
      exports: ["GET"]
    - path: "src/app/launch/page.tsx"
      provides: "Full launch page with hero + multi-step wizard"
      min_lines: 200
  key_links:
    - from: "src/app/launch/page.tsx"
      to: "/api/templates"
      via: "fetch on mount to load template options"
      pattern: "fetch.*api/templates"
    - from: "src/app/launch/page.tsx"
      to: "/api/agents"
      via: "POST to create agent record"
      pattern: "fetch.*api/agents.*POST"
    - from: "src/app/launch/page.tsx"
      to: "/api/subscriptions"
      via: "POST with tx_hash or free_launch to activate subscription"
      pattern: "fetch.*api/subscriptions.*POST"
---

<objective>
Create the full agent launch flow: a GET /api/templates endpoint, a /launch page with hero section and multi-step creation wizard, prominent "Launch Agent" nav links, and a hero CTA on the directory page.

Purpose: This is the main revenue feature. Users land on the site, see they can launch their own AI agent for 100 USDC/month with full hosting and Claude Code subscription, and walk through a wizard to pick a template, configure, pay, and launch.

Output: Working end-to-end agent launch flow from landing to payment.
</objective>

<execution_context>
@/Users/konradgnat/.claude/get-shit-done/workflows/execute-plan.md
@/Users/konradgnat/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/app/globals.css (design system — use surface/primary/secondary/tertiary tokens, glass-card, hud-bracket, hexagon-clip, corner-tick, animate-fade-in-up patterns)
@src/components/layout/sidebar.tsx (NAV_ITEMS array to extend)
@src/components/layout/navbar.tsx (NAV_ITEMS array to extend)
@src/app/page.tsx (directory page — add hero CTA above existing content)
@src/app/subscribe/[agentId]/page.tsx (reference payment flow — reuse USDC payment state machine, Spinner, wagmi hooks pattern)
@src/app/api/agents/route.ts (POST endpoint for agent creation — wizard calls this)
@src/app/api/subscriptions/route.ts (POST endpoint for subscription — wizard calls this after payment)
@src/app/api/templates/[type]/route.ts (existing single-template API — new list endpoint follows same pattern)
@src/lib/types.ts (AgentTemplate, Agent, SERVICE_TYPES types)
@supabase/migrations/003_agent_templates.sql (agent_templates table schema — agent_type PK, display_name, description, skill_set, mcp_packages)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create GET /api/templates endpoint and /launch page with hero + multi-step wizard</name>
  <files>
    src/app/api/templates/route.ts
    src/app/launch/page.tsx
  </files>
  <action>
**1. GET /api/templates endpoint** (`src/app/api/templates/route.ts`):
- Import `supabaseAdmin` from `@/lib/supabase/admin`
- Query `agent_templates` table: `select('agent_type, display_name, description, skill_set, mcp_packages')` — do NOT expose `soul_md` (server-side only, matching existing `/api/templates/[type]` pattern)
- Return JSON array of all templates
- No auth required (public endpoint)

**2. /launch page** (`src/app/launch/page.tsx`):
- `"use client"` page component
- **Hero Section** at top (always visible):
  - Large headline: "Launch Your AI Agent" with `font-[family-name:var(--font-syne)]` styling, `text-glow-cyan` class
  - Subheadline: "Full hosting. Claude Code subscription included. Your agent trades, creates, posts, and works the marketplace."
  - Pricing callout: "100 USDC/month" styled like subscribe page (large cyan number + USDC label)
  - Feature bullets (4 items): "Dedicated AI with Claude Code", "Trade, create AI art, post content", "Perform services on the marketplace", "Fully customizable personality & skills"
  - Use `glass-card` styling with `hud-bracket-tl/tr/bl/br` corner elements matching subscribe page
  - CTA button scrolls to wizard or starts wizard step 1

- **Multi-step Wizard** below hero, with 4 steps tracked via `useState<number>` (step 1-4):

  **Step 1 — Pick Template:**
  - Fetch `/api/templates` on mount, display as grid of selectable cards (glass-card style)
  - Each card shows: `display_name`, `description`, `skill_set` as tags (matching subscribe page tag style)
  - Badge color per type using existing `badge-{type}` CSS classes
  - Selected card gets `border-cyan-400` highlight
  - Store selected template in state: `useState<AgentTemplate | null>`
  - "Next" button enabled only when template selected

  **Step 2 — Configure Agent:**
  - Form fields: `display_name` (text input, required, 3-50 chars), `bio` (textarea, optional, max 500 chars), `avatar_url` (text input for URL, optional)
  - Inputs styled with dark bg (`bg-slate-900/60`), cyan border on focus, font-mono
  - Show selected template name as context ("Configuring: Filmmaker Agent")
  - Store form values in state
  - "Back" and "Next" buttons; Next disabled if display_name empty or <3 chars

  **Step 3 — Review & Pay:**
  - Summary card showing: template type, agent name, bio preview, pricing
  - Same USDC payment flow as subscribe page: use `useWriteContract`, `useWaitForTransactionReceipt` from wagmi
  - Import `erc20Abi`, `parseUnits` from viem
  - USDC contract: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
  - Amount: `parseUnits("100", 6)`
  - Treasury: `process.env.NEXT_PUBLIC_TREASURY_ADDRESS`
  - Same PaymentState type and state machine as subscribe page (idle, prompting, pending, confirming, launching, error)
  - Also support free launch: if user has a coupon code, show optional "Coupon Code" input field. When coupon provided, skip USDC transfer
  - Wallet connection check: if not connected, show "Connect wallet to continue" message (same pattern as subscribe page)
  - "Back" button returns to step 2

  **Step 4 — Launching (post-payment):**
  - After USDC tx confirmed (or free launch approved):
    1. POST `/api/agents` with `{ display_name, bio, avatar_url, service_type: selectedTemplate.agent_type, wallet_address: connectedAddress }` — requires SIWE session
    2. On success, take returned `agent.id` and POST `/api/subscriptions` with `{ agent_id, tx_hash }` (or `{ agent_id, free_launch: true, coupon_code }` for free path)
    3. Show success state: green checkmark, "Agent Launching!" message, link to `/agent/{agentId}`
  - Handle errors at each step with retry option

- **Step indicator** at top of wizard: numbered circles (1-4) with labels, active step highlighted in cyan, completed steps in green
- Use `animate-fade-in-up` on step transitions
- Font conventions: `font-[family-name:var(--font-syne)]` for headings, `font-mono` for labels/data, match existing HUD aesthetic throughout
  </action>
  <verify>
    - `curl http://localhost:3000/api/templates` returns JSON array of templates with agent_type, display_name, description, skill_set fields (no soul_md)
    - Navigate to `/launch` — hero section renders with pricing and value prop
    - Template cards load and are selectable
    - Wizard steps navigate forward/back correctly
    - `npm run build` succeeds with no TypeScript errors
  </verify>
  <done>
    - GET /api/templates returns all templates without soul_md
    - /launch page shows hero with value prop + 100 USDC/month pricing
    - Multi-step wizard: pick template -> configure name/bio/avatar -> review & pay (USDC or coupon) -> launch success
    - Payment uses same wagmi pattern as subscribe page
    - Agent creation calls POST /api/agents then POST /api/subscriptions
  </done>
</task>

<task type="auto">
  <name>Task 2: Add Launch Agent to navigation and hero CTA to directory page</name>
  <files>
    src/components/layout/sidebar.tsx
    src/components/layout/navbar.tsx
    src/app/page.tsx
  </files>
  <action>
**1. Sidebar** (`src/components/layout/sidebar.tsx`):
- Add "Launch Agent" to NAV_ITEMS array as the FIRST item (most prominent position):
  `{ href: "/launch", label: "LAUNCH AGENT", icon: "rocket_launch" }`
- This puts it above TERMINAL, FEED, MISSIONS in both desktop sidebar and mobile bottom nav
- The `rocket_launch` Material Symbol icon fits the HUD theme

**2. Navbar** (`src/components/layout/navbar.tsx`):
- Add "Launch" to NAV_ITEMS array as the FIRST item:
  `{ href: "/launch", label: "Launch" }`
- This puts it first in the desktop horizontal nav (before Directory, Feed, Bounties)

**3. Directory Page Hero CTA** (`src/app/page.tsx`):
- Add a hero banner section ABOVE the existing "Agent Directory" header (before the `flex justify-between` div)
- Hero banner content:
  - Glass-card styled container with `relative` positioning and hud-bracket corners
  - Headline: "Launch Your Own AI Agent" in `font-[family-name:var(--font-syne)]` bold, uppercase
  - Subtext: "Full hosting + Claude Code included. 100 USDC/month." in `font-mono text-sm text-slate-400`
  - CTA button: Link to `/launch`, styled as primary action button (`bg-[#00f0ff] text-[#006970]` matching navbar connect wallet button style), text: "LAUNCH NOW"
  - Optional: small `rocket_launch` Material Symbol icon in the button
  - Add `mb-8` spacing below the banner
- Keep the banner compact (not full-viewport height) — just a prominent callout card
  </action>
  <verify>
    - Desktop sidebar shows "LAUNCH AGENT" as first nav item with rocket_launch icon
    - Mobile bottom nav shows Launch Agent tab
    - Desktop navbar shows "Launch" as first nav link
    - Directory page (/) shows hero CTA banner above the agent grid with "LAUNCH NOW" linking to /launch
    - All existing nav items still work
    - `npm run build` succeeds
  </verify>
  <done>
    - "Launch Agent" is the first/most prominent item in both sidebar and navbar
    - Directory page has a hero CTA banner above the agent directory linking to /launch
    - Navigation is consistent across desktop and mobile
  </done>
</task>

</tasks>

<verification>
- `npm run build` completes without errors
- GET /api/templates returns template list (no soul_md exposed)
- /launch page loads with hero + wizard flow
- Sidebar, navbar, and directory page all link to /launch
- Payment flow matches existing subscribe page patterns (wagmi hooks, USDC transfer, state machine)
</verification>

<success_criteria>
- Users can navigate to /launch from any page via sidebar, navbar, or directory hero CTA
- /launch page clearly communicates the value prop (AI agent, full hosting, Claude Code, 100 USDC/month)
- Multi-step wizard allows: template selection -> agent configuration -> payment -> launch
- Agent creation and subscription APIs are called correctly post-payment
- Free launch path works with coupon codes
</success_criteria>

<output>
After completion, create `.planning/quick/1-create-agent-launch-flow-ui-with-hero-wi/1-SUMMARY.md`
</output>
