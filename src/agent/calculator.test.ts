import { describe, expect, it } from 'vitest';
import { CalculatorError, evaluate } from './calculator';

describe('evaluate', () => {
  it('respects precedence and parentheses', () => {
    expect(evaluate('2 + 3 * 4')).toBe(14);
    expect(evaluate('(2 + 3) * 4')).toBe(20);
    expect(evaluate('10 - 4 - 3')).toBe(3);
    expect(evaluate('7 % 4')).toBe(3);
  });

  it('treats ^ as right-associative and handles unary minus', () => {
    expect(evaluate('2^3^2')).toBe(512);
    expect(evaluate('-3 + -(-2)')).toBe(-1);
  });

  it('accepts the symbols people write', () => {
    expect(evaluate('12 × 5 ÷ 4')).toBe(15);
    expect(evaluate('1,200 * 2')).toBe(2400);
  });

  it('rounds away floating-point noise', () => {
    expect(evaluate('0.1 + 0.2')).toBe(0.3);
  });

  it('rejects anything that is not arithmetic', () => {
    expect(() => evaluate('alert(1)')).toThrow(CalculatorError);
    expect(() => evaluate('process.exit()')).toThrow(CalculatorError);
    expect(() => evaluate('1 +')).toThrow(CalculatorError);
    expect(() => evaluate('(1 + 2')).toThrow(/Expected "\)"/);
    expect(() => evaluate('')).toThrow(/Empty/);
    expect(() => evaluate('1/0')).toThrow(/Division by zero/);
    expect(() => evaluate('9'.repeat(400))).toThrow(/too long/);
  });
});
