export type Lang = 'en' | 'ar';

export interface Strings {
  title: string;
  tagline: string;
  placeholder: string;
  send: string;
  stop: string;
  retry: string;
  sources: string;
  noSources: string;
  retrieving: string;
  streaming: string;
  reconnecting: string;
  emptyState: string;
  emptyHint: string;
  droppedTurns: string;
  langLabel: string;
  cited: string;
  mockNotice: string;
}

const en: Strings = {
  title: 'Majlis',
  tagline: 'Streaming answers, with every claim traceable to its source.',
  placeholder: 'Ask about the rules of the game…',
  send: 'Send',
  stop: 'Stop',
  retry: 'Retry',
  sources: 'Sources',
  noSources: 'Nothing retrieved for this turn.',
  retrieving: 'Searching sources…',
  streaming: 'Answering…',
  reconnecting: 'Connection dropped — resuming…',
  emptyState: 'Ask a question to begin.',
  emptyHint: 'Try “what is offside?” — or add /drop to see the retry path.',
  droppedTurns: 'older turns trimmed to fit the context budget',
  langLabel: 'العربية',
  cited: 'Cited',
  mockNotice: 'Running against the bundled mock provider — no model is being called.',
};

const ar: Strings = {
  title: 'مجلس',
  tagline: 'إجابات متدفقة، مع إمكانية تتبّع كل معلومة إلى مصدرها.',
  placeholder: 'اسأل عن قوانين اللعبة…',
  send: 'إرسال',
  stop: 'إيقاف',
  retry: 'إعادة المحاولة',
  sources: 'المصادر',
  noSources: 'لم يتم استرجاع أي مصدر لهذه الإجابة.',
  retrieving: 'جارٍ البحث في المصادر…',
  streaming: 'جارٍ الإجابة…',
  reconnecting: 'انقطع الاتصال — جارٍ الاستئناف…',
  emptyState: 'اطرح سؤالاً للبدء.',
  emptyHint: 'جرّب «ما هو التسلل؟» — أو أضف ‎/drop‎ لرؤية مسار إعادة المحاولة.',
  droppedTurns: 'تم اختصار الرسائل الأقدم لتناسب حدود السياق',
  langLabel: 'English',
  cited: 'مُستشهد به',
  mockNotice: 'يعمل التطبيق مع المزود التجريبي المدمج — لا يتم استدعاء أي نموذج.',
};

export const STRINGS: Record<Lang, Strings> = { en, ar };

export const DIR: Record<Lang, 'ltr' | 'rtl'> = { en: 'ltr', ar: 'rtl' };
