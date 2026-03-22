/**
 * NanoClaw Agent Runner — runs inside each per-turn Docker container.
 *
 * Protocol:
 *   1. Reads JSON from stdin: { prompt, sessionId, groupFolder, chatJid, isMain, assistantName }
 *   2. Calls Claude Agent SDK query() with the user's message + agent's CLAUDE.md personality
 *   3. Writes structured output to stdout between marker pairs:
 *      ---NANOCLAW_OUTPUT_START---
 *      { "status": "success", "result": "agent response text", "newSessionId": "..." }
 *      ---NANOCLAW_OUTPUT_END---
 *   4. Container exits after the query completes.
 *
 * Environment:
 *   ANTHROPIC_BASE_URL — points to credential proxy (http://host.docker.internal:3001)
 *   ANTHROPIC_API_KEY=placeholder — proxy injects real key
 *   /workspace/group/CLAUDE.md — agent personality (mounted read-write)
 *   /home/node/.claude/ — session persistence (mounted read-write)
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

const OUTPUT_START = '---NANOCLAW_OUTPUT_START---';
const OUTPUT_END = '---NANOCLAW_OUTPUT_END---';

interface ContainerInput {
  prompt: string;
  sessionId?: string;
  groupFolder: string;
  chatJid: string;
  isMain: boolean;
  isScheduledTask?: boolean;
  assistantName?: string;
}

function emit(output: {
  status: 'success' | 'error';
  result: string | null;
  newSessionId?: string;
  error?: string;
}): void {
  process.stdout.write(`\n${OUTPUT_START}\n${JSON.stringify(output)}\n${OUTPUT_END}\n`);
}

async function main(): Promise<void> {
  // Read input from stdin (NanoClaw container-runner writes JSON then closes stdin)
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) {
    emit({ status: 'error', result: null, error: 'No input received on stdin' });
    process.exit(1);
  }

  let input: ContainerInput;
  try {
    input = JSON.parse(raw);
  } catch {
    emit({ status: 'error', result: null, error: `Invalid JSON input: ${raw.slice(0, 200)}` });
    process.exit(1);
  }

  if (!input.prompt) {
    emit({ status: 'error', result: null, error: 'Missing prompt in input' });
    process.exit(1);
  }

  // Collect the full response text from all assistant messages
  let responseText = '';
  let sessionId: string | undefined;

  try {
    // The SDK loads CLAUDE.md from cwd (/workspace/group) automatically via settingSources.
    // Session resumption: if sessionId is provided, the SDK resumes the conversation.
    for await (const message of query({
      prompt: input.prompt,
      options: {
        cwd: '/workspace/group',
        resume: input.sessionId || undefined,
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        settingSources: ['project', 'user'],
        maxTurns: 10,
      },
    })) {
      // The SDK yields messages of various types. We care about:
      // - 'assistant' messages (Claude's response text)
      // - 'result' messages (final summary with session ID)
      const msg = message as Record<string, unknown>;

      if (msg.type === 'assistant' && typeof msg.content === 'string') {
        responseText += msg.content;
      } else if (msg.type === 'assistant' && Array.isArray(msg.content)) {
        // Content blocks: [{ type: 'text', text: '...' }, { type: 'tool_use', ... }]
        for (const block of msg.content) {
          const b = block as Record<string, unknown>;
          if (b.type === 'text' && typeof b.text === 'string') {
            responseText += b.text;
          }
        }
      }

      // Capture session ID from result message
      if (msg.type === 'result') {
        const result = msg as Record<string, unknown>;
        if (typeof result.session_id === 'string') {
          sessionId = result.session_id;
        }
        // Also check for response text in result
        if (typeof result.result === 'string' && !responseText) {
          responseText = result.result;
        }
      }
    }

    // Emit the response
    emit({
      status: 'success',
      result: responseText || '(no response)',
      newSessionId: sessionId,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    emit({
      status: 'error',
      result: null,
      newSessionId: sessionId,
      error: errorMessage,
    });
    process.exit(1);
  }
}

main().catch((err) => {
  emit({ status: 'error', result: null, error: `Fatal: ${err}` });
  process.exit(1);
});
