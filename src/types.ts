export type Role = 'system' | 'user' | 'assistant';

/** One tool invocation made while answering a turn, shown to the user as a step. */
export interface ToolStep {
  id: string;
  name: string;
  /** Arguments as the model supplied them (already JSON-parsed when valid). */
  args: unknown;
  /** What the tool returned, as sent back to the model. */
  result?: string;
  status: 'running' | 'done' | 'error';
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  /** Indices into the `sources` array that this message cited, in citation order. */
  citations?: number[];
  /** Tools the assistant called before writing this answer. */
  steps?: ToolStep[];
  /** Set when the turn ended badly, so the UI can offer a retry. */
  error?: string;
}

export interface SourceDoc {
  id: string;
  title: string;
  text: string;
  lang: 'en' | 'zh' | 'ar';
  /** Translations of the same article share a topic. */
  topic?: string;
}

/** A retrieved passage plus its score, ordered most relevant first. */
export interface Retrieved {
  doc: SourceDoc;
  score: number;
}

export type ChatStatus = 'idle' | 'retrieving' | 'streaming' | 'error';

/**
 * Wire format between the client and whatever sits behind /api/chat (the mock
 * dev server, or the optional proxy). Provider adapters translate each vendor's
 * own stream into these same events, so nothing above the adapter layer knows
 * which vendor answered.
 */
export type StreamEvent =
  | { type: 'token'; value: string }
  | { type: 'tool_call'; id: string; name: string; arguments: string }
  | { type: 'done' }
  | { type: 'error'; message: string };
