import { createMockProvider } from './mockProvider';
import { createOpenAiProvider } from './openaiCompatible';
import type { Provider } from './types';

/**
 * Bring-your-own-key settings.
 *
 * The visitor supplies their own API key; this demo never has one of its own.
 * That keeps it free to host (no one can run up a bill on our account) and
 * means a key is only ever sent to the vendor it belongs to.
 *
 * Where the key lives, and why:
 *   - sessionStorage, not localStorage: it is cleared when the tab closes, so
 *     a key typed on a shared computer does not linger;
 *   - never in the URL, never in logs, never sent anywhere but `baseUrl`.
 * The remaining risk is the usual one for anything held in a page: injected
 * script could read it. The page loads no third-party scripts at all, which
 * is the mitigation that matters.
 */

export interface ProviderPreset {
  id: string;
  label: string;
  baseUrl: string;
  model: string;
}

/**
 * Vendors that speak the OpenAI Chat Completions format. Default model names
 * are starting points — vendors rename models over time, so the field stays
 * editable. Whether a vendor accepts calls straight from a browser (CORS) is
 * the vendor's choice; when one refuses, the "custom" entry can point at a
 * proxy instead (see proxy/ in the repo).
 */
export const PRESETS: ProviderPreset[] = [
  { id: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
  { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  {
    id: 'qwen',
    label: '通义千问 Qwen',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
  },
  { id: 'moonshot', label: 'Kimi (Moonshot)', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'deepseek/deepseek-chat',
  },
  { id: 'custom', label: 'Custom', baseUrl: '', model: '' },
];

export interface ModelSettings {
  /** 'mock' or a preset id. */
  providerId: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  /** Let the model call tools (estimate_cost, calculate, get_current_time). */
  tools: boolean;
  /** Add semantic (embedding) search alongside BM25. */
  semantic: boolean;
}

export const DEFAULT_SETTINGS: ModelSettings = {
  providerId: 'mock',
  baseUrl: '',
  model: '',
  apiKey: '',
  tools: true,
  semantic: false,
};

const STORAGE_KEY = 'majlis.settings';

/** Storage can be unavailable (private mode, blocked site data); the page must still work. */
export function loadSettings(): ModelSettings {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<ModelSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: ModelSettings): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Not persisting is acceptable; losing the page is not.
  }
}

export function clearStoredSettings(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function isMock(settings: ModelSettings): boolean {
  return settings.providerId === 'mock' || settings.apiKey.trim().length === 0;
}

/**
 * Where the mock lives: the dev server in development, the tab itself in a
 * static build, or an explicitly configured endpoint (VITE_API_URL).
 */
function mockProvider(): Provider {
  const configured = import.meta.env?.VITE_API_URL as string | undefined;
  if (configured) return createMockProvider('http', configured);
  return import.meta.env?.DEV ? createMockProvider('http') : createMockProvider('local');
}

export function buildProvider(settings: ModelSettings): Provider {
  if (isMock(settings)) return mockProvider();
  return createOpenAiProvider({
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey.trim(),
    model: settings.model,
  });
}

/** A short "who is answering" label for the status line. */
export function describeProvider(settings: ModelSettings): string {
  if (isMock(settings)) return 'mock';
  const preset = PRESETS.find((p) => p.id === settings.providerId);
  return `${preset?.label ?? settings.baseUrl} · ${settings.model}`;
}
