export type Role = 'system' | 'user' | 'assistant';

export interface Message {
  id: string;
  role: Role;
  content: string;
  /** Indices into the `sources` array that this message cited, in citation order. */
  citations?: number[];
  /** Set when the turn ended badly, so the UI can offer a retry. */
  error?: string;
}

export interface SourceDoc {
  id: string;
  title: string;
  text: string;
  lang: 'en' | 'ar';
}

/** A retrieved chunk plus its BM25 score, ordered most relevant first. */
export interface Retrieved {
  doc: SourceDoc;
  score: number;
}

export type ChatStatus = 'idle' | 'retrieving' | 'streaming' | 'error';

/** Wire format between the client and whatever provider is behind /api/chat. */
export type StreamEvent =
  | { type: 'token'; value: string }
  | { type: 'done' }
  | { type: 'error'; message: string };
