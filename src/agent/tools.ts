import { PRICING } from '../data/corpus';
import type { ToolSpec } from '../gateway/types';
import { evaluate } from './calculator';

/**
 * Tools the model may call.
 *
 * The model never runs anything itself: it replies with a structured request
 * ("call estimate_cost with these arguments"), this code runs it in the
 * browser, and the result goes back to the model to phrase an answer. Every
 * tool here is read-only and side-effect free, so there is nothing to confirm
 * before running it; a tool that changed something (issuing a refund, say)
 * would need the user's explicit approval first.
 *
 * Why give a model a calculator at all: language models predict text, and a
 * price that "looks right" is not the same as a price that is right. Doing the
 * arithmetic in code makes the number exact and consistent with the price list.
 */

export const TOOL_SPECS: ToolSpec[] = [
  {
    name: 'estimate_cost',
    description:
      'Calculate the exact price of a Qalam Notes subscription. Use this for any question about how much a plan costs for a number of people or months — do not do the arithmetic yourself.',
    parameters: {
      type: 'object',
      properties: {
        plan: { type: 'string', enum: ['free', 'pro', 'team'], description: 'The plan.' },
        seats: { type: 'integer', minimum: 1, description: 'Number of people. Defaults to 1.' },
        months: { type: 'integer', minimum: 1, description: 'Length of the subscription in months. Defaults to 1.' },
        billing: {
          type: 'string',
          enum: ['monthly', 'yearly'],
          description: 'Yearly billing charges 10 months for every 12. Defaults to monthly.',
        },
      },
      required: ['plan'],
    },
  },
  {
    name: 'calculate',
    description: 'Evaluate an arithmetic expression using + - * / % ^ and parentheses, for example "(12 * 5) / 4".',
    parameters: {
      type: 'object',
      properties: { expression: { type: 'string', description: 'The expression to evaluate.' } },
      required: ['expression'],
    },
  },
  {
    name: 'get_current_time',
    description: 'Get the current date and time, optionally in a given IANA time zone such as "Asia/Shanghai".',
    parameters: {
      type: 'object',
      properties: { timezone: { type: 'string', description: 'IANA time zone name. Defaults to the user’s own.' } },
    },
  },
];

type Args = Record<string, unknown>;

function parseArgs(raw: string): Args {
  if (raw.trim().length === 0) return {};
  const parsed: unknown = JSON.parse(raw);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Arguments must be a JSON object');
  }
  return parsed as Args;
}

function positiveInt(value: unknown, fallback: number, name: string): number {
  if (value === undefined || value === null) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new Error(`${name} must be a whole number of at least 1`);
  return n;
}

export function estimateCost(args: Args) {
  const plan = String(args.plan ?? '').toLowerCase();
  if (plan !== 'free' && plan !== 'pro' && plan !== 'team') {
    throw new Error('plan must be one of free, pro, team');
  }
  const seats = positiveInt(args.seats, 1, 'seats');
  const months = positiveInt(args.months, 1, 'months');
  const billing = args.billing === 'yearly' ? 'yearly' : 'monthly';
  const perSeat = PRICING[plan];

  // Yearly billing is sold in whole years: 12 months for the price of 10.
  const years = Math.ceil(months / 12);
  const chargedMonths = billing === 'yearly' ? years * PRICING.yearlyMonthsCharged : months;
  const total = perSeat * seats * chargedMonths;

  return {
    plan,
    seats,
    months: billing === 'yearly' ? years * 12 : months,
    billing,
    price_per_seat_per_month_usd: perSeat,
    months_charged: chargedMonths,
    total_usd: total,
  };
}

export function currentTime(args: Args, now: Date = new Date()) {
  const timezone =
    typeof args.timezone === 'string' && args.timezone.length > 0
      ? args.timezone
      : Intl.DateTimeFormat().resolvedOptions().timeZone;
  // Throws RangeError for an unknown zone, which becomes a tool error.
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    dateStyle: 'full',
    timeStyle: 'long',
  }).format(now);
  return { timezone, iso_utc: now.toISOString(), local: formatted };
}

/**
 * Run one tool call. Always resolves with a JSON string — failures included —
 * because the model needs to see the error to recover ("seats must be a whole
 * number") rather than the conversation simply stopping.
 */
export function executeTool(name: string, rawArguments: string): string {
  try {
    const args = parseArgs(rawArguments);
    switch (name) {
      case 'estimate_cost':
        return JSON.stringify(estimateCost(args));
      case 'calculate': {
        if (typeof args.expression !== 'string') throw new Error('expression must be a string');
        return JSON.stringify({ expression: args.expression, result: evaluate(args.expression) });
      }
      case 'get_current_time':
        return JSON.stringify(currentTime(args));
      default:
        throw new Error(`Unknown tool "${name}"`);
    }
  } catch (error) {
    return JSON.stringify({ error: error instanceof Error ? error.message : String(error) });
  }
}
