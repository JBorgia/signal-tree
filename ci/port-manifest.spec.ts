import { describe, expect, it } from 'vitest';
import { validate } from './port-manifest.mjs';

const exists = (paths: string[]) => (p: string) => paths.includes(p);
const entry = (over: Record<string, unknown>) => ({ source: 'packages/kernel/src/a.spec.ts', in: ['v16.0.0-rc.1'], disposition: 'pending', ...over });

describe('port manifest validation', () => {
  it('accepts each well-formed disposition', () => {
    const manifest = {
      entries: [
        entry({ source: 'packages/a/x.spec.ts' }),
        entry({ source: 'packages/b/x.spec.ts', disposition: 'ported', target: 'packages/core/src/x.spec.ts' }),
        entry({ source: 'packages/c/x.spec.ts', disposition: 'superseded', coveredBy: 'packages/core/src/y.spec.ts::rolls back' }),
        entry({ source: 'packages/d/x.spec.ts', disposition: 'internal', reason: 'pins values[slot] storage, which no longer exists', signedOff: false }),
      ],
    };
    expect(validate(manifest, { fileExists: exists(['packages/core/src/x.spec.ts', 'packages/core/src/y.spec.ts']) })).toEqual([]);
  });

  it('rejects ported or superseded entries whose test does not exist', () => {
    const manifest = { entries: [entry({ disposition: 'ported', target: 'packages/core/src/missing.spec.ts' })] };
    expect(validate(manifest, { fileExists: exists([]) })).toHaveLength(1);
  });

  it('rejects an internal entry without a reason or sign-off field', () => {
    expect(validate({ entries: [entry({ disposition: 'internal' })] }, { fileExists: exists([]) })).toHaveLength(2);
  });

  it('rejects unsorted or duplicate sources and unknown dispositions', () => {
    const manifest = { entries: [entry({ source: 'packages/b/x.spec.ts' }), entry({ source: 'packages/a/x.spec.ts' }), entry({ source: 'packages/c/x.spec.ts', disposition: 'skipped' })] };
    expect(validate(manifest, { fileExists: exists([]) })).toHaveLength(2);
  });

  it('in complete mode, rejects pending entries and unsigned internal entries', () => {
    const manifest = { entries: [entry({ source: 'packages/a/x.spec.ts' }), entry({ source: 'packages/b/x.spec.ts', disposition: 'internal', reason: 'gone', signedOff: false })] };
    expect(validate(manifest, { fileExists: exists([]), complete: true })).toHaveLength(2);
  });
});
