import { useCallback, useEffect, useState } from 'react';
import { Composer } from './components/Composer';
import { MessageList } from './components/MessageList';
import { SourcePanel } from './components/SourcePanel';
import { useChat } from './hooks/useChat';
import { DIR, LANG_NAMES, STRINGS, type Lang } from './i18n';

export default function App() {
  const [lang, setLang] = useState<Lang>('en');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const strings = STRINGS[lang];
  const dir = DIR[lang];

  const { messages, sources, status, notice, droppedTurns, streamStore, send, stop, retry } =
    useChat();

  // Direction is set on the document element, not a wrapper, so that anything
  // portalled to the body (dialogs, tooltips) inherits it too.
  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
  }, [dir, lang]);

  const handleCite = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  const statusLabel =
    notice === 'reconnecting'
      ? strings.reconnecting
      : status === 'retrieving'
        ? strings.retrieving
        : status === 'streaming'
          ? strings.streaming
          : null;

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1 className="header__title">{strings.title}</h1>
          <p className="header__tagline">{strings.tagline}</p>
        </div>
        <div className="langs" role="group" aria-label="Language">
          {(Object.keys(LANG_NAMES) as Lang[]).map((code) => (
            <button
              key={code}
              type="button"
              lang={code}
              className={code === lang ? 'btn btn--ghost btn--active' : 'btn btn--ghost'}
              aria-pressed={code === lang}
              onClick={() => setLang(code)}
            >
              {LANG_NAMES[code]}
            </button>
          ))}
        </div>
      </header>

      <p className="notice">
        {strings.mockNotice}
        <br />
        {strings.corpusNotice}
      </p>

      <main className="layout">
        <section className="chat">
          <MessageList
            messages={messages}
            sourceCount={sources.length}
            streamStore={streamStore}
            onCite={handleCite}
            activeIndex={activeIndex}
            emptyState={strings.emptyState}
            emptyHint={strings.emptyHint}
            examples={strings.examples}
            onPickExample={send}
          />

          <div className="statusbar">
            {statusLabel ? <span className="statusbar__live">{statusLabel}</span> : null}
            {droppedTurns > 0 ? (
              <span className="statusbar__trim">
                {droppedTurns} {strings.droppedTurns}
              </span>
            ) : null}
            {status === 'error' ? (
              <button type="button" className="btn btn--ghost" onClick={retry}>
                {strings.retry}
              </button>
            ) : null}
          </div>

          <Composer status={status} strings={strings} onSend={send} onStop={stop} />
        </section>

        <SourcePanel sources={sources} strings={strings} activeIndex={activeIndex} />
      </main>
    </div>
  );
}
