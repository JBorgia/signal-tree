import { describe, expect, it } from 'vitest';

import {
  withWriteContext,
  getActiveWriteContext,
} from './write-context';
import type { WriteMetadata } from './types';

describe('withWriteContext / getActiveWriteContext', () => {
  it('returns undefined when no context is active', () => {
    expect(getActiveWriteContext()).toBeUndefined();
  });

  it('exposes the context inside fn() and restores it afterward', () => {
    expect(getActiveWriteContext()).toBeUndefined();

    let captured: WriteMetadata | undefined;
    withWriteContext({ intent: 'hydrate' }, () => {
      captured = getActiveWriteContext();
    });

    expect(captured).toEqual({ intent: 'hydrate' });
    expect(getActiveWriteContext()).toBeUndefined();
  });

  it('returns the value produced by fn()', () => {
    const result = withWriteContext({ intent: 'user' }, () => 42);
    expect(result).toBe(42);
  });

  it('restores the previous context after a nested call', () => {
    withWriteContext({ intent: 'hydrate', origin: 'external' }, () => {
      expect(getActiveWriteContext()).toEqual({
        intent: 'hydrate',
        origin: 'external',
      });

      withWriteContext({ intent: 'user' }, () => {
        expect(getActiveWriteContext()).toEqual({ intent: 'user' });
      });

      // Outer context restored after inner returns.
      expect(getActiveWriteContext()).toEqual({
        intent: 'hydrate',
        origin: 'external',
      });
    });

    expect(getActiveWriteContext()).toBeUndefined();
  });

  it('restores context when fn() throws', () => {
    expect(() =>
      withWriteContext({ intent: 'bulk' }, () => {
        throw new Error('boom');
      })
    ).toThrow('boom');

    expect(getActiveWriteContext()).toBeUndefined();
  });

  it('restores the outer context when an inner call throws', () => {
    withWriteContext({ intent: 'hydrate' }, () => {
      try {
        withWriteContext({ intent: 'user' }, () => {
          throw new Error('inner');
        });
      } catch (err) {
        expect((err as Error).message).toBe('inner');
      }

      // Outer must be restored, even though inner threw.
      expect(getActiveWriteContext()).toEqual({ intent: 'hydrate' });
    });
  });

  it('does NOT survive `await` boundaries (documented limitation)', async () => {
    // Inside the synchronous portion of fn(), context is active.
    // After `await`, the synchronous frame has returned and context is restored.
    let beforeAwait: WriteMetadata | undefined;
    let afterAwait: WriteMetadata | undefined;

    const yieldOnce = (): Promise<void> => Promise.resolve();

    await withWriteContext({ intent: 'hydrate' }, async () => {
      beforeAwait = getActiveWriteContext();
      await yieldOnce();
      afterAwait = getActiveWriteContext();
    });

    expect(beforeAwait).toEqual({ intent: 'hydrate' });
    // Context was restored to `undefined` before the awaited microtask resumed.
    expect(afterAwait).toBeUndefined();
    expect(getActiveWriteContext()).toBeUndefined();
  });

  it('passes through the declared optional fields', () => {
    const meta: WriteMetadata = {
      intent: 'migration',
      origin: 'devtools',
      suppressGuardrails: true,
    };

    withWriteContext(meta, () => {
      expect(getActiveWriteContext()).toEqual(meta);
    });
  });

  // MATRIX-CLOSE M7. This test used to carry a `customKey: 'value'` field and
  // assert that the open extension round-tripped. `WriteMetadata`'s
  // `[key: string]: unknown` signature is deleted, and the assertion went with
  // it — but the reason it is recorded here rather than just removed is that
  // THIS TEST WAS THE HATCH'S ONLY CONSUMER IN THE REPO. The sole thing
  // exercising the open extension was a test asserting the open extension
  // exists.
  //
  // That is the same circularity as the mock `.with()` suites deleted in pass 1:
  // a test whose subject is its own fixture cannot fail for a product reason. A
  // third-party enhancer that genuinely needs custom keys earns a declared field
  // by producing a consumer, which is how `'transaction-rollback'` earned its
  // origin value.
});
