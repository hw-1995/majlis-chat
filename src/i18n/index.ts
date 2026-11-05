export type Lang = 'en' | 'zh' | 'ar';

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
  /** Example questions shown on the empty screen; each one is clickable. */
  examples: string[];
  droppedTurns: string;
  cited: string;
  mockNotice: string;
  corpusNotice: string;
}

const en: Strings = {
  title: 'Majlis',
  tagline: 'Streaming answers, with every claim traceable to its source.',
  placeholder: 'Ask the Qalam Notes help centre…',
  send: 'Send',
  stop: 'Stop',
  retry: 'Retry',
  sources: 'Sources',
  noSources: 'Nothing relevant was found for this question.',
  retrieving: 'Searching sources…',
  streaming: 'Answering…',
  reconnecting: 'Connection dropped — resuming…',
  emptyState: 'Ask a question to begin.',
  emptyHint: 'Try one of these — or add /drop to any question to watch the retry path.',
  examples: [
    'How much does Pro cost?',
    'How do I reset my password?',
    'Can I get a refund after renewing?',
    'Who won the 2022 World Cup?',
  ],
  droppedTurns: 'older turns trimmed to fit the context budget',
  cited: 'Cited',
  mockNotice: 'Running against the bundled mock provider — no model is being called.',
  corpusNotice: 'Knowledge base: help articles for Qalam Notes, a fictional product.',
};

const zh: Strings = {
  title: 'Majlis',
  tagline: '流式回答，每一句都能追溯到出处。',
  placeholder: '向 Qalam Notes 帮助中心提问…',
  send: '发送',
  stop: '停止',
  retry: '重试',
  sources: '参考资料',
  noSources: '没有找到与这个问题相关的资料。',
  retrieving: '正在检索资料…',
  streaming: '正在回答…',
  reconnecting: '连接中断，正在恢复…',
  emptyState: '提一个问题开始吧。',
  emptyHint: '可以试试下面的问题；在任意问题后面加 /drop，可以看到断线续接。',
  examples: ['专业版每月多少钱', '怎么重置密码', '注销账号以后还能恢复吗', '怎样才能快速致富'],
  droppedTurns: '条较早的对话因上下文预算被裁掉',
  cited: '已引用',
  mockNotice: '当前连接的是内置模拟服务，没有调用任何模型。',
  corpusNotice: '知识库：Qalam Notes（虚构产品）的帮助中心文章。',
};

const ar: Strings = {
  title: 'مجلس',
  tagline: 'إجابات متدفقة، مع إمكانية تتبّع كل معلومة إلى مصدرها.',
  placeholder: 'اسأل مركز مساعدة Qalam Notes…',
  send: 'إرسال',
  stop: 'إيقاف',
  retry: 'إعادة المحاولة',
  sources: 'المصادر',
  noSources: 'لم يتم العثور على مصادر ذات صلة بهذا السؤال.',
  retrieving: 'جارٍ البحث في المصادر…',
  streaming: 'جارٍ الإجابة…',
  reconnecting: 'انقطع الاتصال — جارٍ الاستئناف…',
  emptyState: 'اطرح سؤالاً للبدء.',
  emptyHint: 'جرّب أحد هذه الأسئلة — أو أضف ‎/drop‎ إلى أي سؤال لرؤية مسار إعادة المحاولة.',
  examples: ['كيف أعيد تعيين كلمة المرور؟', 'تصدير الملاحظات', 'هل يمكن استرداد المال؟', 'ما هذا'],
  droppedTurns: 'تم اختصار الرسائل الأقدم لتناسب حدود السياق',
  cited: 'مُستشهد به',
  mockNotice: 'يعمل التطبيق مع المزود التجريبي المدمج — لا يتم استدعاء أي نموذج.',
  corpusNotice: 'قاعدة المعرفة: مقالات المساعدة لتطبيق Qalam Notes، وهو منتج خيالي.',
};

export const STRINGS: Record<Lang, Strings> = { en, zh, ar };

export const DIR: Record<Lang, 'ltr' | 'rtl'> = { en: 'ltr', zh: 'ltr', ar: 'rtl' };

/** Labels for the language switcher, each written in its own language. */
export const LANG_NAMES: Record<Lang, string> = { en: 'English', zh: '中文', ar: 'العربية' };
