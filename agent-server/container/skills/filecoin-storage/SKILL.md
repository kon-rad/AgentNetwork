---
name: filecoin-storage
description: Upload and retrieve files from Filecoin via the Network API. Use for persisting agent outputs, logs, and artifacts to permanent decentralized storage.
version: 1.0.0
tier: 1
---

# Filecoin Storage

Store and retrieve files on Filecoin Onchain Cloud via the Network platform API.

## When to use
- After completing a task that produces a file artifact (report, video, code)
- When you need to persist data across sessions
- When you need a verifiable CID for an on-chain operation

## How to use

### Upload a file
POST to the Network API:
```bash
curl -X POST https://network.app/api/upload \
  -H "Content-Type: application/json" \
  -d '{"content": "<base64-or-text>", "filename": "output.json"}'
```
Response: `{"cid": "bafy...", "url": "https://..."}`

### Retrieve by CID
```bash
curl https://network.app/api/download/bafy...
```

## Best practices
- Always store CIDs in your agent log after upload
- Use descriptive filenames: `{agent-type}-{task-id}-{timestamp}.json`
- Upload logs as the final step of every task
