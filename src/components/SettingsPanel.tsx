import { useId, useState, type ReactNode } from 'react';
import { PRESETS, type ModelSettings } from '../gateway/settings';
import type { Strings } from '../i18n';

interface SettingsPanelProps {
  settings: ModelSettings;
  strings: Strings;
  onChange: (next: ModelSettings) => void;
  onClearKey: () => void;
  /** Extra controls (feature toggles) rendered under the provider fields. */
  children?: ReactNode;
}

/**
 * Bring-your-own-key form. Collapsed by default: a visitor who only wants to
 * see the demo never has to think about keys, and the mock answers meanwhile.
 */
export function SettingsPanel({ settings, strings, onChange, onClearKey, children }: SettingsPanelProps) {
  const t = strings.settings;
  const [revealed, setRevealed] = useState(false);
  const ids = { provider: useId(), baseUrl: useId(), model: useId(), key: useId() };
  const isMockSelected = settings.providerId === 'mock';

  const pickProvider = (providerId: string): void => {
    const preset = PRESETS.find((p) => p.id === providerId);
    onChange({
      ...settings,
      providerId,
      // Switching vendor resets the URL and model to that vendor's defaults;
      // the key is kept, so trying the same key elsewhere is one click.
      baseUrl: preset?.baseUrl ?? '',
      model: preset?.model ?? '',
    });
  };

  return (
    <details className="settings">
      <summary className="settings__summary">{t.title}</summary>
      <div className="settings__body">
        <label className="field" htmlFor={ids.provider}>
          <span className="field__label">{t.provider}</span>
          <select
            id={ids.provider}
            className="field__input"
            value={settings.providerId}
            onChange={(event) => pickProvider(event.target.value)}
          >
            <option value="mock">{t.mock}</option>
            {PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>

        {isMockSelected ? null : (
          <>
            <label className="field" htmlFor={ids.baseUrl}>
              <span className="field__label">{t.baseUrl}</span>
              <input
                id={ids.baseUrl}
                className="field__input"
                dir="ltr"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                value={settings.baseUrl}
                placeholder="https://…/v1"
                onChange={(event) => onChange({ ...settings, baseUrl: event.target.value })}
              />
            </label>
            <label className="field" htmlFor={ids.model}>
              <span className="field__label">{t.model}</span>
              <input
                id={ids.model}
                className="field__input"
                dir="ltr"
                autoComplete="off"
                spellCheck={false}
                value={settings.model}
                onChange={(event) => onChange({ ...settings, model: event.target.value })}
              />
            </label>
            <div className="field">
              <label className="field__label" htmlFor={ids.key}>
                {t.apiKey}
              </label>
              <div className="field__row">
                <input
                  id={ids.key}
                  className="field__input"
                  dir="ltr"
                  type={revealed ? 'text' : 'password'}
                  autoComplete="off"
                  spellCheck={false}
                  value={settings.apiKey}
                  placeholder="sk-…"
                  onChange={(event) => onChange({ ...settings, apiKey: event.target.value })}
                />
                <button type="button" className="btn btn--ghost" onClick={() => setRevealed(!revealed)}>
                  {revealed ? t.hide : t.show}
                </button>
                <button type="button" className="btn btn--ghost" onClick={onClearKey}>
                  {t.clearKey}
                </button>
              </div>
            </div>
            <p className="settings__note">{t.keyNote}</p>
            <p className="settings__note">{t.corsNote}</p>
          </>
        )}

        {children}
      </div>
    </details>
  );
}
