import { describe, expect, it } from 'vitest';

import { signalTree } from './signal-tree';

/**
 * THE CALLABLE CONTRACT (14.0.0).
 *
 * **Branches are callable. Leaves are not.** That asymmetry is not an
 * oversight — it falls straight out of the one fact the design rests on:
 *
 *   only LEAVES are Angular signals; a branch is our own accessor function.
 *
 * We own a branch's call semantics, so `tree.$.user({ name: 'Bob' })` can mean
 * "merge this". We do NOT own a signal's call semantics: calling an Angular
 * signal is a READ, and it discards arguments. So `tree.$.count(5)` returned
 * the current value and changed nothing — silently, with no error at compile
 * time or run time.
 *
 * Through 13.x the type said otherwise. `WritableLeaf<T>` carried
 * `(value: NotFn<T>): void`, so the no-op typechecked.
 * `@signaltree/callable-syntax` was supposed to make it true by rewriting
 * `leaf(v)` to `leaf.set(v)` at build time, and it cannot be delivered to an
 * Angular app at all (RFC 0008 §4). The overloads are gone in 14.0.0.
 *
 * Making it true at runtime was measured and rejected. Speed was not the
 * obstacle — a wrapper costs ~4% on a set+get, inside noise. IDENTITY was:
 * `isSignal(wrapper)` is `false` and `Symbol(SIGNAL)` is absent, so
 * `toObservable`, `model()`/`input()` interop and every third-party tool that
 * guards on `isSignal` would break. That guarantee is worth more than the
 * sugar, and the last test here is what holds us to it.
 */
describe('the callable contract', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // RETIRED — CONTRADICTED, not vacuous.
  //
  //   it('a BRANCH called with an object merges it')
  //       tree.$.user({ name: 'Bob' })  ->  { name: 'Bob', age: 30 }
  //
  // The SUBJECT survives — a branch called with an object still does something
  // definite. The architecture deliberately chose the OPPOSITE behaviour, so
  // this is a contradicted incumbent contract rather than a claim about nothing.
  //
  // Reason of record (GREENFIELD-BRANCH-WRITE-0): merge conflicted with the
  // frozen whole-location assignment contract AND with the ENTITY half of this
  // very grammar, where `node(value)` and `node(updater)` already REPLACED —
  // adopted there deliberately because "under merge semantics removing a key
  // was silently impossible" (entity-signal.spec.ts:2399). `MutationKind` has
  // no `merge`; it decomposed into per-leaf writes and was a surface
  // convenience, never a causal primitive. (`MutationKind` itself was deleted
  // in 15.0 — MUTATION-ENVELOPE-OWNERSHIP-0 — for having no consumer at all.
  // The argument above is unaffected: it is about what `merge` was, not about
  // that enum surviving.)
  //
  // Replaced by the whole-value carrier below.
  // ─────────────────────────────────────────────────────────────────────────
  it('a BRANCH called with an object assigns the whole value', () => {
    const tree = signalTree({ user: { name: 'John', age: 30 } });

    tree.$.user({ name: 'Bob', age: 31 });

    expect(tree.$.user.name()).toBe('Bob');
    expect(tree.$.user.age()).toBe(31);
  });

  it('the whole value REPLACES — a key the caller re-supplies unchanged is not special', () => {
    const tree = signalTree({ user: { name: 'John', age: 30 } });

    // Every key is supplied, so every key is the caller's stated next value.
    tree.$.user({ name: 'John', age: 99 });

    expect(tree.$.user.name()).toBe('John');
    expect(tree.$.user.age()).toBe(99);
  });

  it('patching is a DERIVE — the accurate spelling for a partial intent', () => {
    const tree = signalTree({ user: { name: 'John', age: 30 } });

    // There is no partial VALUE form. Depending on current state is what the
    // updater form is FOR, and it says so at the call site.
    tree.$.user((current) => ({ ...current, age: 31 }));

    expect(tree.$.user.name()).toBe('John');
    expect(tree.$.user.age()).toBe(31);
  });

  it('a BRANCH called with an updater resolves it', () => {
    const tree = signalTree({ m: { hits: 1, misses: 0 } });

    tree.$.m((c) => ({ ...c, hits: c.hits + 10 }));

    expect(tree.$.m.hits()).toBe(11);
  });

  it('the ROOT is callable too', () => {
    const tree = signalTree({ a: 1, b: { c: 2 } });

    tree({ a: 9, b: { c: 8 } });

    expect(tree.$.a()).toBe(9);
    expect(tree.$.b.c()).toBe(8);
  });

  it('a LEAF is written with .set() / .update()', () => {
    const tree = signalTree({ count: 0, name: 'John' });

    tree.$.count.set(5);
    tree.$.name.update((c) => c.toUpperCase());

    expect(tree.$.count()).toBe(5);
    expect(tree.$.name()).toBe('JOHN');
  });

  it('calling a LEAF is a READ — it discards the argument', () => {
    const tree = signalTree({ count: 0 });

    // The 13.x trap, now a compile error. Kept executable through a cast so
    // the RUNTIME half of the claim stays pinned: this is why the overloads
    // had to go rather than merely being discouraged.
    const asSetter = tree.$.count as unknown as (v: number) => unknown;
    const returned = asSetter(5);

    expect(tree.$.count()).toBe(0); // unchanged — the silent no-op
    expect(returned).toBe(0); // it was a read all along
  });

  it('an ARRAY leaf is a leaf — the same rule applies', () => {
    const tree = signalTree({ tags: ['a'] as string[] });

    tree.$.tags.update((c) => [...c, 'b']);

    expect(tree.$.tags()).toEqual(['a', 'b']);
  });

});
