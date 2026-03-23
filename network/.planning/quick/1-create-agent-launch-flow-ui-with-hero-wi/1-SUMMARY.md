---
phase: quick
plan: 1
subsystem: ui
tags: [launch-wizard, wagmi, usdc, agent-templates, navigation]

# Dependency graph
requires:
  - phase: 11-subscriptions-payments
    provides: "POST /api/subscriptions endpoint with USDC verification and free launch"
  - phase: 12-agent-templates-skills
    provides: "agent_templates table and /api/templates/[type] endpoint pattern"
provides:
  - "GET /api/templates endpoint listing all templates"
  - "/launch page with hero section and multi-step wizard"
  - "Launch Agent nav links in sidebar and navbar"
  - "Hero CTA banner on directory page"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: ["multi-step wizard with numbered step indicator", "coupon code free launch UI path"]

key-files:
  created:
    - "src/app/api/templates/route.ts"
    - "src/app/launch/page.tsx"
  modified:
    - "src/components/layout/sidebar.tsx"
    - "src/components/layout/navbar.tsx"
    - "src/app/page.tsx"

key-decisions:
  - "Reused exact USDC payment state machine pattern from subscribe page for consistency"
  - "Coupon code triggers free launch path via existing /api/subscriptions free_launch support"

patterns-established:
  - "Wizard pattern: step state with StepIndicator component showing numbered circles"

requirements-completed: [LAUNCH-FLOW]

# Metrics
duration: 14min
completed: 2026-03-23
---

# Quick Plan 1: Create Agent Launch Flow UI Summary

**Full /launch page with hero + 4-step wizard (template, configure, pay 100 USDC, launch) plus nav links and directory CTA banner**

## Performance

- **Duration:** 14 min
- **Started:** 2026-03-23T02:57:40Z
- **Completed:** 2026-03-23T03:11:28Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- GET /api/templates endpoint returns all templates without exposing soul_md
- /launch page with hero section showing pricing (100 USDC/month) and value proposition
- Multi-step wizard: pick template -> configure name/bio/avatar -> review & pay (USDC or coupon) -> launch success
- "Launch Agent" added as first item in sidebar and navbar navigation
- Hero CTA banner on directory page linking to /launch

## Task Commits

Each task was committed atomically:

1. **Task 1: Create GET /api/templates endpoint and /launch page with hero + multi-step wizard** - `04f87bc` (feat)
2. **Task 2: Add Launch Agent to navigation and hero CTA to directory page** - `6fb2dc7` (feat)

## Files Created/Modified
- `src/app/api/templates/route.ts` - Public GET endpoint listing all agent templates
- `src/app/launch/page.tsx` - Full launch page with hero section and 4-step wizard
- `src/components/layout/sidebar.tsx` - Added "LAUNCH AGENT" as first nav item
- `src/components/layout/navbar.tsx` - Added "Launch" as first nav item
- `src/app/page.tsx` - Added hero CTA banner above agent directory grid

## Decisions Made
- Reused exact USDC payment state machine from subscribe page (PaymentState type, useWriteContract, useWaitForTransactionReceipt) for consistency
- Coupon code field on step 3 triggers free launch path via existing /api/subscriptions free_launch support
- StepIndicator component with numbered circles shows progress through wizard steps
- Post-payment flow creates agent first (POST /api/agents), then subscription (POST /api/subscriptions)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Launch flow is fully functional end-to-end
- Requires SIWE session for agent creation and subscription
- NEXT_PUBLIC_TREASURY_ADDRESS env var must be set for USDC payments
- FREE_LAUNCH_COUPONS env var enables coupon codes

---
*Phase: quick*
*Completed: 2026-03-23*
