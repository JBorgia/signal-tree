import { expect, it } from 'vitest';
import { createComputed, createMemo, createRoot } from 'solid-js';
import { signalTree, transactions } from '../index';
// eslint-disable-next-line @nx/enforce-module-boundaries -- White-box regression exercises private kernel/realization coordination.
import { registerMembershipPublication } from '../../../kernel/src/lib/internals/intrinsic-mutation';

type Image = Record<string, { n: number }>;
type Row = {
  (): { n: number } | undefined;
  n: { (): number; set(value: number): void };
};
function installedRow(value: unknown): Row {
  if (
    typeof value !== 'function' ||
    !('n' in value) ||
    typeof value.n !== 'function' ||
    !('set' in value.n)
  ) {
    throw new Error('Missing explicitly installed facade row');
  }
  return value as Row;
}
function write(row: Row, value: number) {
  row.n.set(value);
}
const step = async (run: () => void) => {
  run();
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

// The observer is private test instrumentation; all state/read/write/native
// consumers below use the real facade. No public completion API is implied.
it.each([
  { fail: false, reenter: false },
  { fail: false, reenter: true },
  { fail: true, reenter: true },
])(
  'installed parent freshness and retained native dependencies ($fail / $reenter)',
  async ({ fail, reenter }) => {
    const tree = signalTree(
      { rows: { old: { n: 10 } } as Image, sibling: { n: 20 } },
      { enhancers: [transactions()] }
    );
    const heldBranch = tree.$.rows;
    const heldRoot = tree.$;
    const before = heldRoot();
    const branchBefore = heldBranch();
    const siblingBefore = tree.$.sibling();
    const old = installedRow(heldBranch['old']);
    const observed: (typeof before)[] = [];
    let stopNative = () => { /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ };
    const native = createRoot((dispose) => {
      stopNative = dispose;
      const memo = createMemo(() => heldRoot());
      createComputed(() => {
        observed.push(memo());
      });
      return memo;
    });
    const readNative = () => native();
    const nativeBefore = readNative();
    const countBefore = observed.length;
    let calls = 0;
    let during: Image | undefined;
    let ancestor: typeof before | undefined;
    let cached: typeof before | undefined;
    let afterNested: Image | undefined;
    let countDuring = -1;
    let retainedA: Row | undefined;
    const sentinel = new Error('counterpart completion sentinel');
    const off = registerMembershipPublication(
      (e) =>
        e.branch === heldBranch && e.key === 'a' && !e.ordinary?.before.present
          ? { record: { writes: [], adds: [] }, completion: {} }
          : undefined,
      () => {
        calls++;
        during = heldBranch();
        ancestor = heldRoot();
        retainedA = installedRow(heldBranch['a']);
        if (reenter) heldBranch({ ...heldBranch(), b: { n: 2 } });
        afterNested = heldBranch();
        cached = readNative();
        countDuring = observed.length;
        if (fail) throw sentinel;
      }
    );
    try {
      expect(nativeBefore).toEqual(before);
      expect(countBefore).toBeGreaterThan(0);
      let caught: unknown;
      await step(() => {
        try {
          heldBranch({ old: { n: 10 }, a: { n: 1 } });
        } catch (error) {
          caught = error;
        }
      });
      off();
      expect(caught).toBe(fail ? sentinel : undefined);
      expect(calls).toBe(1);
      expect.soft(during).toEqual({ old: { n: 10 }, a: { n: 1 } });
      expect.soft(ancestor?.rows).toEqual(during);
      expect.soft(ancestor).not.toBe(before);
      expect.soft(ancestor?.sibling).toBe(siblingBefore);
      const expected = reenter
        ? { old: { n: 10 }, a: { n: 1 }, b: { n: 2 } }
        : { old: { n: 10 }, a: { n: 1 } };
      expect.soft(afterNested).toEqual(expected);
      expect.soft(cached).toBe(nativeBefore);
      expect.soft(countDuring).toBe(countBefore);
      // The enclosing whole value applies its omissions after nested writes.
      // A thrown completion skips that remaining outer work.
      const finalExpected = fail ? expected : { old: { n: 10 }, a: { n: 1 } };
      expect(heldBranch()).toEqual(finalExpected);
      expect(heldBranch()).not.toBe(branchBefore);
      expect(installedRow(heldBranch['a'])).toBe(retainedA);
      expect(readNative()).toEqual(heldRoot());
      expect(observed.length).toBeGreaterThan(countBefore);
      const a = installedRow(heldBranch['a']);
      const updates: [Row, string, number][] = [
        [old, 'old', 11],
        [a, 'a', 3],
      ];
      if (fail && reenter)
        updates.push([installedRow(heldBranch['b']), 'b', 4]);
      for (const [row, key, value] of updates) {
        const count = observed.length;
        await step(() => write(row, value));
        expect(readNative()?.rows[key]).toEqual({ n: value });
        expect(observed.length).toBeGreaterThan(count);
      }
      const stableRoot = heldRoot();
      const stableBranch = heldBranch();
      const stableNative = readNative();
      const stableCount = observed.length;
      await step(() => write(a, 3));
      expect(heldRoot()).toBe(stableRoot);
      expect(heldBranch()).toBe(stableBranch);
      expect(readNative()).toBe(stableNative);
      expect(observed.length).toBe(stableCount);
    } finally {
      off();
      stopNative();
      tree.destroy();
    }
  }
);
