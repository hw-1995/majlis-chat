import { useCallback, useEffect, useState } from 'react';
import { Composer } from './components/Composer';
import { MessageList } from './components/MessageList';
import { SettingsPanel } from './components/SettingsPanel';
import { SourcePanel } from './components/SourcePanel';
import { useChat } from './hooks/useChat';
import {
  clearStoredSettings,
  describeProvider,
  isMock,
  loadSettings,
  saveSettings,
  type ModelSettings,
} from './gateway/settings';
import { DIR, LANG_NAMES, STRINGS, type Lang } from './i18n';

/** Open in the visitor's own language when it is one we support. */
function initialLang(): Lang {
  const preferred = typeof navigator === 'undefined' ? '' : navigator.language.toLowerCase();
  if (preferred.startsWith('zh')) return 'zh';
  if (preferred.startsWith('ar')) return 'ar';
  return 'en';
}

export default function App() {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [settings, setSettings] = useState<ModelSettings>(loadSettings);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const strings = STRINGS[lang];
  const dir = DIR[lang];

  const {
    messages,
    sources,
    status,
    notice,
    droppedTurns,
    liveSteps,
    streamStore,
    send,
    stop,
    retry,
    clear,
  } = useChat(settings);

  const updateSettings = useCallback((next: ModelSettings) => {
    setSettings(next);
    saveSettings(next);
  }, []);

  const clearKey = useCallback(() => {
    clearStoredSettings();
    setSettings((prev) => ({ ...prev, apiKey: '' }));
  }, []);

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
        {isMock(settings)
          ? strings.mockNotice
          : strings.liveNotice.replace('{provider}', describeProvider(settings))}
        <br />
        {strings.corpusNotice}
      </p>

      <SettingsPanel
        settings={settings}
        strings={strings}
        onChange={updateSettings}
        onClearKey={clearKey}
      >
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.tools}
            onChange={(event) => updateSettings({ ...settings, tools: event.target.checked })}
          />
          <span>
            {strings.tools.toggle}
            <span className="toggle__hint">{strings.tools.hint}</span>
          </span>
        </label>
      </SettingsPanel>

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
            strings={strings}
            liveSteps={liveSteps}
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
            {messages.length > 0 && status !== 'streaming' && status !== 'retrieving' ? (
              <button type="button" className="btn btn--ghost statusbar__end" onClick={clear}>
                {strings.settings.newChat}
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
