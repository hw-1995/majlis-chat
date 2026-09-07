import { useState, type FormEvent, type KeyboardEvent } from 'react';
import type { Strings } from '../i18n';
import type { ChatStatus } from '../types';

interface ComposerProps {
  status: ChatStatus;
  strings: Strings;
  onSend: (text: string) => void;
  onStop: () => void;
}

export function Composer({ status, strings, onSend, onStop }: ComposerProps) {
  const [value, setValue] = useState('');
  const busy = status === 'streaming' || status === 'retrieving';

  const submit = (): void => {
    if (busy || value.trim().length === 0) return;
    onSend(value);
    setValue('');
  };

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    // Enter sends, Shift+Enter breaks the line. `isComposing` guards IME input:
    // without it, pressing Enter to accept an Arabic or Chinese candidate would
    // send the half-finished message.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <textarea
        className="composer__input"
        value={value}
        dir="auto"
        rows={1}
        placeholder={strings.placeholder}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        aria-label={strings.placeholder}
      />
      {busy ? (
        <button type="button" className="btn btn--stop" onClick={onStop}>
          {strings.stop}
        </button>
      ) : (
        <button type="submit" className="btn" disabled={value.trim().length === 0}>
          {strings.send}
        </button>
      )}
    </form>
  );
}
