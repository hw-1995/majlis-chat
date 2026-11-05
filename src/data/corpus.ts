import type { SourceDoc } from '../types';

/**
 * Help-centre articles for Qalam Notes — a fictional note-taking product
 * invented for this demo. Nothing here describes a real company.
 *
 * Every topic exists in English, Chinese and Arabic. That is deliberate:
 *   - lexical retrieval (BM25) has to cope with three very different scripts —
 *     space-separated English, unsegmented Chinese, and Arabic with its
 *     orthographic variants;
 *   - semantic retrieval can then show what lexical search cannot: a question
 *     asked in one language finding the answer written in another.
 *
 * The numbers (prices, limits, time windows) are concrete on purpose, so a
 * citation can be checked against a fact rather than a vague sentence, and so
 * the `estimate_cost` tool has a price list to agree with.
 */

type Lang = SourceDoc['lang'];
type Entry = Record<Lang, { title: string; text: string }>;

const TOPICS: Record<string, Entry> = {
  plans: {
    en: {
      title: 'Plans and pricing',
      text: 'Qalam Notes has three plans. Free costs nothing and includes 1 GB of storage. Pro costs $8 per month for one person. Team costs $12 per member per month and adds shared workspaces and admin controls. Paying yearly gives two months free.',
    },
    zh: {
      title: '套餐与价格',
      text: 'Qalam Notes 有三种套餐。免费版不收费，包含 1 GB 存储空间。专业版（Pro）每人每月 8 美元。团队版（Team）每位成员每月 12 美元，增加共享空间和管理员功能。按年付费可免两个月费用。',
    },
    ar: {
      title: 'الخطط والأسعار',
      text: 'يقدّم Qalam Notes ثلاث خطط. الخطة المجانية بلا تكلفة وتتضمن 1 غيغابايت من التخزين. خطة Pro بسعر 8 دولارات شهرياً لشخص واحد. خطة Team بسعر 12 دولاراً لكل عضو شهرياً، وتضيف مساحات عمل مشتركة وأدوات للمسؤول. الدفع السنوي يمنحك شهرين مجاناً.',
    },
  },
  trial: {
    en: {
      title: 'Free trial',
      text: 'Every new account can try Pro free for 14 days. No credit card is needed to start the trial. When the trial ends, the account moves back to the Free plan and no notes are deleted.',
    },
    zh: {
      title: '免费试用',
      text: '每个新账号都可以免费试用专业版 14 天。开始试用不需要绑定信用卡。试用结束后，账号会自动回到免费版，笔记不会被删除。',
    },
    ar: {
      title: 'الفترة التجريبية المجانية',
      text: 'يمكن لكل حساب جديد تجربة خطة Pro مجاناً لمدة 14 يوماً. لا تحتاج إلى بطاقة ائتمان لبدء التجربة. عند انتهاء التجربة يعود الحساب إلى الخطة المجانية ولا تُحذف أي ملاحظات.',
    },
  },
  refund: {
    en: {
      title: 'Refunds',
      text: 'A first payment can be refunded in full within 30 days. Renewals can be refunded within 7 days of the renewal date. Refunds go back to the original payment method and usually arrive within 5 to 10 business days.',
    },
    zh: {
      title: '退款政策',
      text: '首次付款后 30 天内可申请全额退款。续费后 7 天内可申请退款。退款会原路退回到付款方式，通常在 5 到 10 个工作日内到账。',
    },
    ar: {
      title: 'استرداد الأموال',
      text: 'يمكن استرداد الدفعة الأولى بالكامل خلال 30 يوماً. ويمكن استرداد رسوم التجديد خلال 7 أيام من تاريخ التجديد. تُعاد المبالغ إلى وسيلة الدفع الأصلية وتصل عادةً خلال 5 إلى 10 أيام عمل.',
    },
  },
  password: {
    en: {
      title: 'Resetting your password',
      text: 'To reset your password, choose "Forgot password" on the sign-in page and enter your email address. The reset link is valid for 30 minutes. If two-factor authentication is on, you will still need your second factor after resetting.',
    },
    zh: {
      title: '重置密码',
      text: '如需重置密码，请在登录页点击「忘记密码」并输入邮箱地址。重置链接 30 分钟内有效。如果开启了两步验证，重置密码后仍然需要第二步验证。',
    },
    ar: {
      title: 'إعادة تعيين كلمة المرور',
      text: 'لإعادة تعيين كلمة المرور، اختر «نسيت كلمة المرور» في صفحة تسجيل الدخول وأدخل بريدك الإلكتروني. رابط إعادة التعيين صالح لمدة 30 دقيقة. إذا كانت المصادقة الثنائية مفعّلة فستحتاج إليها بعد إعادة التعيين أيضاً.',
    },
  },
  twoFactor: {
    en: {
      title: 'Two-factor authentication',
      text: 'Two-factor authentication works with any authenticator app. When you turn it on you receive 10 one-time backup codes; each code can be used once. Team admins can require two-factor authentication for every member.',
    },
    zh: {
      title: '两步验证',
      text: '两步验证支持任意身份验证器应用。开启后会获得 10 个一次性备用码，每个只能使用一次。团队版管理员可以要求所有成员必须开启两步验证。',
    },
    ar: {
      title: 'المصادقة الثنائية',
      text: 'تعمل المصادقة الثنائية مع أي تطبيق مصادقة. عند تفعيلها تحصل على 10 رموز احتياطية يُستخدم كل منها مرة واحدة فقط. يمكن لمسؤولي خطة Team فرض المصادقة الثنائية على جميع الأعضاء.',
    },
  },
  export: {
    en: {
      title: 'Exporting your notes',
      text: 'Any note can be exported as Markdown, PDF or HTML. A whole workspace can be exported as a single ZIP file from Settings. On the Team plan, only admins can export a shared workspace.',
    },
    zh: {
      title: '导出笔记',
      text: '任意笔记都可以导出为 Markdown、PDF 或 HTML 格式。整个工作区可以在「设置」中导出为一个 ZIP 压缩包。团队版中，只有管理员可以导出共享工作区。',
    },
    ar: {
      title: 'تصدير الملاحظات',
      text: 'يمكن تصدير أي ملاحظة بصيغة Markdown أو PDF أو HTML. ويمكن تصدير مساحة العمل بالكامل كملف ZIP واحد من الإعدادات. في خطة Team يستطيع المسؤولون فقط تصدير مساحة العمل المشتركة.',
    },
  },
  offline: {
    en: {
      title: 'Working offline',
      text: 'The desktop and mobile apps work offline. Changes sync automatically when you reconnect. If the same note was edited on two devices, both versions are kept so nothing is lost. The web version needs an internet connection.',
    },
    zh: {
      title: '离线使用',
      text: '桌面端和手机端应用支持离线使用，重新联网后自动同步。如果同一条笔记在两台设备上都被修改，两个版本都会保留，不会丢失内容。网页版需要联网才能使用。',
    },
    ar: {
      title: 'العمل دون اتصال',
      text: 'تعمل تطبيقات سطح المكتب والهاتف دون اتصال بالإنترنت، وتتم المزامنة تلقائياً عند عودة الاتصال. إذا عُدّلت الملاحظة نفسها على جهازين يُحتفظ بالنسختين حتى لا يضيع شيء. أما نسخة الويب فتحتاج إلى اتصال بالإنترنت.',
    },
  },
  sharing: {
    en: {
      title: 'Sharing and permissions',
      text: 'Notes can be shared with three permission levels: view, comment and edit. Share links can be given an expiry date. Removing someone from a note takes effect immediately.',
    },
    zh: {
      title: '共享与权限',
      text: '笔记共享有三种权限：仅查看、可评论、可编辑。共享链接可以设置过期时间。把某人从笔记中移除后立即生效。',
    },
    ar: {
      title: 'المشاركة والصلاحيات',
      text: 'يمكن مشاركة الملاحظات بثلاثة مستويات من الصلاحيات: العرض والتعليق والتحرير. ويمكن تحديد تاريخ انتهاء لروابط المشاركة. وإزالة أي شخص من الملاحظة تسري فوراً.',
    },
  },
  storage: {
    en: {
      title: 'Storage limits',
      text: 'Free accounts include 1 GB of storage, Pro includes 50 GB, and Team includes 200 GB per member. A single attachment can be up to 100 MB on any plan.',
    },
    zh: {
      title: '存储空间',
      text: '免费版包含 1 GB 存储空间，专业版 50 GB，团队版每位成员 200 GB。任何套餐中，单个附件最大 100 MB。',
    },
    ar: {
      title: 'حدود التخزين',
      text: 'تتضمن الخطة المجانية 1 غيغابايت من التخزين، وخطة Pro تتضمن 50 غيغابايت، وخطة Team تتضمن 200 غيغابايت لكل عضو. الحد الأقصى للمرفق الواحد 100 ميغابايت في جميع الخطط.',
    },
  },
  api: {
    en: {
      title: 'API rate limits',
      text: 'The API allows 60 requests per minute for each access token. Requests over the limit receive HTTP 429 with a Retry-After header saying how many seconds to wait.',
    },
    zh: {
      title: 'API 调用频率限制',
      text: 'API 每个访问令牌每分钟最多 60 次请求。超出限制的请求会收到 HTTP 429，响应头 Retry-After 会说明需要等待多少秒。',
    },
    ar: {
      title: 'حدود استخدام واجهة API',
      text: 'تسمح واجهة API بـ 60 طلباً في الدقيقة لكل رمز وصول. الطلبات التي تتجاوز الحد تتلقى الرمز HTTP 429 مع ترويسة Retry-After التي تحدد عدد الثواني اللازم انتظارها.',
    },
  },
  deleteAccount: {
    en: {
      title: 'Deleting your account',
      text: 'You can delete your account from Settings. Deleted accounts can be restored for 30 days; after that, all notes and attachments are removed permanently. Export your notes first if you want a copy.',
    },
    zh: {
      title: '注销账号',
      text: '可以在「设置」中注销账号。注销后 30 天内可以恢复，超过 30 天，所有笔记和附件将被永久删除。如需保留副本，请先导出笔记。',
    },
    ar: {
      title: 'حذف الحساب',
      text: 'يمكنك حذف حسابك من الإعدادات. ويمكن استعادة الحساب المحذوف خلال 30 يوماً، وبعدها تُحذف جميع الملاحظات والمرفقات نهائياً. صدّر ملاحظاتك أولاً إذا أردت الاحتفاظ بنسخة.',
    },
  },
  languages: {
    en: {
      title: 'Supported languages',
      text: 'The apps are available in English, Chinese and Arabic. When Arabic is selected, the whole interface switches to right-to-left. Notes themselves can be written in any language.',
    },
    zh: {
      title: '支持的语言',
      text: '应用支持英文、中文和阿拉伯语界面。选择阿拉伯语时，整个界面会切换为从右到左显示。笔记本身可以用任何语言书写。',
    },
    ar: {
      title: 'اللغات المدعومة',
      text: 'تتوفر التطبيقات باللغات الإنجليزية والصينية والعربية. عند اختيار العربية تتحول الواجهة بالكامل إلى الاتجاه من اليمين إلى اليسار. ويمكن كتابة الملاحظات نفسها بأي لغة.',
    },
  },
};

const LANGS: Lang[] = ['en', 'zh', 'ar'];

export const CORPUS: SourceDoc[] = Object.entries(TOPICS).flatMap(([topic, entry]) =>
  LANGS.map((lang) => ({
    id: `${topic}-${lang}`,
    topic,
    lang,
    title: entry[lang].title,
    text: entry[lang].text,
  })),
);

/**
 * The price list the `estimate_cost` tool computes from. It mirrors the
 * "Plans and pricing" article — a tool answer that disagreed with the cited
 * source would be exactly the kind of inconsistency a reader should catch.
 */
export const PRICING = {
  free: 0,
  pro: 8,
  team: 12,
  /** Paying yearly: 12 months for the price of 10. */
  yearlyMonthsCharged: 10,
} as const;
