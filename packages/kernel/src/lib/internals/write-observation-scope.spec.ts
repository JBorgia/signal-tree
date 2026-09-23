import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  observeWrites,
  treeRuntimeId,
  withWriteObservationScope,
  type ObservedWriteFrame,
} from '../../internals';
import { getPathNotifier } from '../path-notifier';
import { signalTree } from '../signal-tree';
import { restoration } from '../../enhancers/restoration/restoration';

/** Declarations describe synchronous membership; delivery never manufactures causality. */
describe('write observation declaration scopes', () => {
  const notifier = getPathNotifier();
  const cleanup: (() => void)[] = [];
  let frames: ObservedWriteFrame[];
  const emit = (path = 'count', next = 1, before = 0, owner = 101) =>
    notifier.notify(
      path,
      next,
      before,
      path,
      undefined,
      [1],
      { ownerId: owner },
      owner
    );
  beforeEach(() => {
    notifier.flushSync();
    notifier.setBatchingEnabled(true);
    frames = [];
    cleanup.push(observeWrites((frame) => frames.push(frame)));
  });
  afterEach(() => {
    cleanup
      .splice(0)
      .reverse()
      .forEach((stop) => stop());
    notifier.flushSync();
    notifier.setBatchingEnabled(true);
  });
  it('captures at notify time after the callback ends without making delivery synchronous', () => {
    expect(
      withWriteObservationScope(101, 'one', () => {
        emit();
        return 42;
      })
    ).toBe(42);
    expect(frames).toEqual([]);
    notifier.flushSync();
    expect(frames).toHaveLength(1);
    expect(frames[0]?.declaredScopes).toEqual({
      tokens: ['one'],
      includesUnscoped: false,
      omitted: false,
    });
    emit('later');
    notifier.flushSync();
    expect(frames[1]?.declaredScopes).toBeUndefined();
  });
  it('unions distinct declarations while preserving the existing coalesced before/after and event count', () => {
    withWriteObservationScope(101, 'a', () => emit('count', 1, 0));
    withWriteObservationScope(101, 'b', () => emit('count', 2, 1));
    withWriteObservationScope(101, 'a', () => emit('count', 3, 2));
    notifier.flushSync();
    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({
      before: 0,
      after: 3,
      ownerId: 101,
      declaredScopes: {
        tokens: ['a', 'b'],
        includesUnscoped: false,
        omitted: false,
      },
    });
  });
  it.each([true, false])(
    'keeps scoped/unscoped mixtures sticky regardless of first-write order (%s)',
    (scopedFirst) => {
      const scoped = (next: number, before: number) =>
        withWriteObservationScope(101, 'a', () => emit('count', next, before));
      if (scopedFirst) {
        scoped(1, 0);
        emit('count', 2, 1);
      } else {
        emit('count', 1, 0);
        scoped(2, 1);
      }
      scoped(3, 2);
      notifier.flushSync();
      expect(frames[0]?.declaredScopes).toEqual({
        tokens: ['a'],
        includesUnscoped: true,
        omitted: false,
      });
    }
  );
  it('bounds distinct coalesced tokens to eight and retains the omission flag', () => {
    for (let i = 0; i < 12; i++)
      withWriteObservationScope(101, `s${i}`, () => emit('count', i + 1, i));
    emit('count', 13, 12);
    notifier.flushSync();
    expect(frames).toHaveLength(1);
    expect(frames[0]?.declaredScopes).toEqual({
      tokens: Array.from({ length: 8 }, (_, i) => `s${i}`),
      includesUnscoped: true,
      omitted: true,
    });
  });
  it('unions nested scopes, deduplicates tokens and restores the outer scope', () => {
    withWriteObservationScope(101, 'outer', () => {
      withWriteObservationScope(101, 'inner', () =>
        withWriteObservationScope(101, 'outer', () => emit('nested'))
      );
      emit('outer');
    });
    notifier.flushSync();
    expect(
      frames.find((frame) => frame.path === 'nested')?.declaredScopes?.tokens
    ).toEqual(['outer', 'inner']);
    expect(
      frames.find((frame) => frame.path === 'outer')?.declaredScopes?.tokens
    ).toEqual(['outer']);
  });
  it.each([0, -1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    'invalid owner %s executes exactly once without attribution',
    (owner) => {
      let calls = 0;
      expect(
        withWriteObservationScope(owner, 'token', () => {
          calls++;
          emit();
          return 'result';
        })
      ).toBe('result');
      notifier.flushSync();
      expect(calls).toBe(1);
      expect(frames[0]?.declaredScopes).toBeUndefined();
    }
  );
  it.each(['', 'x'.repeat(257), null])(
    'invalid token executes without attribution',
    (token) => {
      let calls = 0;
      withWriteObservationScope(101, token as string, () => {
        calls++;
        emit();
      });
      notifier.flushSync();
      expect(calls).toBe(1);
      expect(frames[0]?.declaredScopes).toBeUndefined();
    }
  );
  it('accepts the exact token bound', () => {
    const token = 'x'.repeat(256);
    withWriteObservationScope(101, token, () => emit());
    notifier.flushSync();
    expect(frames[0]?.declaredScopes?.tokens).toEqual([token]);
  });
  it('ends on exceptions and does not swallow or replace the thrown error', () => {
    const error = new Error('application failure');
    expect(() =>
      withWriteObservationScope(101, 'throwing', () => {
        emit('inside');
        throw error;
      })
    ).toThrow(error);
    emit('after');
    notifier.flushSync();
    expect(
      frames.find((frame) => frame.path === 'inside')?.declaredScopes?.tokens
    ).toEqual(['throwing']);
    expect(
      frames.find((frame) => frame.path === 'after')?.declaredScopes
    ).toBeUndefined();
  });
  it('does not extend across await or wrap the callback promise', async () => {
    let callbackPromise: Promise<void> | undefined;
    const result = withWriteObservationScope(101, 'sync', () => {
      callbackPromise = (async () => {
        emit('before');
        await Promise.resolve();
        emit('after');
      })();
      return callbackPromise;
    });
    expect(result).toBe(callbackPromise);
    await result;
    notifier.flushSync();
    expect(
      frames.find((frame) => frame.path === 'before')?.declaredScopes?.tokens
    ).toEqual(['sync']);
    expect(
      frames.find((frame) => frame.path === 'after')?.declaredScopes
    ).toBeUndefined();
  });
  it('suspends inherited scope during immediate notifications but permits explicit observer declarations', () => {
    notifier.setBatchingEnabled(false);
    cleanup.push(
      observeWrites((frame) => {
        if (frame.path !== 'trigger') return;
        emit('derived');
        withWriteObservationScope(101, 'observer', () => emit('explicit'));
      })
    );
    withWriteObservationScope(101, 'application', () => {
      emit('trigger');
      emit('resumed');
    });
    expect(
      frames.find((frame) => frame.path === 'derived')?.declaredScopes
    ).toBeUndefined();
    expect(
      frames.find((frame) => frame.path === 'explicit')?.declaredScopes?.tokens
    ).toEqual(['observer']);
    expect(
      frames.find((frame) => frame.path === 'resumed')?.declaredScopes?.tokens
    ).toEqual(['application']);
  });
  it('suspends inherited scope in synchronous flush callbacks and restores it afterwards', () => {
    let called = false;
    cleanup.push(
      notifier.onFlush(() => {
        if (called) return;
        called = true;
        emit('flush-derived');
        withWriteObservationScope(101, 'flush-explicit', () =>
          emit('flush-explicit')
        );
      })
    );
    withWriteObservationScope(101, 'application', () => {
      emit('trigger');
      notifier.flushSync();
      emit('resumed');
    });
    notifier.flushSync();
    expect(
      frames.find((frame) => frame.path === 'flush-derived')?.declaredScopes
    ).toBeUndefined();
    expect(
      frames.find((frame) => frame.path === 'flush-explicit')?.declaredScopes
        ?.tokens
    ).toEqual(['flush-explicit']);
    expect(
      frames.find((frame) => frame.path === 'resumed')?.declaredScopes?.tokens
    ).toEqual(['application']);
  });
  it('protects token snapshots against one consumer mutating another consumer or later frames', () => {
    cleanup.push(
      observeWrites((frame) => {
        const scopes = frame.declaredScopes;
        if (!scopes) return;
        expect(Object.isFrozen(scopes.tokens)).toBe(true);
        expect(() => (scopes.tokens as string[]).push('forged')).toThrow();
      })
    );
    const later: ObservedWriteFrame[] = [];
    cleanup.push(observeWrites((frame) => later.push(frame)));
    withWriteObservationScope(101, 'actual', () => emit());
    notifier.flushSync();
    expect(later[0]?.declaredScopes?.tokens).toEqual(['actual']);
    emit('later');
    notifier.flushSync();
    expect(later[1]?.declaredScopes).toBeUndefined();
  });
  it('suppresses net-zero observations even when their declarations differ', () => {
    withWriteObservationScope(101, 'a', () => emit('count', 1, 0));
    withWriteObservationScope(101, 'b', () => emit('count', 0, 1));
    notifier.flushSync();
    expect(frames).toEqual([]);
  });
  it('scopes real-tree writes by owner, including a different tree with the same path', () => {
    const a = signalTree({ count: 0 }, { enhancers: [restoration()] });
    const b = signalTree({ count: 0 }, { enhancers: [restoration()] });
    cleanup.push(() => {
      a.destroy();
      b.destroy();
    });
    const ownerA = treeRuntimeId(a)!;
    const ownerB = treeRuntimeId(b)!;
    expect(ownerA).not.toBe(ownerB);
    withWriteObservationScope(ownerA, 'a', () => {
      a.$.count(1);
      b.$.count(2);
    });
    notifier.flushSync();
    expect(a.$.count()).toBe(1);
    expect(b.$.count()).toBe(2);
    expect(frames.filter((frame) => frame.path === 'count')).toHaveLength(2);
    expect(
      frames.find((frame) => frame.ownerId === ownerA)?.declaredScopes?.tokens
    ).toEqual(['a']);
    expect(
      frames.find((frame) => frame.ownerId === ownerB)?.declaredScopes
    ).toBeUndefined();
  });
  it('preserves owner and declarations when mixed metadata is deliberately discarded', () => {
    withWriteObservationScope(101, 'a', () =>
      notifier.notify(
        'count',
        1,
        0,
        'count',
        undefined,
        [1],
        { origin: 'external' },
        101
      )
    );
    withWriteObservationScope(101, 'b', () =>
      notifier.notify(
        'count',
        2,
        1,
        'count',
        undefined,
        [1],
        { origin: 'restoration' },
        101
      )
    );
    notifier.flushSync();
    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({
      ownerId: 101,
      origin: 'mixed',
      before: 0,
      after: 2,
      declaredScopes: {
        tokens: ['a', 'b'],
        includesUnscoped: false,
        omitted: false,
      },
    });
    expect(frames[0]?.participation).toBeUndefined();
    expect(frames[0]?.transactionId).toBeUndefined();
  });
});
