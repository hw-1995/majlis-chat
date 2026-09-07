/**
 * The mock provider's answer composition, shared by the dev-server middleware
 * and the in-browser fallback so a deployed static build behaves identically
 * to `npm run dev`.
 */

export interface MockSource {
  title: string;
  text: string;
}

export function isArabic(text: string): boolean {
  return /[؀-ۿ]/.test(text);
}

function firstSentence(text: string): string {
  const match = text.match(/^[^.。!؟?]+/);
  return (match ? match[0] : text).trim();
}

/** A deterministic answer that cites the sources it was handed. */
export function composeAnswer(question: string, sources: MockSource[]): string {
  const arabic = isArabic(question);

  if (sources.length === 0) {
    return arabic
      ? 'لم يتم العثور على مصادر مطابقة لهذا السؤال. جرّب صياغة أخرى. (هذه استجابة من المزود التجريبي المدمج.)'
      : 'No source in the indexed corpus matches that question. Try different wording. (Reply produced by the bundled mock provider — no model was called.)';
  }

  const cited = sources
    .slice(0, 3)
    .map((source, i) => `${firstSentence(source.text)} [${i + 1}]`)
    .join(arabic ? '. و' : '. ');

  return arabic
    ? `بناءً على المصادر المسترجعة: ${cited}. (هذه استجابة من المزود التجريبي المدمج ولم يتم استدعاء أي نموذج.)`
    : `Based on the retrieved sources: ${cited}. (Reply produced by the bundled mock provider — no model was called.)`;
}

/** Split into tokens that keep trailing whitespace, so the stream reads naturally. */
export function toTokens(text: string): string[] {
  return text.match(/\S+\s*/g) ?? [];
}

export const TOKEN_DELAY_MS = 28;
