import { describe, expect, it } from 'vitest';

import { signalTree } from './signal-tree';
import { getPathNotifier } from './path-notifier';
import { setMemberPresence } from './internals/member-membership';
import {
  applyPlainBranchMemberSnapshot,
  canRealizePlainBranchMember,
  composePlainBranchMemberEffect,
  plainBranchMemberEffectIsNoop,
  plainBranchMembershipEffects,
  preparePlainBranchMembers,
  readPlainBranchMember,
  realizePlainBranchMember,
  type PlainBranchMemberPresence,
  type PlainBranchMembershipEffect,
} from './internals/plain-branch-membership';

interface Profile {
  name: string;
  age?: number;
}
type Composable = {
  before: unknown;
  after: unknown;
  plainBranchMembership?: PlainBranchMemberPresence;
};

function collectMembership() {
  const effects: PlainBranchMembershipEffect[] = [];
  const stop = getPathNotifier().subscribe(
    '**',
    (_next, _prev, _path, _owner, _origin, _subjects, _positions, meta) => {
      effects.push(...(plainBranchMembershipEffects(meta) ?? []));
    }
  );
  return { effects, stop };
}

describe('plain branch explicit member presence', () => {
  it('staged omission retains scalar storage and emits only a membership event', () => {
    const tree = signalTree(
      { profile: { name: 'Ada', age: 42 } as Profile },
      { capabilities: ['causal-runtime'] }
    );
    const capture = collectMembership();
    let stop: (() => void) | undefined;
    try {
      tree.$.profile({ name: 'Ada' });
      getPathNotifier().flushSync();
      const position = capture.effects[0].position;
      tree.$.profile({ name: 'Ada', age: 42 });
      getPathNotifier().flushSync();
      capture.effects.length = 0;
      const leafWrites: unknown[] = [];
      stop = getPathNotifier().subscribe('profile.age', (next) => {
        leafWrites.push(next);
      });
      const plan = preparePlainBranchMembers(
        tree.$,
        new Map([[position, { present: false, value: undefined }]])
      );
      plan.install();
      expect(Object.keys(tree.$.profile)).toEqual(['name']);
      expect(capture.effects).toEqual([]);
      plan.publish();
      getPathNotifier().flushSync();
      expect(tree.$.profile()).toStrictEqual({ name: 'Ada' });
      expect(leafWrites).toEqual([]);
      expect(capture.effects).toHaveLength(1);
      expect(capture.effects[0]).toMatchObject({
        before: 42,
        after: undefined,
        plainBranchMembership: { before: true, after: false },
      });
      // Read the retained slot under its descriptor authority to prove omission
      // did not replace the physical value with undefined.
      setMemberPresence(tree.$.profile, 'age', 'active');
      expect(tree.$.profile.age!()).toBe(42);
    } finally {
      stop?.();
      capture.stop();
      tree.destroy();
    }
  });

  it('stages all membership and nested values before publishing any observation', () => {
    const tree = signalTree(
      {
        box: { keep: 1, age: 42, detail: { set: 2, deep: { age: 42 } } } as {
          keep: number;
          age?: number;
          detail?: { set: number; deep: { age: number } };
        },
      },
      { capabilities: ['causal-runtime'] }
    );
    const capture = collectMembership();
    const seen: unknown[] = [];
    let stop: (() => void) | undefined;
    try {
      tree.$();
      tree.$.box({ keep: 1 });
      getPathNotifier().flushSync();
      const targets = new Map(
        capture.effects.map((effect) => [
          effect.position,
          {
            present: true,
            value:
              effect.path === 'box.age'
                ? undefined
                : { set: 5, deep: { age: 43 } },
          },
        ])
      );
      capture.effects.length = 0;
      stop = getPathNotifier().subscribe('**', () => {
        seen.push(tree.$());
      });
      const prepared = preparePlainBranchMembers(tree.$, targets);
      expect(tree.$()).toStrictEqual({ box: { keep: 1 } });
      prepared.install();
      getPathNotifier().flushSync();
      expect(seen).toEqual([]);
      expect(capture.effects).toEqual([]);
      const detailPosition = [...targets].find(
        ([, target]) => target.value !== undefined
      )![0];
      expect(readPlainBranchMember(tree.$, detailPosition)).toStrictEqual({
        present: true,
        value: { set: 5, deep: { age: 43 } },
      });
      expect(Object.keys(tree.$.box)).toContain('age');
      prepared.publish();
      getPathNotifier().flushSync();
      const expected = {
        box: { keep: 1, age: undefined, detail: { set: 5, deep: { age: 43 } } },
      };
      expect(tree.$()).toStrictEqual(expected);
      expect(seen.length).toBeGreaterThan(0);
      expect(
        seen.every(
          (value) => JSON.stringify(value) === JSON.stringify(expected)
        )
      ).toBe(true);
      expect(
        capture.effects.find((effect) => effect.path === 'box.detail')?.after
      ).toStrictEqual(expected.box.detail);
      expect(
        capture.effects.find((effect) => effect.path === 'box.age')
          ?.plainBranchMembership
      ).toStrictEqual({ before: false, after: true });
    } finally {
      stop?.();
      capture.stop();
      tree.destroy();
    }
  });

  it('staged preparation validates all targets before changing any member', () => {
    const tree = signalTree(
      { profile: { name: 'Ada', age: 42 } as Profile },
      { capabilities: ['causal-runtime'] }
    );
    const capture = collectMembership();
    try {
      tree.$.profile({ name: 'Ada' });
      getPathNotifier().flushSync();
      const position = capture.effects[0].position;
      expect(() =>
        preparePlainBranchMembers(
          tree.$,
          new Map([
            [position, { present: true, value: 9 }],
            [-1, { present: true, value: 10 }],
          ])
        )
      ).toThrow();
      expect(tree.$.profile()).toStrictEqual({ name: 'Ada' });
      const plan = preparePlainBranchMembers(
        tree.$,
        new Map([[position, { present: true, value: 9 }]])
      );
      expect(() => plan.publish()).toThrow('before installation');
      expect(tree.$.profile()).toStrictEqual({ name: 'Ada' });
    } finally {
      capture.stop();
      tree.destroy();
    }
  });

  it('captures a reacquired branch after-image inside an invalidation group without stale memos', () => {
    const tree = signalTree(
      {
        profile: { name: 'Ada', nested: { detail: { age: 42 } } } as {
          name: string;
          nested?: { detail: { age: number } };
        },
      },
      { capabilities: ['causal-runtime'] }
    );
    const capture = collectMembership();
    try {
      // Materialize both branch memos before omission, as an existing observer
      // or a Link created during absence does when indexing retained locations.
      expect(tree.$()).toStrictEqual({
        profile: { name: 'Ada', nested: { detail: { age: 42 } } },
      });
      tree.$.profile({ name: 'Ada' });
      getPathNotifier().flushSync();
      capture.effects.length = 0;
      tree.$.profile({ name: 'Ada', nested: { detail: { age: 43 } } });
      getPathNotifier().flushSync();
      const membership = capture.effects.find(
        (effect) => effect.path === 'profile.nested'
      );
      expect(membership?.after).toStrictEqual({ detail: { age: 43 } });
      expect(membership?.plainBranchMembership).toStrictEqual({
        before: false,
        after: true,
      });
      expect(tree.$.profile.nested?.()).toStrictEqual({ detail: { age: 43 } });
    } finally {
      capture.stop();
      tree.destroy();
    }
  });

  it.each([42, undefined])(
    'capture leaves before/after as raw values (%s)',
    (age) => {
      const tree = signalTree(
        { profile: { name: 'Ada', age } as Profile },
        { capabilities: ['causal-runtime'] }
      );
      const capture = collectMembership();
      try {
        tree.$.profile({ name: 'Ada' });
        getPathNotifier().flushSync();
        expect(capture.effects).toHaveLength(1);
        const effect = capture.effects[0];
        expect(effect.before).toBe(age);
        expect(effect.after).toBeUndefined();
        expect(effect.plainBranchMembership).toStrictEqual({
          before: true,
          after: false,
        });
        expect(Object.getOwnPropertySymbols(effect)).toEqual([]);
        expect(
          Object.values(effect).some((value) => typeof value === 'function')
        ).toBe(false);
        expect(canRealizePlainBranchMember(tree.$, effect.position)).toBe(true);
        expect(readPlainBranchMember(tree.$, effect.position)).toStrictEqual({
          present: false,
        });
        realizePlainBranchMember(tree.$, effect.position, true, age);
        expect(tree.$.profile()).toStrictEqual({ name: 'Ada', age });
        realizePlainBranchMember(tree.$, effect.position, false, undefined);
        expect(tree.$.profile()).toStrictEqual({ name: 'Ada' });
      } finally {
        capture.stop();
        tree.destroy();
      }
    }
  );

  it('composes values and explicit presence without changing their representation', () => {
    const earlierValue: Composable = { before: 42, after: 8 };
    const removed: Composable = {
      before: 8,
      after: undefined,
      plainBranchMembership: { before: true, after: false },
    };
    expect(composePlainBranchMemberEffect(earlierValue, removed)).toBe(true);
    expect(earlierValue).toStrictEqual({
      before: 42,
      after: undefined,
      plainBranchMembership: { before: true, after: false },
    });
    expect(
      composePlainBranchMemberEffect(earlierValue, {
        before: undefined,
        after: 9,
      })
    ).toBe(true);
    expect(earlierValue).toStrictEqual({
      before: 42,
      after: 9,
      plainBranchMembership: { before: true, after: true },
    });

    const preliminary: Composable = { before: undefined, after: 8 };
    composePlainBranchMemberEffect(preliminary, {
      before: undefined,
      after: 8,
      plainBranchMembership: { before: false, after: true },
    });
    expect(preliminary).toStrictEqual({
      before: undefined,
      after: 8,
      plainBranchMembership: { before: false, after: true },
    });
  });

  it('keeps undefined presence transitions while eliminating real round trips', () => {
    expect(
      plainBranchMemberEffectIsNoop({
        before: undefined,
        after: undefined,
        plainBranchMembership: { before: true, after: false },
      })
    ).toBe(false);
    expect(
      plainBranchMemberEffectIsNoop({
        before: undefined,
        after: undefined,
        plainBranchMembership: { before: false, after: true },
      })
    ).toBe(false);
    expect(
      plainBranchMemberEffectIsNoop({
        before: undefined,
        after: undefined,
        plainBranchMembership: { before: true, after: true },
      })
    ).toBe(true);
    const effect: Composable = {
      before: 42,
      after: undefined,
      plainBranchMembership: { before: true, after: false },
    };
    composePlainBranchMemberEffect(effect, {
      before: undefined,
      after: 42,
      plainBranchMembership: { before: false, after: true },
    });
    expect(plainBranchMemberEffectIsNoop(effect)).toBe(true);
  });

  it('uses literal keys and preserves absent versus undefined in detached snapshots', () => {
    const tree = signalTree(
      {
        'a.b': { '': undefined, keep: 1 } as { ''?: number; keep: number },
        a: { b: 3 },
      },
      { capabilities: ['causal-runtime'] }
    );
    const capture = collectMembership();
    try {
      tree.$['a.b']({ keep: 1 });
      getPathNotifier().flushSync();
      const effect = capture.effects[0];
      const absent = { 'a.b': { keep: 1 }, a: { b: 3 } };
      const present = applyPlainBranchMemberSnapshot(
        tree.$,
        absent,
        effect.position,
        true,
        undefined
      );
      expect(present).toStrictEqual({
        'a.b': { '': undefined, keep: 1 },
        a: { b: 3 },
      });
      expect(absent).toStrictEqual({ 'a.b': { keep: 1 }, a: { b: 3 } });
      expect(
        applyPlainBranchMemberSnapshot(
          tree.$,
          present,
          effect.position,
          false,
          undefined
        )
      ).toStrictEqual(absent);
      realizePlainBranchMember(tree.$, effect.position, true, undefined);
      expect(tree.$()).toStrictEqual(present);
    } finally {
      capture.stop();
      tree.destroy();
    }
  });

  it('keeps address mappings scoped to their registry and rejects stale retained nodes', () => {
    const a = signalTree(
      { profile: { name: 'A', age: 42 } as Profile },
      { capabilities: ['causal-runtime'] }
    );
    const b = signalTree(
      { profile: { name: 'B', age: 7 } as Profile },
      { capabilities: ['causal-runtime'] }
    );
    const capture = collectMembership();
    try {
      a.$.profile({ name: 'A' });
      getPathNotifier().flushSync();
      const position = capture.effects[0].position;
      expect(canRealizePlainBranchMember(a.$, position)).toBe(true);
      expect(canRealizePlainBranchMember(b.$, position)).toBe(false);
      const descriptor = Object.getOwnPropertyDescriptor(a.$.profile, 'age')!;
      Object.defineProperty(a.$.profile, 'age', {
        ...descriptor,
        value: b.$.profile.age,
      });
      try {
        expect(canRealizePlainBranchMember(a.$, position)).toBe(false);
        expect(() => realizePlainBranchMember(a.$, position, true, 42)).toThrow(
          'unavailable'
        );
      } finally {
        Object.defineProperty(a.$.profile, 'age', descriptor);
      }
      expect(b.$.profile()).toStrictEqual({ name: 'B', age: 7 });
    } finally {
      capture.stop();
      a.destroy();
      b.destroy();
    }
  });
});
