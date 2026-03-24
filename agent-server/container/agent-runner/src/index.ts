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
const EVENT_START = '---NANOCLAW_EVENT_START---';
const EVENT_END = '---NANOCLAW_EVENT_END---';

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

/** Emit an observability event (parsed by the agent-server for logging to Supabase) */
function emitEvent(event: {
  event_type: string;
  payload: Record<string, unknown>;
}): void {
  process.stdout.write(`\n${EVENT_START}\n${JSON.stringify(event)}\n${EVENT_END}\n`);
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
    return;
  }

  let input: ContainerInput;
  try {
    input = JSON.parse(raw) as ContainerInput;
  } catch {
    emit({ status: 'error', result: null, error: `Invalid JSON input: ${raw.slice(0, 200)}` });
    return;
  }

  if (!input.prompt) {
    emit({ status: 'error', result: null, error: 'Missing prompt in input' });
    return;
  }

  // Collect the full response text from all assistant messages
  let responseText = '';
  let sessionId: string | undefined;
  const seenMessageIds = new Set<string>();

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
      // - 'assistant' messages (Claude's response text + LLM metadata)
      // - 'result' messages (final summary with session ID, cost, usage)
      const msg = message as Record<string, unknown>;

      if (msg.type === 'assistant') {
        // Extract response text from content blocks
        if (typeof msg.content === 'string') {
          responseText += msg.content;
        } else if (Array.isArray(msg.content)) {
          for (const block of msg.content) {
            const b = block as Record<string, unknown>;
            if (b.type === 'text' && typeof b.text === 'string') {
              responseText += b.text;
            }
            // Emit tool_call events for tool_use blocks
            if (b.type === 'tool_use') {
              emitEvent({
                event_type: 'tool_call',
                payload: {
                  tool_name: b.name as string,
                  input: b.input,
                },
              });
            }
          }
        }

        // Emit llm_call event with token usage (deduplicate by message ID)
        const betaMsg = msg.message as Record<string, unknown> | undefined;
        const msgId = betaMsg?.id as string | undefined;
        if (betaMsg && msgId && !seenMessageIds.has(msgId)) {
          seenMessageIds.add(msgId);
          const usage = betaMsg.usage as Record<string, unknown> | undefined;
          emitEvent({
            event_type: 'llm_call',
            payload: {
              model: (betaMsg.model as string) ?? (msg.model as string) ?? 'unknown',
              input_tokens: (usage?.input_tokens as number) ?? 0,
              output_tokens: (usage?.output_tokens as number) ?? 0,
              cache_read_input_tokens: (usage?.cache_read_input_tokens as number) ?? 0,
              cache_creation_input_tokens: (usage?.cache_creation_input_tokens as number) ?? 0,
              message_id: msgId,
            },
          });
        }
      }

      // Capture session ID and final metrics from result message
      if (msg.type === 'result') {
        const result = msg as Record<string, unknown>;
        if (typeof result.session_id === 'string') {
          sessionId = result.session_id;
        }
        if (typeof result.result === 'string' && !responseText) {
          responseText = result.result;
        }
        // Emit turn_complete with aggregate metrics
        const usage = result.usage as Record<string, unknown> | undefined;
        const modelUsage = result.modelUsage as Record<string, Record<string, unknown>> | undefined;
        emitEvent({
          event_type: 'turn_complete',
          payload: {
            num_turns: (result.num_turns as number) ?? 0,
            duration_ms: (result.duration_ms as number) ?? 0,
            duration_api_ms: (result.duration_api_ms as number) ?? 0,
            total_cost_usd: (result.total_cost_usd as number) ?? 0,
            is_error: (result.is_error as boolean) ?? false,
            input_tokens: (usage?.input_tokens as number) ?? 0,
            output_tokens: (usage?.output_tokens as number) ?? 0,
            model_usage: modelUsage ?? {},
          },
        });
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
    emitEvent({
      event_type: 'error',
      payload: { message: errorMessage },
    });
    emit({
      status: 'error',
      result: null,
      newSessionId: sessionId,
      error: errorMessage,
    });
    return;
  }
}

main().catch((err) => {
  emit({ status: 'error', result: null, error: `Fatal: ${err}` });
  process.exit(1);
});
