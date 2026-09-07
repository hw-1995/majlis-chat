/**
 * A one-value external store for the in-flight assistant text.
 *
 * The streaming text deliberately does NOT live in React state. At ~30 tokens
 * a second, holding it in state re-renders the whole conversation on every
 * token, and the cost grows with the length of the transcript — the longer the
 * chat, the worse the typing feels. Keeping it in an external store means only
 * the single component subscribed to it re-renders; the message list above is
 * untouched until the turn completes.
 */
export interface TextStore {
  get(): string;
  set(next: string): void;
  append(chunk: string): void;
  subscribe(listener: () => void): () => void;
}

export function createTextStore(): TextStore {
  let text = '';
  const listeners = new Set<() => void>();

  const emit = (): void => {
    for (const listener of listeners) listener();
  };

  return {
    get: () => text,
    set(next: string) {
      text = next;
      emit();
    },
    append(chunk: string) {
      text += chunk;
      emit();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
