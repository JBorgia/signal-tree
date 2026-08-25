import { describe, expect, it } from 'vitest';

import { entityMap } from './types';
import { restoration } from '../enhancers/restoration/restoration';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';

/**
 * NESTED-STRUCTURAL-ROLLBACK-1 — the broadened discriminator.
 *
 * ```text
 * NULL       the failure is specific to the measured nested `addOne` shape
 * FALSIFIER  structural transaction compensation has a path/scope defect for
 *            nested entityMap positions GENERALLY
 * ```
 *
 * ## ⚠️ FALSIFIED — and FIXED. The matrix below is the PRE-FIX measurement
 *
 * ```text
 *              addOne  addMany  updateOne  upsertOne  removeOne  setAll  clear
 * top            ok      ok        ok         ok         ok       ok      ok
 * data.rows     THREW   THREW     THREW      THREW       ok       ok      ok
 * a.b.rows      THREW   THREW     THREW      THREW       ok       ok      ok
 * ```
 *
 * Anything that CREATES OR MODIFIES a subject refuses; removals succeed. Depth
 * beyond one level changes nothing.
 *
 * ⚠️ `setAll` and `clear` are recorded from a SEEDED collection and are NOT
 * uniformly safe: `setAll` on an EMPTY nested collection also throws, because
 * replacing nothing with something CREATES a subject. The dividing line is
 * SUBJECT CREATION, not the operation's name.
 *
 * ## The boundary, traced rather than guessed
 *
 * Every layer that could plausibly lose nested identity was measured and is
 * CORRECT:
 *
 * ```text
 * delivered ownerPath          "data.rows"          ✓
 * delivered positionIds        [3] = the collection ✓
 * registry.contains(root,coll) true                 ✓
 * structuralOwnerPaths index   [3 -> "data.rows"]   ✓
 * resolveNodeAtPath            splits on "."        ✓
 * ```
 *
 * The loss is in ONE function. Instrumenting `canApplyEffect`:
 *
 * ```text
 * top     descPath="rows"   resolved="rows"    ownerNode=true
 * nested  descPath="data"   resolved="data"    ownerNode=false  -> REJECT
 * ```
 *
 * `resolveCollectionPath` prefers `descriptor.collectionPath`, and that
 * descriptor holds the PARENT branch's path. It comes from
 * `deriveCollectionPath` in `tree-realization-adapter.ts`:
 *
 * ```text
 * if (!ownerPath.includes('.')) return ownerPath;   // top-level: "rows"      ✓
 * if (typeof subjectId !== 'number') return undefined;
 * return parentPath(ownerPath);                     // nested: "data.rows"
 *                                                   //      -> "data"        ✗
 * ```
 *
 * ⚠️ **The derivation is STRING-SHAPED AND AMBIGUOUS.** It answers "given a
 * row-field path, which collection contains it?" by stripping the last segment
 * — right when `ownerPath` names a ROW (`rows.x`), wrong when it names a NESTED
 * COLLECTION (`data.rows`). Those two are indistinguishable as strings.
 * Top-level works only because a collection at the root has no dot and takes the
 * earlier branch.
 *
 * So this is NOT a missing identity. The correct answer already exists in
 * `structuralOwnerPaths` (positionId -> collection ownerPath), and the string
 * derivation OVERRIDES it because `resolveCollectionPath` consults the
 * descriptor first. The fix belongs at the derivation — it should consult
 * whether the position IS a collection rather than guess from shape — and must
 * not weaken the planner's refusal, which behaves correctly given the bad path
 * it was handed.
 *
 * Reported before patching, per the standing rule that a broadened inventory
 * exposing a larger defect stops for its boundary to be named.
 *
 * ## FIXED by STRUCTURAL-PATH-1
 *
 * `deriveCollectionPath`'s `path === ownerPath` branch now returns `undefined`
 * instead of `parentPath(ownerPath)`: if a notification's path IS its owner
 * path, it is ABOUT the owner and names no containing collection. Every row of
 * the nested matrix now passes, including the two-tree case.
 */

const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

type Row = { id: string; n: number };
const em = () => entityMap<Row, string>({ selectId: (r) => r.id });

type Rows = {
  addOne(r: Row): void;
  addMany(r: Row[]): void;
  updateOne(id: string, patch: Partial<Row>): void;
  upsertOne(r: Row): void;
  removeOne(id: string): void;
  setAll(r: Row[]): void;
  clear(): void;
  all(): Row[];
};

const shapes = {
  top: {
    make: () =>
      signalTree({ rows: em() }, { enhancers: [restoration(), transactions()] }),
    rows: (t: unknown) => (t as { $: { rows: Rows } }).$.rows,
  },
  nested: {
    make: () =>
      signalTree(
        { data: { rows: em() } },
        { enhancers: [restoration(), transactions()] }
      ),
    rows: (t: unknown) => (t as { $: { data: { rows: Rows } } }).$.data.rows,
  },
};

const attempt = async (
  shape: keyof typeof shapes,
  seed: boolean,
  op: (r: Rows) => void
) => {
  const s = shapes[shape];
  const tree = s.make();
  await flush();
  const rows = s.rows(tree);
  if (seed) {
    rows.addOne({ id: 'seed', n: 0 });
    await flush();
  }
  const before = JSON.stringify(rows.all());
  const p = (
    tree as unknown as {
      transaction: (fn: () => void) => { rollback(): void };
    }
  ).transaction(() => op(rows));
  await flush();
  let threw = false;
  try {
    p.rollback();
  } catch {
    threw = true;
  }
  await flush();
  return { threw, restored: JSON.stringify(rows.all()) === before };
};

const OPERATIONS: Array<[string, boolean, (r: Rows) => void]> = [
  ['addOne', false, (r) => r.addOne({ id: 'x', n: 1 })],
  [
    'addMany',
    false,
    (r) =>
      r.addMany([
        { id: 'x', n: 1 },
        { id: 'y', n: 2 },
      ]),
  ],
  ['updateOne', true, (r) => r.updateOne('seed', { n: 99 })],
  ['upsertOne', true, (r) => r.upsertOne({ id: 'seed', n: 42 })],
  ['removeOne', true, (r) => r.removeOne('seed')],
  ['setAll', true, (r) => r.setAll([{ id: 'z', n: 3 }])],
  ['clear', true, (r) => r.clear()],
];

/**
 * ⚠️ WHAT STRUCTURAL-PATH-1 DID NOT FIX, and exactly why.
 *
 * OWNER-PING-0 (qualifying the owner-only ping with `ownerId`) fixed the entire
 * TWO-TREE axis on its own — D, F, G and the isolation case. The NESTED axis
 * remains, and needs STRUCTURAL-PATH-1, whose first candidate was FALSIFIED (see
 * the audit record).
 *
 * `updateOne` / `upsertOne` additionally produce a SCALAR row-field effect, not
 * a structural one, so they never reach `canApplyEffect`'s structural branch.
 * Instrumenting the scalar branch:
 *
 * ```text
 * top     path=rows.seed.n       descColl=rows       target=true
 * nested  path=data.rows.seed.n  descColl=data.rows  target=FALSE
 *         subjDesc { path: "data.rows", fieldPathFromRow: "" }
 * ```
 *
 * ⚠️ THAT READING WAS TAKEN UNDER THE FALSIFIED CANDIDATE. `descColl=data.rows`
 * was true only while the reverted patch was applied; at HEAD it is `"data"`
 * again. What the experiment actually proved is NARROWER and still useful:
 * fixing `collectionPath` alone is INSUFFICIENT, because the subject descriptor
 * — written by `deriveFieldPathFromRow`, the sibling helper — records subject 1
 * at path `"data.rows"` with an empty field path and carries the SAME overloaded
 * `ownerPath` ambiguity.
 *
 * Recorded rather than patched in the same pass: it is a second derivation with
 * its own inventory to do, and bundling it would repeat the mistake of fixing by
 * reproducer rather than by rule.
 */
/**
 * ⚠️ EMPTY — ADDRESS-REPAIR-1 closed every one of these.
 *
 * Kept as a list rather than deleted so a regression re-reds a NAMED operation
 * instead of quietly turning one assertion around.
 */
const STILL_RED: string[] = [];

describe('NESTED-STRUCTURAL-ROLLBACK-1: top-level CONTROL', () => {
  for (const [name, seed, op] of OPERATIONS) {
    it(`${name} rolls back cleanly`, async () => {
      const r = await attempt('top', seed, op);
      expect(r.threw).toBe(false);
      expect(r.restored).toBe(true);
    });
  }
});

describe('NESTED-STRUCTURAL-ROLLBACK-1: nested', () => {
  for (const [name, seed, op] of OPERATIONS) {
    // ⚠️ WAS KNOWN RED for every subject-creating/modifying operation.
    // STRUCTURAL-PATH-1 fixed addOne, addMany and the two-tree case;
    // ADDRESS-REPAIR-1 closed the rest by making the owner position's REGISTERED
    // collection address the authority, so `data.rows` is never read as `data`.
    const stillRed = STILL_RED.includes(name);
    const runner = stillRed ? it.fails : it;
    runner(`${stillRed ? '⚠️ KNOWN RED — ' : ''}${name} rolls back cleanly`, async () => {
      const r = await attempt('nested', seed, op);
      expect(r.threw).toBe(false);
      expect(r.restored).toBe(true);
    });
  }
});

describe('NESTED-STRUCTURAL-ROLLBACK-1: isolation', () => {
  /**
   * ⚠️ KNOWN RED, AND IT WIDENS THE DEFECT ON TWO AXES.
   *
   * `removeOne` on a nested collection rolls back fine with ONE tree. Add a
   * SECOND tree of the same shape and it throws — and the row is NOT restored:
   *
   * ```text
   * NESTED, one tree    threw=false  restored ✓
   * NESTED, two trees   threw=true   NOT restored ✗
   * TOP,    one tree    threw=false  restored ✓
   * TOP,    two trees   threw=false  restored ✓
   * ```
   *
   * So the operation matrix above is the ONE-TREE picture. With a second
   * same-shaped tree present, even the "safe" nested operations fail.
   *
   * ⚠️ CORRECTION TO AN EARLIER CHARACTERISATION. I called this "silent data
   * loss". It is not silent — `rollback()` THROWS `SignalTreeRollbackError`.
   * And it is the SAME failure class as the one-tree cases, not a new one:
   *
   * ```text
   * rollback requested -> rollback REFUSED -> the transaction's speculative
   * state remains materialised
   *
   *   addOne     the speculative ADDITION remains
   *   removeOne  the speculative DELETION remains
   * ```
   *
   * The second tree widens the defect's REACH — it makes an operation that
   * succeeds with one tree fail with two — not its severity class.
   *
   * Cross-tree and top-level are unaffected, which points at the same
   * truncated-path boundary rather than a second unrelated cause — but that is
   * an inference, and the fix must confirm it.
   */
  it('rolling back tree A with a second same-shaped tree present', async () => {
    const a = shapes.nested.make();
    const b = shapes.nested.make();
    await flush();
    shapes.nested.rows(b).addOne({ id: 'b-only', n: 1 });
    await flush();

    // SEEDED, and using an operation measured safe on a nested collection. The
    // first version used `setAll` on an EMPTY collection and threw, which
    // refines the matrix: replacing an empty collection CREATES a subject and
    // lands in the broken class.
    shapes.nested.rows(a).addOne({ id: 'a-seed', n: 1 });
    await flush();

    const p = (
      a as unknown as { transaction: (fn: () => void) => { rollback(): void } }
    ).transaction(() => {
      shapes.nested.rows(a).removeOne('a-seed');
    });
    await flush();
    p.rollback();
    await flush();

    expect(shapes.nested.rows(a).all()).toHaveLength(1);
    expect(shapes.nested.rows(b).all()).toHaveLength(1);
    expect(shapes.nested.rows(b).all()[0].id).toBe('b-only');
  });
});
