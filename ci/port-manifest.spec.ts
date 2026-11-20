import { describe, expect, it } from 'vitest';
import { validate } from './port-manifest.mjs';

const entry = (over: Record<string, unknown>) => ({ source: 'packages/kernel/src/a.spec.ts', in: ['v16.0.0-rc.1'], ...over });

describe('coverage map validation (BRIEF.md 12.1.5)', () => {
  it('accepts covered, not-carried and pending entries', () => {
    const manifest = {
      entries: [
        entry({ source: 'packages/a/x.spec.ts', covers: ['T2', 'T3', 'T7'] }),
        entry({ source: 'packages/b/x.spec.ts', notCarried: 'asserts the values[slot] storage the new core does not have' }),
        entry({ source: 'packages/c/x.spec.ts', pending: true }),
      ],
    };
    expect(validate(manifest)).toEqual([]);
  });

  it('requires exactly one of covers, notCarried or pending', () => {
    expect(validate({ entries: [entry({})] })).toHaveLength(1);
    expect(validate({ entries: [entry({ covers: ['T1'], pending: true })] })).toHaveLength(1);
  });

  it('accepts only behavior IDs from 5.1, 5.2, 12.4 and 12.5, each once', () => {
    expect(validate({ entries: [entry({ covers: ['T14'] })] })).toHaveLength(1);
    expect(validate({ entries: [entry({ covers: ['T11', 'O1', 'V8'] })] })).toEqual([]);
    expect(validate({ entries: [entry({ covers: [] })] })).toHaveLength(1);
    expect(validate({ entries: [entry({ covers: ['R2', 'R2'] })] })).toHaveLength(1);
  });

  it('requires a one-line not-carried reason', () => {
    expect(validate({ entries: [entry({ notCarried: '' })] })).toHaveLength(1);
    expect(validate({ entries: [entry({ notCarried: 'two\nlines' })] })).toHaveLength(1);
  });

  it('rejects unsorted or duplicate sources', () => {
    const manifest = { entries: [entry({ source: 'packages/b/x.spec.ts', pending: true }), entry({ source: 'packages/a/x.spec.ts', pending: true })] };
    expect(validate(manifest)).toHaveLength(1);
  });

  it('in complete mode, rejects pending entries only', () => {
    const manifest = { entries: [entry({ source: 'packages/a/x.spec.ts', pending: true }), entry({ source: 'packages/b/x.spec.ts', covers: ['E1'] })] };
    expect(validate(manifest, { complete: true })).toEqual(['entry 0 (packages/a/x.spec.ts): still pending']);
  });
});
