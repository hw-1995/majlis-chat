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
  /** For tool results: which tool produced this content. */
  name?: string;
}

/** What the mock decides to do with a request. */
export type MockReply =
  | { kind: 'text'; text: string }
  | { kind: 'tool_call'; name: string; arguments: string };

const lastUserQuestion = (turns: MockTurn[]): string =>
  [...turns].reverse().find((t) => t.role === 'user')?.content ?? '';

/**
 * Decide whether the question needs a tool, the way a real model would —
 * only far more crudely: a few patterns per language. Real tool choice is the
 * model's job; this exists so that a visitor without an API key can still see
 * the tool-calling flow end to end.
 */
export function pickMockTool(question: string): { name: string; arguments: string } | null {
  const q = question.toLowerCase();
  const number = q.match(/\d+/)?.[0];

  const mentionsTeam = /team|团队|فريق/.test(q);
  const mentionsPro = /\bpro\b|专业版/.test(q);
  const mentionsCost = /cost|price|how much|多少钱|价格|费用|كم|تكلف|سعر/.test(q);
  if ((mentionsTeam || mentionsPro) && mentionsCost && number) {
    const yearly = /year|annual|一年|年付|按年|سنة|سنوي/.test(q);
    return {
      name: 'estimate_cost',
      arguments: JSON.stringify({
        plan: mentionsTeam ? 'team' : 'pro',
        seats: mentionsTeam ? Number(number) : 1,
        months: yearly ? 12 : mentionsTeam ? 1 : Number(number),
        billing: yearly ? 'yearly' : 'monthly',
      }),
    };
  }

  const expression = question.match(/[\d.]+(?:\s*[-+*/×÷^%]\s*\(?\s*[\d.]+\s*\)?)+/)?.[0];
  if (expression) {
    return { name: 'calculate', arguments: JSON.stringify({ expression: expression.trim() }) };
  }

  if (/what time|current time|today'?s date|几点|现在时间|今天几号|الساعة|الوقت الآن/.test(q)) {
    return { name: 'get_current_time', arguments: '{}' };
  }
  return null;
}

const TOOL_LEAD: Record<ReplyLang, string> = {
  en: 'Calculated with the {tool} tool: ',
  zh: '通过 {tool} 工具计算：',
  ar: 'تم الحساب باستخدام أداة {tool}: ',
};

function describeToolResult(name: string, raw: string, lang: ReplyLang, citePrice: string): string {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return raw;
  }
  if (typeof data.error === 'string') {
    return { en: `The tool reported an error: ${data.error}`, zh: `工具返回错误：${data.error}`, ar: `أبلغت الأداة عن خطأ: ${data.error}` }[lang];
  }
  if (name === 'estimate_cost') {
    const { plan, seats, months, billing, total_usd } = data as Record<string, string | number>;
    const yearly = billing === 'yearly';
    return {
      en: `${seats} × ${plan} for ${months} months${yearly ? ', billed yearly (12 months for the price of 10)' : ''}, comes to $${total_usd}${citePrice}.`,
      zh: `${plan} 套餐 ${seats} 人、${months} 个月${yearly ? '，按年付费（12 个月只收 10 个月）' : ''}，合计 ${total_usd} 美元${citePrice}。`,
      ar: `${seats} × ${plan} لمدة ${months} شهراً${yearly ? '، بالدفع السنوي (12 شهراً بسعر 10)' : ''}، المجموع ${total_usd} دولاراً${citePrice}.`,
    }[lang];
  }
  if (name === 'calculate') {
    return { en: `${data.expression} = ${data.result}.`, zh: `${data.expression} = ${data.result}。`, ar: `${data.expression} = ${data.result}.` }[lang];
  }
  if (name === 'get_current_time') {
    return { en: `It is now ${data.local}.`, zh: `现在是 ${data.local}。`, ar: `الوقت الآن ${data.local}.` }[lang];
  }
  return raw;
}

/**
 * Decide the mock's reply. Shared by the dev-server middleware and the
 * in-browser provider, so both transports behave identically.
 *
 * With tools enabled it behaves like a (very literal) agent: first turn asks
 * for a tool when the question needs one; once the tool result is in the
 * conversation, it writes the answer from it.
 */
export function planMockReply(
  turns: MockTurn[],
  sources: MockSource[],
  toolsEnabled = false,
): MockReply {
  const question = lastUserQuestion(turns);
  const lang = detectLang(question);
  const last = turns[turns.length - 1];

  if (last?.role === 'tool') {
    // Cite the pricing article when it was retrieved, so the computed price
    // still points at the source it was computed from.
    const priceIndex = sources.findIndex((s) => /\$8|8 美元|8 دولار/.test(s.text));
    const cite = priceIndex >= 0 ? ` [${priceIndex + 1}]` : '';
    const body = describeToolResult(last.name ?? '', last.content, lang, cite);
    return { kind: 'text', text: `${TOOL_LEAD[lang].replace('{tool}', last.name ?? 'tool')}${body} ${MOCK_LABEL[lang]}` };
  }

  if (toolsEnabled) {
    const tool = pickMockTool(question);
    if (tool) return { kind: 'tool_call', ...tool };
  }
  return { kind: 'text', text: composeAnswer(question, sources) };
}

/** The `/drop` demo affordance: cut the first attempt off halfway. */
export function shouldDrop(turns: MockTurn[], resumeFrom: string): boolean {
  // Only the first answer to a question drops, not the follow-up after a tool.
  const last = turns[turns.length - 1];
  return last?.role === 'user' && last.content.includes('/drop') && resumeFrom.length === 0;
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
