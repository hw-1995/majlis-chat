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
  liveNotice: string;
  corpusNotice: string;
  settings: {
    title: string;
    provider: string;
    mock: string;
    baseUrl: string;
    model: string;
    apiKey: string;
    show: string;
    hide: string;
    clearKey: string;
    keyNote: string;
    corsNote: string;
    newChat: string;
  };
  tools: {
    toggle: string;
    hint: string;
    running: string;
    failed: string;
    /** Human names for each tool, shown on the step card. */
    names: Record<string, string>;
  };
  errors: Record<'auth' | 'rate_limit' | 'network' | 'bad_request' | 'server' | 'unknown', string>;
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
    'What would Team cost for 5 people for a year?',
  ],
  droppedTurns: 'older turns trimmed to fit the context budget',
  cited: 'Cited',
  mockNotice: 'Running against the bundled mock provider — no model is being called.',
  corpusNotice: 'Knowledge base: help articles for Qalam Notes, a fictional product.',
  liveNotice: 'Answers come from {provider}, called directly from your browser with your own key.',
  settings: {
    title: 'Model settings',
    provider: 'Provider',
    mock: 'Built-in mock (no key needed)',
    baseUrl: 'Base URL',
    model: 'Model',
    apiKey: 'API key',
    show: 'Show',
    hide: 'Hide',
    clearKey: 'Clear key',
    keyNote:
      'Your key stays in this browser tab (sessionStorage) and is cleared when the tab closes. It is sent only to the provider above — never to this site.',
    corsNote:
      'Some providers refuse requests made directly from a browser. If you see a network error, try another provider or point "Custom" at your own proxy.',
    newChat: 'New chat',
  },
  tools: {
    toggle: 'Allow tool calls',
    hint: 'The model may ask the page to run a price calculator, a calculator or a clock, then answer from the result.',
    running: 'running…',
    failed: 'failed',
    names: { estimate_cost: 'Price calculator', calculate: 'Calculator', get_current_time: 'Clock' },
  },
  errors: {
    auth: 'The provider rejected the API key. Check that it is correct and has credit.',
    rate_limit: 'The provider says the rate limit or quota has been reached.',
    network:
      'Could not reach the provider. It may not allow requests from a browser (CORS), or the network is down.',
    bad_request: 'The provider rejected the request — the model name may be wrong.',
    server: 'The provider had a problem answering. Please try again.',
    unknown: 'Something went wrong.',
  },
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
  examples: ['专业版每月多少钱', '怎么重置密码', '注销账号以后还能恢复吗', '怎样才能快速致富', '团队版 5 个人用一年多少钱'],
  droppedTurns: '条较早的对话因上下文预算被裁掉',
  cited: '已引用',
  mockNotice: '当前连接的是内置模拟服务，没有调用任何模型。',
  corpusNotice: '知识库：Qalam Notes（虚构产品）的帮助中心文章。',
  liveNotice: '回答来自 {provider}，由你的浏览器用你自己的 Key 直接调用。',
  settings: {
    title: '模型设置',
    provider: '服务商',
    mock: '内置模拟服务（无需 Key）',
    baseUrl: '接口地址',
    model: '模型',
    apiKey: 'API Key',
    show: '显示',
    hide: '隐藏',
    clearKey: '清除 Key',
    keyNote:
      'Key 只保存在当前浏览器标签页（sessionStorage），关闭标签页即清除；只会发送给上面的服务商，不会发送给本网站。',
    corsNote:
      '部分服务商不允许浏览器直接调用。如果出现网络错误，可以换一个服务商，或在「自定义」里填写你自己的代理地址。',
    newChat: '新对话',
  },
  tools: {
    toggle: '允许工具调用',
    hint: '模型可以让页面运行价格计算器、计算器或时钟，再根据结果作答。',
    running: '运行中…',
    failed: '失败',
    names: { estimate_cost: '价格计算器', calculate: '计算器', get_current_time: '时钟' },
  },
  errors: {
    auth: '服务商拒绝了这个 API Key，请检查 Key 是否正确、账户是否有余额。',
    rate_limit: '服务商提示已达到调用频率或额度上限。',
    network: '无法连接服务商：可能该服务商不允许浏览器直接调用（CORS），或网络不通。',
    bad_request: '服务商拒绝了请求，可能是模型名称填写有误。',
    server: '服务商处理请求时出错，请重试。',
    unknown: '出错了。',
  },
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
  examples: ['كيف أعيد تعيين كلمة المرور؟', 'تصدير الملاحظات', 'هل يمكن استرداد المال؟', 'ما هذا', 'كم تكلفة خطة Team لـ 5 أعضاء لمدة سنة؟'],
  droppedTurns: 'تم اختصار الرسائل الأقدم لتناسب حدود السياق',
  cited: 'مُستشهد به',
  mockNotice: 'يعمل التطبيق مع المزود التجريبي المدمج — لا يتم استدعاء أي نموذج.',
  corpusNotice: 'قاعدة المعرفة: مقالات المساعدة لتطبيق Qalam Notes، وهو منتج خيالي.',
  liveNotice: 'تأتي الإجابات من {provider}، ويتم الاتصال به مباشرة من متصفحك باستخدام مفتاحك.',
  settings: {
    title: 'إعدادات النموذج',
    provider: 'المزوّد',
    mock: 'المزوّد التجريبي المدمج (بلا مفتاح)',
    baseUrl: 'عنوان الواجهة',
    model: 'النموذج',
    apiKey: 'مفتاح API',
    show: 'إظهار',
    hide: 'إخفاء',
    clearKey: 'مسح المفتاح',
    keyNote:
      'يبقى مفتاحك في علامة التبويب هذه فقط (sessionStorage) ويُمسح عند إغلاقها، ولا يُرسل إلا إلى المزوّد أعلاه وليس إلى هذا الموقع.',
    corsNote:
      'بعض المزوّدين يرفضون الطلبات المرسلة مباشرة من المتصفح. إذا ظهر خطأ في الشبكة فجرّب مزوّداً آخر أو استخدم «مخصص» مع وكيلك الخاص.',
    newChat: 'محادثة جديدة',
  },
  tools: {
    toggle: 'السماح باستدعاء الأدوات',
    hint: 'يمكن للنموذج أن يطلب من الصفحة تشغيل حاسبة الأسعار أو الآلة الحاسبة أو الساعة، ثم يجيب بناءً على النتيجة.',
    running: 'قيد التشغيل…',
    failed: 'فشل',
    names: { estimate_cost: 'حاسبة الأسعار', calculate: 'الآلة الحاسبة', get_current_time: 'الساعة' },
  },
  errors: {
    auth: 'رفض المزوّد مفتاح API. تأكد من صحته ومن وجود رصيد.',
    rate_limit: 'يفيد المزوّد بأنه تم بلوغ حد الطلبات أو الحصة.',
    network: 'تعذّر الوصول إلى المزوّد؛ ربما لا يسمح بالطلبات من المتصفح (CORS) أو أن الشبكة منقطعة.',
    bad_request: 'رفض المزوّد الطلب، وقد يكون اسم النموذج غير صحيح.',
    server: 'واجه المزوّد مشكلة في الإجابة. حاول مرة أخرى.',
    unknown: 'حدث خطأ ما.',
  },
};

export const STRINGS: Record<Lang, Strings> = { en, zh, ar };

export const DIR: Record<Lang, 'ltr' | 'rtl'> = { en: 'ltr', zh: 'ltr', ar: 'rtl' };

/** Labels for the language switcher, each written in its own language. */
export const LANG_NAMES: Record<Lang, string> = { en: 'English', zh: '中文', ar: 'العربية' };
