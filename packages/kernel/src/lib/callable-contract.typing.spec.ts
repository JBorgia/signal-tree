/**
 * TYPE-TEST — compile-time only. Checked by `tsc` (`npm run typecheck`),
 * EXCLUDED from vitest (the `*typing*.spec.ts` ignore).
 *
 * The runtime half lives in `callable-contract.spec.ts`.
 */
import { signalTree } from './signal-tree';

const tree = signalTree({
  count: 0,
  name: 'John',
  tags: ['a'] as string[],
  user: { name: 'John', age: 30 },
});

// --- LEAVES: same callable grammar as roots and branches --------------------
tree.$.count(5);
tree.$.count((c: number) => c + 1);
tree.$.name('Jane');
tree.$.tags(['b']);
tree.$.user.name('Bob');

// --- LEAVES: reads and the real writers still compile -----------------------
export const _leafReads: [number, string, string[]] = [
  tree.$.count(),
  tree.$.name(),
  tree.$.tags(),
];
// @ts-expect-error canonical leaves are not Angular WritableSignals
tree.$.count.set(5);
// @ts-expect-error canonical leaves have no second update verb
tree.$.count.update((c: number) => c + 1);

// --- BRANCHES: still callable both directions -------------------------------
export const _branchRead: { name: string; age: number } = tree.$.user();
tree.$.user({ name: 'Bob', age: 31 });
// ⚠️ THE FALSIFIER FOR WHOLE-VALUE ASSIGNMENT — GREENFIELD-BRANCH-WRITE-0.
//
// Without this row the migration is SILENTLY REVERSIBLE: `Partial<T>` is LOOSER
// than `T`, so re-widening `NodeAccessor` breaks nothing and every completed
// call site still compiles. Measured — reverting the parameter left the whole
// spec suite green. An unused `@ts-expect-error` is itself a compile error, so
// this row is what turns that silent widening red.
// @ts-expect-error a branch value call is WHOLE-VALUE; a partial must not compile
tree.$.user({ name: 'Bob' });
tree.$.user((c) => ({ ...c, age: c.age + 1 }));

// --- ROOT: state grammar is on `$`; controller is not callable -------------
tree.$({ count: 1, name: 'x', tags: [], user: { name: 'Ada', age: 1 } });
// @ts-expect-error the tree is a controller, not a state location
tree();
