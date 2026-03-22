# Network Platform — Testing Guide

Manual and automated test flows for all v2.0 features. Each section can be run by a human or by a Claude Code agent using the `/test-flows` skill.

---

## Prerequisites

1. Dev server running: `pnpm dev` from `network/`
2. Supabase migrations applied (001 through 005)
3. `.env.local` configured with all required variables
4. A wallet with Base USDC (for payment tests) or use testnet
5. NanoClaw running on VPS: `ssh deploy@146.190.161.168 'systemctl status nanoclaw'`

---

## Test Flow 1: Authentication (SIWE)

### 1.1 Sign In
**Steps:**
1. Open `http://localhost:3000`
2. Click "Sign In" in the navbar
3. RainbowKit modal opens → connect wallet
4. Sign the SIWE message when prompted
5. Navbar shows truncated wallet address

**Verify:**
- [ ] Session cookie is set (DevTools → Application → Cookies → `iron-session`)
- [ ] `GET /api/auth/session` returns `{ address: "0x..." }`
- [ ] Refreshing the page keeps you signed in

### 1.2 Sign Out
**Steps:**
1. Click the wallet address / sign out button in navbar
2. Session is cleared

**Verify:**
- [ ] `GET /api/auth/session` returns `{ address: null }` or 401
- [ ] Protected routes (`/agent/[id]/chat`) redirect or show access denied

### 1.3 Route Protection
**Steps:**
1. While signed out, visit `/agent/[any-id]/chat`
2. While signed out, visit `/agent/[any-id]/observe`

**Verify:**
- [ ] Both show "Access denied" or redirect to sign in
- [ ] `GET /api/agents/[id]/chat` returns 401

**API test (curl):**
```bash
# Should return 401
curl -s http://localhost:3000/api/agents/test-agent/chat | jq .

# Should return 401
curl -s http://localhost:3000/api/auth/session | jq .
```

---

## Test Flow 2: Agent Templates

### 2.1 Browse Templates
**Steps:**
1. Visit `/subscribe/[any-agent-id]`
2. Page should show agent info + template details (description, skills)

**Verify:**
- [ ] Template name and description display
- [ ] Skill tags (cyan badges) are visible
- [ ] "100 USDC / month" pricing shows

**API test:**
```bash
# Should return template info (no soul_md)
curl -s http://localhost:3000/api/templates/coder | jq .
curl -s http://localhost:3000/api/templates/filmmaker | jq .
curl -s http://localhost:3000/api/templates/trader | jq .
curl -s http://localhost:3000/api/templates/auditor | jq .
curl -s http://localhost:3000/api/templates/clipper | jq .
```

**Verify:**
- [ ] All 5 templates return valid JSON
- [ ] `soul_md` field is NOT present in response
- [ ] `skill_set` and `mcp_packages` are arrays

---

## Test Flow 3: Subscription & Payment

### 3.1 Subscribe to Agent (requires real USDC or testnet)
**Steps:**
1. Sign in with wallet
2. Visit `/subscribe/[agent-id]`
3. Click "Subscribe"
4. Approve 100 USDC transfer in wallet
5. Watch payment states: prompting → pending → confirming → launching

**Verify:**
- [ ] Wallet prompt appears for 100 USDC
- [ ] Pending state shows tx hash + BaseScan link
- [ ] Confirmed state shows green checkmark
- [ ] Agent profile now shows "Active Subscription" badge

### 3.2 Subscription Status
**API test:**
```bash
# Public — returns has_active + expires_at
curl -s http://localhost:3000/api/subscriptions/[agent-id] | jq .
```

**Verify:**
- [ ] `has_active: true` after payment
- [ ] `expires_at` is ~30 days from now
- [ ] Duplicate tx_hash is rejected with 409

### 3.3 Subscription Renewal
**Steps:**
1. With an active subscription, visit `/subscribe/[agent-id]`
2. Button should say "Renew Subscription"
3. Pay another 100 USDC
4. New subscription row created, expiration extended

**Verify:**
- [ ] Renewal creates a new subscription row (not update)
- [ ] New `expires_at` is 30 days from renewal date

---

## Test Flow 4: NanoClaw Agent Server

### 4.1 Server Health
```bash
# Should return {"error":"unauthorized"} (no secret)
curl -s http://146.190.161.168/

# Should return 200 with valid response
curl -s -H "x-shared-secret: $NANOCLAW_SECRET" http://146.190.161.168/message \
  -X POST -H "Content-Type: application/json" \
  -d '{"agentId":"test","content":"ping","sender":"tester"}'
```

**Verify:**
- [ ] Without secret: 401 unauthorized
- [ ] With secret: request accepted (may return error if agent not registered — that's OK)

### 4.2 Register Agent Group
```bash
curl -s -H "x-shared-secret: $NANOCLAW_SECRET" http://146.190.161.168/register-group \
  -X POST -H "Content-Type: application/json" \
  -d '{"agentId":"test-agent-001","name":"Test Agent","claudeMdContent":"You are a test agent."}'
```

**Verify:**
- [ ] Returns success
- [ ] `groups/test-agent-001/` directory created on VPS
- [ ] `groups/test-agent-001/CLAUDE.md` contains "You are a test agent."

### 4.3 Container Spawning
```bash
# Register group first (4.2), then send message
curl -s -H "x-shared-secret: $NANOCLAW_SECRET" http://146.190.161.168/message \
  -X POST -H "Content-Type: application/json" \
  -d '{"agentId":"test-agent-001","content":"Hello, what can you do?","sender":"user1"}'
```

**Verify:**
- [ ] NanoClaw journal shows "Spawning container agent" (`journalctl -u nanoclaw --no-pager -n 20`)
- [ ] Docker container was created and completed (`docker ps -a --filter name=nanoclaw`)

### 4.4 SSE Stream
```bash
# In one terminal, start listening for SSE:
curl -N -H "x-shared-secret: $NANOCLAW_SECRET" http://146.190.161.168/stream/test-agent-001

# In another terminal, send a message (4.3)
```

**Verify:**
- [ ] SSE events appear in the stream terminal
- [ ] Events include `event: response` with agent text
- [ ] Stream ends with `event: done`

---

## Test Flow 5: Live Chat

### 5.1 Send Message
**Steps:**
1. Sign in with wallet that owns an agent
2. Visit `/agent/[your-agent-id]/chat`
3. Type a message, press Enter

**Verify:**
- [ ] Message appears immediately in chat (optimistic insert)
- [ ] Status indicator changes: idle → thinking
- [ ] Agent response streams in
- [ ] Status returns to idle after response completes

### 5.2 Message History
**Steps:**
1. Send a few messages in chat
2. Close the tab
3. Reopen `/agent/[your-agent-id]/chat`

**Verify:**
- [ ] All previous messages are loaded
- [ ] Order is correct (oldest first)
- [ ] Both user and assistant messages display

### 5.3 Keyboard Shortcuts
**Steps:**
1. In chat input, type text
2. Press Shift+Enter
3. Press Enter

**Verify:**
- [ ] Shift+Enter inserts newline
- [ ] Enter submits the message

### 5.4 Ownership Enforcement
**Steps:**
1. Sign in with wallet A (owns agent X)
2. Visit `/agent/[agent-owned-by-wallet-B]/chat`

**Verify:**
- [ ] "Access denied" message displays
- [ ] No chat history loads
- [ ] Cannot send messages

**API test:**
```bash
# Without auth cookie — should return 401
curl -s http://localhost:3000/api/agents/[agent-id]/chat | jq .
```

---

## Test Flow 6: Observability Dashboard

### 6.1 Live Event Feed
**Steps:**
1. Open `/agent/[your-agent-id]/observe` in one tab
2. Open `/agent/[your-agent-id]/chat` in another tab
3. Send a message to the agent in the chat tab

**Verify:**
- [ ] Event feed updates in the observe tab WITHOUT refreshing
- [ ] Events show colored badges (cyan=llm_call, purple=tool_call)
- [ ] New events appear at the top of the feed

### 6.2 Token Usage
**Steps:**
1. After sending a message (triggers LLM call)
2. Check the token usage panel on the observe page

**Verify:**
- [ ] Input tokens count > 0
- [ ] Output tokens count > 0
- [ ] Model name displays

### 6.3 Tool Call Details
**Steps:**
1. If agent used a tool, find the tool_call event in the feed
2. Click to expand

**Verify:**
- [ ] Tool name displays
- [ ] Input arguments shown (JSON)
- [ ] Output shown
- [ ] Duration in ms

### 6.4 File Browser
**Steps:**
1. On observe page, click "Files" tab

**Verify:**
- [ ] File tree loads (may be empty for new agents)
- [ ] Directories show folder icon
- [ ] Files show size

### 6.5 Access Control
**Steps:**
1. Visit `/agent/[agent-you-dont-own]/observe`

**Verify:**
- [ ] "Access denied" message displays
- [ ] No events or files load

---

## Test Flow 7: CI/CD

### 7.1 Next.js Deploy (Railway)
**Steps:**
1. Make a trivial change to any file in `src/`
2. Commit and push to main

**Verify:**
- [ ] GitHub Actions "Deploy app to Railway" workflow triggers
- [ ] Workflow completes with green checkmark
- [ ] Railway shows new deployment

### 7.2 Agent Server Deploy (VPS)
**Steps:**
1. Make a change to a file in `agent-server/`
2. Commit and push to main

**Verify:**
- [ ] GitHub Actions "Deploy agent-server to VPS" workflow triggers
- [ ] VPS has updated code at `/opt/agent-server/`
- [ ] NanoClaw service is running: `ssh deploy@146.190.161.168 'systemctl status nanoclaw'`

---

## Test Flow 8: End-to-End (Full User Journey)

This is the complete happy path a new user follows:

1. **Visit site** → see agent directory
2. **Connect wallet** → RainbowKit modal
3. **Sign in** → SIWE signature → session created
4. **Browse agents** → click an agent profile
5. **See subscription status** → "Subscribe — 100 USDC/mo"
6. **Click subscribe** → redirected to subscribe page with template details
7. **Pay 100 USDC** → wallet prompt → pending → confirmed
8. **Agent launches** → NanoClaw registers group, writes CLAUDE.md
9. **Chat with agent** → `/agent/[id]/chat` → send message → streaming response
10. **View observability** → `/agent/[id]/observe` → live events, token usage
11. **Browse files** → Files tab → agent's workspace directory
12. **Sign out** → session cleared

**Verify the full chain:**
- [ ] Steps 1-12 complete without errors
- [ ] Agent response is contextual (matches Soul.md personality)
- [ ] Observability events reflect the chat interaction
- [ ] Subscription badge visible on agent profile

---

## Automated Testing with Claude Code Agent

The `/test-flows` skill (below) allows a Claude Code agent to run these test flows programmatically using curl and the Supabase API.

### Usage
```
/test-flows           # Run all flows
/test-flows auth      # Run only auth tests
/test-flows chat      # Run only chat tests
/test-flows payment   # Run only payment tests
/test-flows e2e       # Run full end-to-end
```

### What the skill does
1. Creates a test wallet using viem
2. Simulates SIWE sign-in via API calls
3. Verifies all protected routes return 401/403 correctly
4. Tests template browsing endpoints
5. Tests NanoClaw health and message routing
6. Tests chat history persistence
7. Tests observability event flow
8. Reports pass/fail for each assertion

### Limitations
- Payment flow (Test Flow 3) requires real USDC — the skill skips this by default
- SSE streaming requires holding an open connection — the skill tests the connection establishment only
- UI interactions (click, type) are not tested — only API-level verification
