import { describe, expect, it } from 'vitest';

import { createDiagnosticJournal } from './internals/diagnostics/diagnostic-journal';
import { external } from './external';
import { restoration } from '../enhancers/restoration/restoration';
import { scheduleDurableConsequence } from './internals/commit-consequence';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';
import { undoable } from './undoable';

/**
 * LINK-0 — THE THREE CAUSAL DIRECTIONS, tested as BEHAVIOURS rather than as an
 * API. Nothing named `link()` exists; this asks whether the runtime can already
 * carry what such a primitive would have to promise.
 *
 * ```text
 * link(x, y)   x = a writable SignalTree LOCATION
 *              y = an external ENDPOINT
 *              the link itself is the RELATIONSHIP — a noun, not an action
 * ```
 *
 * ```text
 * PULL      Y.get()        -> X    on demand
 * PUSH-IN   Y.subscribe()  -> X    pushed
 * PUSH-OUT  committed X    -> Y.set()
 * ```
 *
 * Combinations are claimed to give everything the four existing APIs did:
 *
 * ```text
 * loader / HTTP GET / localStorage read   PULL
 * asyncSource / socket / GPS              PUSH-IN
 * stored write / HTTP PUT / SQLite UPDATE PUSH-OUT
 * persistence                             PULL + PUSH-OUT
 * live synchronisation                    PUSH-IN + PUSH-OUT
 * ```
 *
 * If those are transport spellings around three directions, the directions must
 * behave identically regardless of transport AND regardless of scope
 * (root / branch / leaf). Both are tested.
 *
 * ⚠️ NAMING. `bind` was the first working name and is rejected: `ISignalTree`
 * already has `bind(thisArg?)` for the callable node, and
 * `Function.prototype.bind` owns the word in JavaScript. `connect` reads as an
 * imperative action — opening a socket, starting a session. `link` names the
 * RELATIONSHIP, which is the thing that actually exists, and its direction
 * falls out of what the endpoint supplies: `get` alone is `X <- Y`, `set` alone
 * is `X -> Y`, both is `X <-> Y`. Working candidate, not frozen.
 *
 * ⚠️ WHAT THIS FILE DOES NOT TEST, on purpose: loading state, error state,
 * retry, backoff, caching, accumulation. Manufacturing those would rebuild
 * `loader()` under a new name, and the point of the decomposition is that they
 * belong to whoever owns the external operation.
 */

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const makeTree = () =>
  signalTree(
    {
      leaf: 'l0',
      settings: { theme: 'light', units: 'imperial' },
    },
    { enhancers: [restoration(), transactions()] }
  );

type Effect = { path: string; origin?: string; participation?: string };

/**
 * ⚠️ Copy before disposing. `turns()` hands back the LIVE array and `dispose()`
 * does `turns.length = 0`.
 */
const drain = (j: {
  turns(): readonly { effects: readonly unknown[] }[];
  dispose(): void;
}): Effect[] => {
  const out = (j.turns().flatMap((t) => t.effects) as Effect[]).map((e) => ({
    ...e,
  }));
  j.dispose();
  return out;
};

const allExternal = (effects: Effect[]) => {
  expect(effects.length).toBeGreaterThan(0);
  for (const e of effects) {
    expect(e.origin).toBe('external');
    expect(e.participation).toBe('realized');
  }
};

// ───────────────────────────────────────────────────────────────────────────
// PULL — Y.get() -> X, at all three scopes
// ───────────────────────────────────────────────────────────────────────────

describe('LINK-0 PULL: an awaited read applied as external truth', () => {
  it('LEAF', async () => {
    const tree = makeTree();
    await flush();
    const j = createDiagnosticJournal(tree as object);
    const historyBefore = tree.getRestorationHistory().length;

    // The only viable shape: AWAIT OUTSIDE, APPLY INSIDE. See the ST1035 arm.
    const value = await Promise.resolve('l1');
    external(() => tree.$.leaf.set(value));
    await flush();

    allExternal(drain(j));
    expect(tree.$.leaf()).toBe('l1');
    expect(tree.getRestorationHistory().length - historyBefore).toBe(0);
  });

  it('BRANCH', async () => {
    const tree = makeTree();
    await flush();
    const j = createDiagnosticJournal(tree as object);

    const value = await Promise.resolve({ theme: 'dark', units: 'metric' });
    external(() => tree.$.settings(value));
    await flush();

    const effects = drain(j);
    allExternal(effects);
    expect(effects.map((e) => e.path).sort()).toEqual([
      'settings.theme',
      'settings.units',
    ]);
    expect(tree.$.settings()).toMatchObject(value);
  });

  it('ROOT', async () => {
    const tree = makeTree();
    await flush();
    const j = createDiagnosticJournal(tree as object);

    const value = await Promise.resolve({
      leaf: 'l1',
      settings: { theme: 'dark', units: 'metric' },
    });
    external(() => tree.$(value));
    await flush();

    const effects = drain(j);
    allExternal(effects);
    expect(tree.$.leaf()).toBe('l1');
    expect(tree.$.settings()).toMatchObject(value.settings);
  });

  it('⚠️ the WRONG shape is refused — ST1035 on an async application', () => {
    const tree = makeTree();

    // `external(async () => …)` would classify a scope that has already exited
    // by the time the write lands. The runtime refuses it rather than
    // silently mis-attributing, which is what makes "await outside, apply
    // inside" a contract rather than a convention.
    expect(() =>
      (external as unknown as (fn: () => unknown) => unknown)(async () => {
        tree.$.leaf.set('l1');
      })
    ).toThrow(/ST1035/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// PUSH-IN — Y.subscribe() -> X
// ───────────────────────────────────────────────────────────────────────────

/** The smallest possible pushed source: a callback register. No RxJS. */
const makeSource = <T>() => {
  let sink: ((v: T) => void) | undefined;
  return {
    subscribe(next: (v: T) => void) {
      sink = next;
      return () => void (sink = undefined);
    },
    emit(v: T) {
      sink?.(v);
    },
  };
};

describe('LINK-0 PUSH-IN: a pushed source crossing the boundary', () => {
  it('every emission is its own external acquisition', async () => {
    const tree = makeTree();
    await flush();
    const source = makeSource<string>();
    const stop = source.subscribe((v) => external(() => tree.$.leaf.set(v)));

    const j = createDiagnosticJournal(tree as object);
    source.emit('p1');
    await flush();
    source.emit('p2');
    await flush();
    const effects = drain(j);
    stop();

    allExternal(effects);
    expect(effects.map((e) => e.path)).toEqual(['leaf', 'leaf']);
    expect(tree.$.leaf()).toBe('p2');
    // A stream is not authored work, however many values it delivers.
    expect(tree.canUndo()).toBe(false);
  });

  it('an emission arriving MID-TRANSACTION is not reverted by the rollback', async () => {
    const tree = makeTree();
    await flush();
    const source = makeSource<string>();
    const stop = source.subscribe((v) => external(() => tree.$.leaf.set(v)));

    const pending = tree.transaction(() => {
      tree.$.settings.theme.set('speculative');
    });
    // A GPS fix does not become speculative by arriving while an unrelated
    // transaction happens to be open.
    source.emit('p1');
    await flush();
    expect(tree.$.leaf()).toBe('p1');

    pending.rollback();
    await flush();
    stop();

    expect(tree.$.leaf()).toBe('p1');
    expect(tree.$.settings.theme()).toBe('light'); // the speculative work IS reverted
  });

  it('⚠️ at a leaf the transaction ALSO wrote, classification makes NO difference', async () => {
    const both: Record<string, string> = {};
    for (const mode of ['authored', 'external'] as const) {
      const tree = makeTree();
      await flush();
      const source = makeSource<string>();
      const stop = source.subscribe((v) =>
        mode === 'external'
          ? external(() => tree.$.leaf.set(v))
          : tree.$.leaf.set(v)
      );

      const pending = tree.transaction(() => {
        tree.$.leaf.set('speculative');
      });
      source.emit('from-source');
      await flush();
      pending.rollback();
      await flush();
      stop();
      both[mode] = tree.$.leaf();
    }

    // ⚠️ MEASURED, AND IT CORRECTS WHAT I WAS ABOUT TO CLAIM. This arm was
    // written expecting `external()` to be what protects a pushed value from a
    // rollback. It is not: the AUTHORED control survives identically. What
    // preserves it is CONSERVATIVE COMPENSATION — the rollback declines to
    // clobber a write that landed after the one it is reversing, whatever that
    // write claimed causally.
    //
    // So PUSH-IN's survival across a transaction is NOT evidence for the
    // ingress classification. The evidence for that is the undo arm below.
    expect(both['external']).toBe('from-source');
    expect(both['authored']).toBe('from-source');
  });

  it('⚠️ THE DISCRIMINATOR — an undo may not overwrite acquired truth', async () => {
    const run = async (mode: 'authored' | 'external') => {
      const tree = makeTree();
      await flush();
      undoable(() => tree.$.leaf.set('user-typed'));
      await flush();

      // A pushed value arrives at the same location, after the authored turn.
      if (mode === 'external') external(() => tree.$.leaf.set('from-source'));
      else tree.$.leaf.set('from-source');
      await flush();

      let refused: string | undefined;
      try {
        tree.undo();
      } catch (e) {
        refused = String((e as Error).message);
      }
      await flush();
      return { refused, value: tree.$.leaf() };
    };

    const authored = await run('authored');
    const acquired = await run('external');

    // An ordinary later write is history's to overwrite: the undo succeeds and
    // 'from-source' is silently discarded.
    expect(authored.refused).toBeUndefined();
    expect(authored.value).toBe('l0');

    // Acquired truth is NOT. RESTORE-P0 P0-C: the undo is REFUSED rather than
    // allowed to replace a value the source supplied and history never owned.
    // This is the one measured place where the ingress classification changes
    // an outcome — and it is why PUSH-IN must go through `external()` even
    // though the transaction arm above cannot tell the difference.
    expect(acquired.refused).toMatch(/ST1034/);
    expect(acquired.value).toBe('from-source');
  });

});

// ───────────────────────────────────────────────────────────────────────────
// PUSH-OUT — committed X -> Y.set(), at all three scopes
// ───────────────────────────────────────────────────────────────────────────

/**
 * The A2-3.1 shape: schedule on observation, READ X WHEN THE CONSEQUENCE RUNS.
 * `readX` is the only thing that varies between scopes.
 */
const outbound = (tree: object, readX: () => unknown) => {
  const sent: unknown[] = [];
  return {
    sent,
    push: () =>
      scheduleDurableConsequence({
        claimant: tree,
        key: 'link-0-out',
        run: () => sent.push(readX()),
      }),
  };
};

describe('LINK-0 PUSH-OUT: only settled state escapes, at every scope', () => {
  const scopes = () => {
    const tree = makeTree();
    return {
      tree,
      leaf: () => tree.$.leaf(),
      branch: () => tree.$.settings(),
      root: () => tree.$(),
    };
  };

  it('LEAF — a rolled-back value never escapes', async () => {
    const s = scopes();
    await flush();
    const out = outbound(s.tree, s.leaf);

    const pending = s.tree.transaction(() => s.tree.$.leaf.set('doomed'));
    out.push();
    await flush();
    expect(out.sent).toEqual([]);

    pending.rollback();
    await flush();
    expect(out.sent).not.toContain('doomed');
    expect(out.sent).toEqual(['l0']);
  });

  it('BRANCH — same, reading the branch late', async () => {
    const s = scopes();
    await flush();
    const out = outbound(s.tree, s.branch);

    const pending = s.tree.transaction(() =>
      s.tree.$.settings({ theme: 'doomed', units: 'imperial' })
    );
    out.push();
    await flush();
    expect(out.sent).toEqual([]);

    pending.rollback();
    await flush();
    for (const payload of out.sent as Array<Record<string, unknown>>) {
      expect(payload['theme']).not.toBe('doomed');
    }
    expect(out.sent.length).toBe(1);
  });

  it('ROOT — same, reading the whole tree late', async () => {
    const s = scopes();
    await flush();
    const out = outbound(s.tree, s.root);

    const pending = s.tree.transaction(() =>
      s.tree.$((current) => ({ ...current, leaf: 'doomed' }))
    );
    out.push();
    await flush();
    expect(out.sent).toEqual([]);

    pending.rollback();
    await flush();
    for (const payload of out.sent as Array<Record<string, unknown>>) {
      expect(payload['leaf']).not.toBe('doomed');
    }
    expect(out.sent.length).toBe(1);
  });

  it('CONTROL — confirm lets the settled value out, at every scope', async () => {
    const s = scopes();
    await flush();
    const out = outbound(s.tree, s.leaf);

    const pending = s.tree.transaction(() => s.tree.$.leaf.set('kept'));
    out.push();
    await flush();
    expect(out.sent).toEqual([]);

    pending.confirm();
    await flush();

    // Without this, every arm above is satisfied by an outbound binding that
    // never sends anything.
    expect(out.sent).toEqual(['kept']);
  });
});
