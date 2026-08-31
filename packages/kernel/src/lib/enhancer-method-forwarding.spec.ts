import { vi } from 'vitest';

import { batching } from '../enhancers/batching/batching';
import { devTools } from '../enhancers/devtools/devtools';
import { restoration } from '../enhancers/restoration/restoration';
import { signalTree } from '../index';

/**
 * Enhancers that build a NEW tree object must carry the base tree's methods
 * across by property DESCRIPTOR, not `Object.assign`.
 *
 * `Object.assign` copies only ENUMERABLE own properties, and every tree method
 * — `updateAndReport`, `onPathChange`, `registerCleanup` — is
 * defined `enumerable: false`. They were silently dropped, so the builder
 * wrapping the enhanced tree found nothing to forward to and returned an empty
 * result. `updateAndReport({count:1})` on a `.with(restoration())` tree returned
 * `[]` and never wrote — a dropped write that looked exactly like "nothing
 * changed".
 *
 * This is data loss, it was silent, and it predates the release. These tests
 * fail against every version before the fix.
 */
const ENHANCERS: Array<[string, () => (t: never) => never]> = [
  ['restoration', () => restoration() as never],
  ['batching', () => batching() as never],
  ['devTools', () => devTools({ name: 'x' }) as never],
];

describe.each(ENHANCERS)('%s — writes survive the enhancer', (_name, make) => {
  it('updateAndReport writes AND reports', () => {
    const tree = signalTree(
      { count: 0, other: 'x' },
      { enhancers: [make() as never], capabilities: ['causal-runtime'] }
    );

    const changed = (
      tree as unknown as { updateAndReport: (u: unknown) => string[] }
    ).updateAndReport({ count: 5 });

    expect(tree.$.count()).toBe(5);
    expect(changed).toEqual(['count']);
  });

  // `batchUpdate` and its builder forward were REMOVED in 14.1.1. Root writes
  // now use the root state accessor, so this asserts the surviving write path.
  it('the root accessor writes through the controller (batchUpdate is gone)', () => {
    const tree = signalTree(
      { count: 0 },
      { enhancers: [make() as never], capabilities: ['causal-runtime'] }
    );

    expect(
      (tree as unknown as { batchUpdate?: unknown }).batchUpdate
    ).toBeUndefined();

    tree.$({ count: 3 });
    expect(tree.$.count()).toBe(3);
  });

  it('destroy() still runs registered cleanups and flips destroyed()', () => {
    // The suite passed with `destroy`/`registerCleanup`/`destroyed` dropped from
    // the copy — and that is NOT harmless: with `destroy` missing the builder
    // falls to its else-branch and installs a NO-OP, so restoration history,
    // batching timers and persistence subscriptions all leak, silently.
    const tree = signalTree(
      { count: 0 },
      { enhancers: [make() as never], capabilities: ['causal-runtime'] }
    );
    let ran = 0;
    (
      tree as unknown as { registerCleanup: (f: () => void) => void }
    ).registerCleanup(() => ran++);

    (tree as unknown as { destroy: () => void }).destroy();

    expect(ran).toBe(1);
    expect((tree as unknown as { destroyed: () => boolean }).destroyed()).toBe(
      true
    );
  });

  it('keeps $ identity, so leaf refs held across the enhancer still work', () => {
    // v15 has no late enhancement, so there is no "tree before the enhancer"
    // to hold a reference from. The guarantee is unchanged, though — an
    // enhancer that returns a NEW tree object must not swap `$` — so the
    // pre-enhancer reference is taken from inside the enhancer chain instead,
    // by a probe declared ahead of the enhancer under test.
    //
    // This depends on independent enhancers applying in declaration order,
    // which the test below this describe block pins directly; if that ever
    // stops holding, this test goes vacuous rather than wrong, and that test
    // fails first.
    let seen$: unknown;
    let seenLeaf: unknown;
    const probe = (t: unknown) => {
      seen$ = (t as { $: unknown }).$;
      seenLeaf = (t as { $: { count: unknown } }).$.count;
      return t;
    };

    const tree = signalTree(
      { count: 0 },
      { enhancers: [probe as never, make() as never] }
    );

    expect((tree as unknown as { $: unknown }).$).toBe(seen$);
    expect((tree as unknown as { $: { count: unknown } }).$.count).toBe(
      seenLeaf
    );

    // A write through the PRE-enhancer leaf reference must be visible through
    // the enhanced tree.
    (seenLeaf as { set: (v: number) => void }).set(42);
    expect(tree.$().count).toBe(42);
  });

  it('does not expose the retired bind helper', () => {
    const tree = signalTree(
      { count: 0 },
      { enhancers: [make() as never], capabilities: ['causal-runtime'] }
    );
    expect((tree as unknown as { bind?: unknown }).bind).toBeUndefined();
  });

  it('the controller is not callable', () => {
    const tree = signalTree(
      { count: 0 },
      { enhancers: [make() as never], capabilities: ['causal-runtime'] }
    );
    expect(typeof tree).toBe('object');
  });
});

describe('enhancer application order', () => {
  it('applies independent enhancers in declaration order', () => {
    // Nothing in the dependency graph relates these two, so the topological
    // sort must leave them as declared. The `$`-identity tests above read a
    // pre-enhancer reference by declaring a probe first, and rely on this.
    const log: string[] = [];
    const mark = (name: string) => (t: unknown) => {
      log.push(name);
      return t;
    };

    signalTree(
      { count: 0 },
      { enhancers: [mark('first') as never, mark('second') as never] }
    );

    expect(log).toEqual(['first', 'second']);
  });
});

describe('stacked enhancers', () => {
  it('survive two layers', () => {
    const tree = signalTree(
      { count: 0 },
      {
        enhancers: [restoration() as never, batching() as never],
        capabilities: ['causal-runtime'],
      }
    );

    const changed = (
      tree as unknown as { updateAndReport: (u: unknown) => string[] }
    ).updateAndReport({ count: 4 });

    expect(tree.$.count()).toBe(4);
    expect(changed).toEqual(['count']);
  });
});

describe('a missing forward target is loud', () => {
  it('reports ST2017 rather than returning an empty result', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      // An enhancer that drops the base tree's methods — exactly what
      // Object.assign did. The forwarder must not pretend nothing changed.
      const broken = (t: unknown) => {
        const fresh = function () {
          return undefined;
        } as unknown as Record<string, unknown>;
        fresh['$'] = (t as Record<string, unknown>)['$'];
        return fresh;
      };
      const tree = signalTree(
        { count: 0 },
        { enhancers: [broken as never], capabilities: ['causal-runtime'] }
      );

      const changed = (
        tree as unknown as { updateAndReport: (u: unknown) => string[] }
      ).updateAndReport({ count: 1 });

      expect(changed).toEqual([]);
      expect(spy).toHaveBeenCalled();
      expect(String(spy.mock.calls[0]?.[0])).toContain('ST2017');
    } finally {
      spy.mockRestore();
    }
  });
});
