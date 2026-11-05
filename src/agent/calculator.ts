/**
 * A small arithmetic evaluator for the `calculate` tool.
 *
 * Why not `eval` or `new Function`: the expression comes from a model, which
 * comes from user input. Handing it to the JavaScript engine would let a
 * prompt-injected "expression" run arbitrary code in the visitor's tab — the
 * very tab that holds their API key. A recursive-descent parser that only
 * knows numbers and + − × ÷ % ^ ( ) cannot do anything but arithmetic.
 *
 * Grammar (lowest precedence first):
 *   expr   := term (('+' | '-') term)*
 *   term   := power (('*' | '/' | '%') power)*
 *   power  := unary ('^' power)?          right-associative: 2^3^2 = 2^9
 *   unary  := ('-' | '+') unary | atom
 *   atom   := number | '(' expr ')'
 */

const MAX_LENGTH = 200;

export class CalculatorError extends Error {}

export function evaluate(input: string): number {
  if (input.length > MAX_LENGTH) throw new CalculatorError('Expression too long');
  // Accept the symbols people (and models) actually write.
  const source = input
    .replace(/[×x]/g, '*')
    .replace(/÷/g, '/')
    .replace(/,/g, '')
    .replace(/\s+/g, '');
  let pos = 0;

  const peek = (): string => source[pos] ?? '';
  const expect = (char: string): void => {
    if (source[pos] !== char) throw new CalculatorError(`Expected "${char}" at position ${pos}`);
    pos += 1;
  };

  function expr(): number {
    let value = term();
    while (peek() === '+' || peek() === '-') {
      const op = source[pos++];
      const right = term();
      value = op === '+' ? value + right : value - right;
    }
    return value;
  }

  function term(): number {
    let value = power();
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = source[pos++];
      const right = power();
      if ((op === '/' || op === '%') && right === 0) throw new CalculatorError('Division by zero');
      value = op === '*' ? value * right : op === '/' ? value / right : value % right;
    }
    return value;
  }

  function power(): number {
    const base = unary();
    if (peek() === '^') {
      pos += 1;
      return base ** power();
    }
    return base;
  }

  function unary(): number {
    if (peek() === '-') {
      pos += 1;
      return -unary();
    }
    if (peek() === '+') {
      pos += 1;
      return unary();
    }
    return atom();
  }

  function atom(): number {
    if (peek() === '(') {
      pos += 1;
      const value = expr();
      expect(')');
      return value;
    }
    const match = /^\d+(\.\d+)?|^\.\d+/.exec(source.slice(pos));
    if (!match) throw new CalculatorError(`Unexpected "${peek() || 'end of input'}" at position ${pos}`);
    pos += match[0].length;
    return Number(match[0]);
  }

  if (source.length === 0) throw new CalculatorError('Empty expression');
  const result = expr();
  if (pos !== source.length) throw new CalculatorError(`Unexpected "${source[pos]}" at position ${pos}`);
  if (!Number.isFinite(result)) throw new CalculatorError('Result is not a finite number');
  // Round away floating-point noise (0.1 + 0.2) without hiding real precision.
  return Number(result.toPrecision(12));
}
