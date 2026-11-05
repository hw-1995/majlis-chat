import { streamTurn } from '../lib/streamClient';
import type { ChatTurn, Provider, ToolSpec } from '../gateway/types';
import type { SourceDoc, ToolStep } from '../types';
import { executeTool } from './tools';

/**
 * The agent loop: ask the model; if it asks for tools, run them and ask
 * again with the results; stop when it answers in plain text.
 *
 *   user question
 *     → model: "call estimate_cost({plan: team, seats: 5})"
 *     → we run it → {"total_usd": 600}
 *     → model: "Five members on Team cost $600 a year [1]."
 *
 * Bounded by `maxSteps`. A model that keeps asking for tools must not be able
 * to loop forever (each round costs money and time), so on the last step the
 * tools are withheld and the model has to answer with what it has.
 */

export interface AgentOptions {
  provider: Provider;
  turns: ChatTurn[];
  tools?: ToolSpec[];
  sources: SourceDoc[];
  signal: AbortSignal;
  maxSteps?: number;
  onToken: (token: string) => void;
  /**
   * A dropped stream is being restarted from scratch: the UI should show only
   * `keep` (the answer from earlier tool rounds) and discard the partial text.
   */
  onReset?: (keep: string) => void;
  onRetry?: (attempt: number, delayMs: number) => void;
  /** Called whenever a tool step starts or finishes, for the UI. */
  onStep?: (step: ToolStep) => void;
  /** Injectable for tests. */
  runTool?: (name: string, args: string) => string;
}

export interface AgentResult {
  text: string;
  steps: ToolStep[];
}

function parseForDisplay(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export async function runAgent(options: AgentOptions): Promise<AgentResult> {
  const { provider, tools, sources, signal, onToken, onReset, onRetry, onStep } = options;
  const maxSteps = options.maxSteps ?? 4;
  const runTool = options.runTool ?? executeTool;

  const turns: ChatTurn[] = [...options.turns];
  const steps: ToolStep[] = [];
  let answer = '';

  for (let step = 0; step < maxSteps; step += 1) {
    const isLast = step === maxSteps - 1;
    // Text the model writes before asking for a tool ("Let me check…") is
    // shown as it streams; anything after a tool round starts on a new line.
    const prefix = answer.length > 0 ? '\n' : '';
    let wrotePrefix = false;

    const result = await streamTurn({
      provider,
      turns,
      tools: isLast || !tools?.length ? undefined : tools,
      sources,
      signal,
      onToken: (token) => {
        if (!wrotePrefix && prefix) {
          onToken(prefix);
          wrotePrefix = true;
        }
        onToken(token);
      },
      onReset: () => {
        wrotePrefix = false;
        onReset?.(answer);
      },
      onRetry,
    });
    answer += (wrotePrefix ? prefix : '') + result.text;

    if (result.toolCalls.length === 0) return { text: answer, steps };

    turns.push({ role: 'assistant', content: result.text, toolCalls: result.toolCalls });
    for (const call of result.toolCalls) {
      const running: ToolStep = {
        id: call.id,
        name: call.name,
        args: parseForDisplay(call.arguments),
        status: 'running',
      };
      onStep?.(running);
      const output = runTool(call.name, call.arguments);
      const failed = (parseForDisplay(output) as { error?: unknown })?.error !== undefined;
      const finished: ToolStep = { ...running, result: output, status: failed ? 'error' : 'done' };
      steps.push(finished);
      onStep?.(finished);
      turns.push({ role: 'tool', content: output, toolCallId: call.id, name: call.name });
    }
  }
  return { text: answer, steps };
}
