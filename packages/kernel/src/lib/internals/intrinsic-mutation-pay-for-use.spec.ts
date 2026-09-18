import { describe, expect, it } from 'vitest';

import {
  getIntrinsicMutationObserver,
  observeIntrinsicMutations,
  registerIntrinsicMutationSource,
} from './intrinsic-mutation';
import { createTreeScalarLeafRuntime } from './tree-scalar-leaf-runtime';

/**
 * The bare mutation path must not consult capture machinery it did not
 * configure, and the optimization that buys that must not be able to silence a
 * real observer.
 *
 * `getIntrinsicMutationObserver` short-circuits on a process-wide count of
 * installed observers, so every write on a tree with no inspection skips the
 * WeakMap probe entirely — measured at -22.3% on the Angular native scalar
 * write. The failure mode that buys is specific: an observer installed AFTER
 * the count has already been zero, which a naive "remember there are none"
 * cache would miss forever. Existing coverage in `tree-scalar-slot-runtime.spec`
 * installs its observer before writing, so it cannot see that.
 *
 * Every test here writes FIRST, with nothing observing, and only then attaches.
 */
describe('intrinsic mutation observation is pay-for-use', () => {
  it('reports no observer while nothing is attached', () => {
    const node = {};
    registerIntrinsicMutationSource(node);
    expect(getIntrinsicMutationObserver(node)).toBeUndefined();
  });

  it('still notifies an observer attached after unobserved writes', () => {
    const runtime = createTreeScalarLeafRuntime(undefined);
    const location = runtime.createLeaf<string>('A', Object.is);

    location('B');
    location('C');

    const seen: string[] = [];
    observeIntrinsicMutations<string>(location, (mutation) =>
      seen.push(`${mutation.before}->${mutation.after}`)
    );

    location('D');
    expect(seen).toEqual(['C->D']);
  });

  it('stops notifying after release, and resumes when attached again', () => {
    const runtime = createTreeScalarLeafRuntime(undefined);
    const location = runtime.createLeaf<string>('A', Object.is);

    const first: string[] = [];
    const release = observeIntrinsicMutations<string>(location, (mutation) =>
      first.push(mutation.after)
    );
    location('B');
    release?.();

    // The count is back to zero here — the short-circuit is live again.
    location('C');
    expect(first).toEqual(['B']);

    const second: string[] = [];
    observeIntrinsicMutations<string>(location, (mutation) =>
      second.push(mutation.after)
    );
    location('D');
    expect(second).toEqual(['D']);
  });

  it('does not let one leaf’s observer mask another leaf', () => {
    const runtime = createTreeScalarLeafRuntime(undefined);
    const watched = runtime.createLeaf<string>('A', Object.is);
    const unwatched = runtime.createLeaf<string>('A', Object.is);

    const seen: string[] = [];
    observeIntrinsicMutations<string>(watched, (mutation) =>
      seen.push(mutation.after)
    );

    unwatched('ignored');
    watched('kept');

    expect(seen).toEqual(['kept']);
    expect(unwatched()).toBe('ignored');
  });

  it('releasing one of two observers keeps the other live', () => {
    const runtime = createTreeScalarLeafRuntime(undefined);
    const location = runtime.createLeaf<string>('A', Object.is);

    const kept: string[] = [];
    const dropped: string[] = [];
    observeIntrinsicMutations<string>(location, (m) => kept.push(m.after));
    const release = observeIntrinsicMutations<string>(location, (m) =>
      dropped.push(m.after)
    );

    location('B');
    release?.();
    location('C');

    expect(kept).toEqual(['B', 'C']);
    expect(dropped).toEqual(['B']);
  });

  it('a double release cannot drive the count below zero', () => {
    const runtime = createTreeScalarLeafRuntime(undefined);
    const guard = runtime.createLeaf<string>('A', Object.is);
    const other = runtime.createLeaf<string>('A', Object.is);

    const release = observeIntrinsicMutations<string>(guard, () => undefined);
    release?.();
    release?.();

    // If the second release had decremented again, the count would be -1 and
    // the short-circuit (`=== 0`) would stop firing for every other leaf.
    const seen: string[] = [];
    observeIntrinsicMutations<string>(other, (m) => seen.push(m.after));
    other('B');
    expect(seen).toEqual(['B']);
  });
});
