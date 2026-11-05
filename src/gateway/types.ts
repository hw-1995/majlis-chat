import type { SourceDoc, StreamEvent } from '../types';

/**
 * The provider gateway: the one seam between the chat UI and whoever generates
 * the answer.
 *
 * Everything above this layer (retrieval, the agent loop, the UI) speaks in
 * `ChatTurn`s and receives `StreamEvent`s. Each adapter below it translates to
 * and from one vendor's wire format. Swapping DeepSeek for OpenAI, or the mock
 * for either, changes which adapter is constructed and nothing else.
 */

export interface ToolCallRef {
  id: string;
  name: string;
  /** JSON-encoded arguments, exactly as the model produced them. */
  arguments: string;
}

/** A conversation turn in the shape every provider adapter accepts. */
export type ChatTurn =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: ToolCallRef[] }
  | { role: 'tool'; content: string; toolCallId: string; name: string };

/** A tool the model may call, described with JSON Schema. */
export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ProviderRequest {
  turns: ChatTurn[];
  tools?: ToolSpec[];
  /** Retrieved passages for this turn (the mock grounds its answer on them). */
  sources: SourceDoc[];
  /** Text already received before a dropped connection, for providers that can continue it. */
  resumeFrom: string;
  signal: AbortSignal;
}

export interface Provider {
  id: string;
  /** True when a retried request can carry on from `resumeFrom` instead of starting over. */
  supportsResume: boolean;
  /**
   * Stream one model response. Resolves after a `done` event; throws if the
   * stream ends without one, so the caller can retry a cut-off answer rather
   * than show it as complete.
   */
  stream(request: ProviderRequest, onEvent: (event: StreamEvent) => void): Promise<void>;
}

/** Errors a user can act on carry a code the UI can explain in their language. */
export type ProviderErrorCode = 'auth' | 'rate_limit' | 'network' | 'bad_request' | 'server';

export class ProviderError extends Error {
  constructor(
    public readonly code: ProviderErrorCode,
    message: string,
    /** Whether retrying the same request might succeed. */
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
