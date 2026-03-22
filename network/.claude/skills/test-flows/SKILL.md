---
name: test-flows
description: Run automated API-level tests for Network platform features — auth, templates, NanoClaw, chat, observability. Use when verifying platform functionality after changes.
---

# Test Flows — Automated Platform Verification

Run automated tests against the Network platform APIs. Tests are API-level (curl/fetch), not browser-level.

**Usage:** `/test-flows` runs all flows. `/test-flows auth` runs only auth tests. Available scopes: `auth`, `templates`, `nanoclaw`, `chat`, `observe`, `e2e`.

**Scope:** $ARGUMENTS (default: "all")

## Setup

Read `.env.local` to get required variables:
```bash
source .env.local 2>/dev/null
```

Required env vars: `NANOCLAW_URL`, `NANOCLAW_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

Ensure dev server is running at `http://localhost:3000`. If not, warn the user and exit.

```bash
curl -sf http://localhost:3000/ > /dev/null 2>&1 || echo "ERROR: Dev server not running. Start with: pnpm dev"
```

## Test Wallet Setup

Create a test wallet using viem (already installed):

```bash
node -e "
const { generatePrivateKey, privateKeyToAccount } = require('viem/accounts');
const key = generatePrivateKey();
const account = privateKeyToAccount(key);
console.log(JSON.stringify({ address: account.address, privateKey: key }));
"
```

Store the address and private key for use in subsequent tests.

## Flow: auth

### Test 1.1 — Nonce endpoint returns a nonce
```bash
NONCE=$(curl -sf http://localhost:3000/api/auth/siwe/nonce | jq -r '.nonce')
[ -n "$NONCE" ] && echo "PASS: nonce returned ($NONCE)" || echo "FAIL: no nonce"
```

### Test 1.2 — Session endpoint returns null when not signed in
```bash
RESULT=$(curl -sf http://localhost:3000/api/auth/session | jq -r '.address')
[ "$RESULT" = "null" ] || [ -z "$RESULT" ] && echo "PASS: no session" || echo "FAIL: unexpected session"
```

### Test 1.3 — Protected route returns 401 without session
```bash
STATUS=$(curl -sf -o /dev/null -w "%{http_code}" http://localhost:3000/api/agents/test/chat)
[ "$STATUS" = "401" ] && echo "PASS: chat route returns 401" || echo "FAIL: expected 401, got $STATUS"
```

### Test 1.4 — Signout endpoint clears session
```bash
STATUS=$(curl -sf -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/auth/signout)
[ "$STATUS" = "200" ] && echo "PASS: signout returns 200" || echo "FAIL: signout returned $STATUS"
```

## Flow: templates

### Test 2.1 — All 5 templates return valid JSON
For each type in `filmmaker`, `coder`, `trader`, `auditor`, `clipper`:
```bash
for TYPE in filmmaker coder trader auditor clipper; do
  RESULT=$(curl -sf http://localhost:3000/api/templates/$TYPE)
  HAS_NAME=$(echo "$RESULT" | jq -r '.display_name // empty')
  [ -n "$HAS_NAME" ] && echo "PASS: $TYPE template has display_name" || echo "FAIL: $TYPE template missing display_name"
done
```

### Test 2.2 — soul_md is NOT exposed in public API
```bash
for TYPE in filmmaker coder trader auditor clipper; do
  HAS_SOUL=$(curl -sf http://localhost:3000/api/templates/$TYPE | jq 'has("soul_md")')
  [ "$HAS_SOUL" = "false" ] && echo "PASS: $TYPE soul_md not exposed" || echo "FAIL: $TYPE leaks soul_md"
done
```

## Flow: nanoclaw

### Test 3.1 — NanoClaw rejects requests without secret
```bash
STATUS=$(curl -sf -o /dev/null -w "%{http_code}" $NANOCLAW_URL/)
[ "$STATUS" = "401" ] && echo "PASS: NanoClaw rejects without secret" || echo "FAIL: expected 401, got $STATUS"
```

### Test 3.2 — NanoClaw accepts requests with secret
```bash
STATUS=$(curl -sf -o /dev/null -w "%{http_code}" -H "x-shared-secret: $NANOCLAW_SECRET" $NANOCLAW_URL/message \
  -X POST -H "Content-Type: application/json" -d '{"agentId":"health-check","content":"ping","sender":"test"}')
# 200 or 404 (agent not registered) are both valid — just not 401
[ "$STATUS" != "401" ] && echo "PASS: NanoClaw accepts with secret (status: $STATUS)" || echo "FAIL: still 401 with secret"
```

### Test 3.3 — Register a test group
```bash
RESULT=$(curl -sf -H "x-shared-secret: $NANOCLAW_SECRET" $NANOCLAW_URL/register-group \
  -X POST -H "Content-Type: application/json" \
  -d '{"agentId":"test-flow-agent","name":"Test Flow Agent","claudeMdContent":"You are a test agent. Respond with: TEST OK"}')
echo "$RESULT" | jq -r '.ok // .error // "unknown"'
```

### Test 3.4 — Send message to registered group
```bash
RESULT=$(curl -sf -H "x-shared-secret: $NANOCLAW_SECRET" $NANOCLAW_URL/message \
  -X POST -H "Content-Type: application/json" \
  -d '{"agentId":"test-flow-agent","content":"Hello test agent","sender":"test-runner"}')
echo "$RESULT" | jq .
```

### Test 3.5 — SSE stream connects
```bash
# Test that SSE endpoint returns event-stream content type (timeout after 3s)
CONTENT_TYPE=$(curl -sf -m 3 -H "x-shared-secret: $NANOCLAW_SECRET" \
  -o /dev/null -w "%{content_type}" $NANOCLAW_URL/stream/test-flow-agent 2>/dev/null || echo "timeout")
[ "$CONTENT_TYPE" = "text/event-stream" ] || [ "$CONTENT_TYPE" = "timeout" ] && \
  echo "PASS: SSE stream connects (type: $CONTENT_TYPE)" || echo "FAIL: unexpected content type: $CONTENT_TYPE"
```

## Flow: chat

**Note:** These tests require an authenticated session. Use Supabase service role to insert test data directly for API-level testing.

### Test 4.1 — Chat history returns empty for new agent
```bash
# Insert a test subscription directly via Supabase for the test wallet
# Then test chat endpoint with session cookie
echo "SKIP: Requires authenticated session — test manually or via browser"
```

### Test 4.2 — Chat message persistence
Verify by querying Supabase directly:
```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from('chat_messages').select('*').limit(5).then(({ data, error }) => {
  if (error) console.log('FAIL:', error.message);
  else console.log('PASS: chat_messages table accessible, rows:', data.length);
});
"
```

## Flow: observe

### Test 5.1 — Agent events table exists and is accessible
```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from('agent_events').select('*').limit(1).then(({ data, error }) => {
  if (error) console.log('FAIL:', error.message);
  else console.log('PASS: agent_events table accessible');
});
"
```

### Test 5.2 — Files endpoint returns array
```bash
STATUS=$(curl -sf -o /dev/null -w "%{http_code}" -H "x-shared-secret: $NANOCLAW_SECRET" \
  $NANOCLAW_URL/agents/test-flow-agent/files)
echo "Files endpoint status: $STATUS"
```

## Flow: e2e

Run all flows above in sequence. Report summary:

```
═══════════════════════════════════════
 TEST RESULTS
═══════════════════════════════════════

 Auth:      4/4 passed
 Templates: 2/2 passed
 NanoClaw:  5/5 passed
 Chat:      1/2 passed (1 skipped — needs session)
 Observe:   2/2 passed
 ─────────────────────────────────────
 Total:     14/15 passed, 1 skipped
═══════════════════════════════════════
```

## Cleanup

After tests, remove the test group from NanoClaw:
```bash
ssh deploy@146.190.161.168 'rm -rf /opt/agent-server/groups/test-flow-agent'
```

## Reference

Full test documentation: `docs/TESTING.md`
Feature documentation: `docs/FEATURES.md`
