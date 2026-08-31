import { describe, expect, it } from 'vitest';

import { entityMap } from './types';
import { bindSignalTreeRealization, signalTree } from './signal-tree';
import { NEUTRAL_TREE_REALIZATION } from './internals/tree-realization';

const FAKE_REACTIVE = Symbol('fake-reactive');

type FakeWritable<T> = {
  (): T;
  set(value: T): void;
  update(update: (value: T) => T): void;
  asReadonly(): () => T;
  readonly [FAKE_REACTIVE]: true;
};

const fakeWritable = <T,>(initial: T): FakeWritable<T> => {
  let value = initial;
  const cell = (() => value) as FakeWritable<T>;
  cell.set = (next) => {
    value = next;
  };
  cell.update = (update) => cell.set(update(value));
  cell.asReadonly = () => cell;
  Object.defineProperty(cell, FAKE_REACTIVE, { value: true });
  return cell;
};

const fakeSignalTree = bindSignalTreeRealization({
  ...NEUTRAL_TREE_REALIZATION,
  cell: { createCell: fakeWritable },
  materialization: {
    isReactiveNode: (value) =>
      typeof value === 'function' &&
      (value as Partial<FakeWritable<unknown>>)[FAKE_REACTIVE] === true,
  },
});

/**
 * A DERIVED VALUE IS NOT STATE, AT ANY TOUCH ORDER.
 *
 * This is the same rule markers now follow — a snapshot carries state, and
 * anything recomputable is structure — but `.derived()` did not follow it, and
 * whether it did depended on the order the tree was first touched:
 *
 *   tree.$() first, never touch `$`  → absent   (correct, by accident)
 *   touch `$` at all, then tree.$()  → PRESENT  (wrong)
 *
 * because `finalize()` (the `$` getter) applies configured derived state while the
 * `tree.$()` call path runs only `materializeOnly()`. **Every real application is
 * the second case** — you write state through `$`, then persist — so derived
 * values were reaching localStorage, devtools and audit in practice.
 *
 * The existing test in `rehydration.spec.ts` covers only the first order:
 * `signalTree(...).derived(...)` then immediately `expect(tree.$())`, never
 * touching `$`. It passed, and it pinned the one order nobody uses.
 *
 * Confirmed pre-existing: the same probe against the `v13.5.0` tag produces
 * identical output, so this is inherited rather than introduced by the
 * marker/snapshot work. It is fixed HERE because 14.0.0 already changes the
 * payload shape — fixing it later would be a SECOND breaking payload change,
 * which is exactly what the deadline on `SNAPSHOT_FORMAT_VERSION` exists to
 * avoid.
 */
const mk = () =>
  signalTree(
    { a: 2, b: 3 },
    {
      derived: ($) => ({
        sum: () => $.a() + $.b(),
      }),
    }
  );

describe('derived state never reaches a snapshot', () => {
  it('tree.$() first, never touching $', () => {
    expect(mk().$()).toEqual({ a: 2, b: 3 });
  });

  it('merely touching $ first — the case that used to leak', () => {
    const tree = mk();
    void tree.$;
    expect(tree.$()).toEqual({ a: 2, b: 3 });
  });

  it('writing through $ first — what every real app does', () => {
    const tree = mk();
    tree.$.a.set(7);
    expect(tree.$()).toEqual({ a: 7, b: 3 });
  });

  it('reading the derived first', () => {
    const tree = mk();
    expect(tree.$.sum()).toBe(5);
    expect(tree.$()).toEqual({ a: 2, b: 3 });
  });

  it('THE SNAPSHOT IS ORDER-INDEPENDENT — the deeper guarantee', () => {
    const untouched = mk();
    const touched = mk();
    void touched.$;
    const written = mk();
    written.$.a.set(2); // same value, but through `$`

    expect(untouched.$()).toEqual(touched.$());
    expect(touched.$()).toEqual(written.$());
  });

  it('the derived still WORKS and still recomputes', () => {
    const tree = mk();
    expect(tree.$.sum()).toBe(5);
    tree.$.a.set(100);
    expect(tree.$.sum()).toBe(103);
  });

  it('a stale derived can no longer be persisted', () => {
    const tree = mk();
    void tree.$;
    const before = tree.$() as Record<string, unknown>;
    tree.$.a.set(100);

    // Previously `before.sum` was 5 while the live value had become 103 — a
    // number that was true once, sitting in storage.
    expect(before).not.toHaveProperty('sum');
    expect(tree.$()).not.toHaveProperty('sum');
  });

  it('holds with markers in the tree too', () => {
    const tree = signalTree(
      {
        rows: entityMap<{ id: number }, number>({ selectId: (r) => r.id }),
        n: 1,
      },
      {
        derived: ($) => ({
          total: () => $.rows.all().length + $.n(),
        }),
      }
    );
    tree.$.rows.setAll([{ id: 1 }]);

    expect(tree.$()).toEqual({ rows: { all: [{ id: 1 }] }, n: 1 });
  });

  it('a recognized writable value in derived() stays writable but is not snapshot state', () => {
    // Writable carrier capability does not change configured-derived
    // ownership. The location remains available under `$`, while NaturalValue
    // snapshots continue to contain source and marker state only.
    const tree = fakeSignalTree(
      { a: 1 },
      {
        derived: () => ({
          manual: fakeWritable(42),
        }),
      }
    );
    void tree.$;

    expect(tree.$.manual()).toBe(42);
    tree.$.manual.set(7);
    expect(tree.$.manual()).toBe(7);
    expect(tree.$()).toEqual({ a: 1 });
  });

  it('a snapshot round-trips and the derived recomputes from it', () => {
    const src = mk();
    void src.$;
    src.$.a.set(10);
    const snap = src.$();

    const dst = mk();
    void dst.$;
    dst.$(snap);

    expect(dst.$.sum()).toBe(13); // recomputed, not restored
    expect(dst.$()).toEqual({ a: 10, b: 3 });
  });
});
