import { describe, expect, it } from 'vitest';
import { ERROR_CODES, SignalTreeError, SignalTreeRefusal } from '@signal-tree/core';

describe('typed errors', () => {
  it('formats the code, message, path, key and detail', () => {
    const error = new SignalTreeError('ST1011', { path: ['orders', 3, Symbol('s')], key: 'a', detail: 'more' });
    expect(error.message).toBe('[ST1011] No entity has this key at "orders" > 3 > Symbol(s) (key "a"): more');
    expect(error.code).toBe('ST1011');
    expect(error.reason).toBe('missing-key');
    expect(error.path).toEqual(['orders', 3, expect.any(Symbol)]);
    expect(error.key).toBe('a');
    expect(error.name).toBe('SignalTreeError');
    expect(error).toBeInstanceOf(Error);
  });

  it('formats a non-string key and keeps the underlying error as cause', () => {
    const inner = new Error('inner');
    const error = new SignalTreeError('ST2034', { key: 1, error: inner });
    expect(error.message).toBe('[ST2034] An observer threw while a change was being published (key 1)');
    expect(error.cause).toBe(inner);
  });

  it('a bare error carries only its code and message', () => {
    const error = new SignalTreeError('ST1003');
    expect(error.message).toBe('[ST1003] The tree has been destroyed');
    expect(error.path).toBeUndefined();
    expect(error.cause).toBeUndefined();
  });

  it('a refusal is a typed error', () => {
    const refusal = new SignalTreeRefusal('ST1010', { key: 7 });
    expect(refusal).toBeInstanceOf(SignalTreeError);
    expect(refusal.name).toBe('SignalTreeRefusal');
  });

  it('every code is ST followed by four digits and has a distinct cause', () => {
    const codes = Object.keys(ERROR_CODES);
    for (const code of codes) expect(code).toMatch(/^ST\d{4}$/);
    const causes = Object.values(ERROR_CODES).map((c) => c.cause);
    expect(new Set(causes).size).toBe(causes.length);
  });
});
