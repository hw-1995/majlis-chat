import { tokenize } from './bm25';

/**
 * The mock provider's answer composition, shared by the dev-server middleware
 * and the in-browser fallback so a deployed static build behaves identically
 * to `npm run dev`.
 */

export interface MockSource {
  title: string;
  text: string;
}

/** The subset of a conversation turn the mock needs to read. */
export interface MockTurn {
  role: string;
  content: string;
}

/** What the mock decides to do with a request. */
export type MockReply = { kind: 'text'; text: string };

/**
 * Decide the mock's reply. Shared by the dev-server middleware and the
 * in-browser provider, so both transports behave identically.
 */
export function planMockReply(turns: MockTurn[], sources: MockSource[]): MockReply {
  const question = [...turns].reverse().find((t) => t.role === 'user')?.content ?? '';
  return { kind: 'text', text: composeAnswer(question, sources) };
}

/** The `/drop` demo affordance: cut the first attempt off halfway. */
export function shouldDrop(turns: MockTurn[], resumeFrom: string): boolean {
  const question = [...turns].reverse().find((t) => t.role === 'user')?.content ?? '';
  return question.includes('/drop') && resumeFrom.length === 0;
}

export function isArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

export function isChinese(text: string): boolean {
  return /\p{Script=Han}/u.test(text);
}

type ReplyLang = 'en' | 'zh' | 'ar';

export function detectLang(text: string): ReplyLang {
  if (isArabic(text)) return 'ar';
  if (isChinese(text)) return 'zh';
  return 'en';
}

function sentences(text: string): string[] {
  return (text.match(/[^.。!！؟?]+/g) ?? [text]).map((s) => s.trim()).filter(Boolean);
}

/**
 * Pick the sentence of a passage that shares the most terms with the question
 * — a crude extractive answer, so the mock quotes the line about price when
 * asked about price instead of always quoting the opening line.
 */
export function bestSentence(question: string, text: string): string {
  const wanted = new Set(tokenize(question));
  let best = '';
  let bestScore = -1;
  for (const sentence of sentences(text)) {
    const score = tokenize(sentence).filter((t) => wanted.has(t)).length;
    if (score > bestScore) {
      best = sentence;
      bestScore = score;
    }
  }
  return best;
}

const MOCK_LABEL: Record<ReplyLang, string> = {
  en: '(Reply produced by the bundled mock provider — no model was called.)',
  zh: '（这是内置模拟服务的回答，没有调用任何模型。）',
  ar: '(هذه استجابة من المزود التجريبي المدمج ولم يتم استدعاء أي نموذج.)',
};

const NO_SOURCE: Record<ReplyLang, string> = {
  en: "The knowledge base doesn't cover that question, so I can't answer it from the sources. Try asking about plans, refunds, passwords, exporting or storage.",
  zh: '知识库里没有与这个问题相关的内容，所以无法根据资料回答。可以试着问套餐价格、退款、重置密码、导出笔记或存储空间。',
  ar: 'لا تغطي قاعدة المعرفة هذا السؤال، لذلك لا يمكنني الإجابة عنه من المصادر. جرّب السؤال عن الخطط أو الاسترداد أو كلمة المرور أو التصدير أو التخزين.',
};

const LEAD: Record<ReplyLang, string> = {
  en: 'Based on the retrieved sources: ',
  zh: '根据检索到的资料：',
  ar: 'بناءً على المصادر المسترجعة: ',
};

/**
 * A deterministic answer that cites the sources it was handed.
 *
 * When nothing relevant was retrieved it says so instead of improvising — the
 * same behaviour the system prompt asks of a real model.
 */
export function composeAnswer(question: string, sources: MockSource[]): string {
  const lang = detectLang(question);
  if (sources.length === 0) return `${NO_SOURCE[lang]} ${MOCK_LABEL[lang]}`;

  const joiner = lang === 'zh' ? '；' : lang === 'ar' ? '. و' : '. ';
  const end = lang === 'zh' ? '。' : '.';
  const cited = sources
    .slice(0, 3)
    .map((source, i) => `${bestSentence(question, source.text)} [${i + 1}]`)
    .join(joiner);
  return `${LEAD[lang]}${cited}${end} ${MOCK_LABEL[lang]}`;
}

/** Split into tokens that keep trailing whitespace, so the stream reads naturally. */
export function toTokens(text: string): string[] {
  // Chinese has no spaces, so word-sized chunks would arrive as whole
  // sentences; Han text streams two characters at a time instead.
  if (isChinese(text)) {
    return text.match(/\p{Script=Han}{1,2}|[^\p{Script=Han}\s]+\s*|\s+/gu) ?? [];
  }
  return text.match(/\S+\s*/g) ?? [];
}

export const TOKEN_DELAY_MS = 28;
