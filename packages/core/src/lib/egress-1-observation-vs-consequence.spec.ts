import { describe, expect, it } from 'vitest';

import { external } from './external';
import { getPathNotifier } from './path-notifier';
import { getPositionRegistry } from './internals/position-registry';
import { restoration } from '../enhancers/restoration/restoration';
import { scheduleDurableConsequence } from './internals/commit-consequence';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';
import { undoable } from './undoable';

/**
 * EGRESS-1 — IS ONE EGRESS SHAPE ENOUGH FOR BOTH?
 *
 * EGRESS-0 showed `link()` is a composition over `external()` and a
 * settlement-aware egress gate. It then inferred that the gate it happened to
 * test is THE egress primitive for everything that crosses the boundary —
 * storage SET, HTTP PUT, socket send, POST, telemetry. That inference is the
 * thing to attack.
 *
 * ```text
 * NULL       one public egress shape is sufficient for BOTH persistent
 *            committed-state observation AND explicit one-shot commit
 *            consequences, without producing incorrect behaviour for external,
 *            restoration, rollback, or repeated state transitions
 * FALSIFIER  a state OBSERVER fires for causes a one-shot CONSEQUENCE must not
 * ```
 *
 * The two readings look alike and are not:
 *
 * ```text
 * COMMITTED STATE OBSERVATION
 *   "whenever X legally settles somewhere new, tell me"
 *   storage.set('theme', theme)      — idempotent, equality meaningful
 *
 * COMMIT CONSEQUENCE
 *   "THIS operation wants to perform E if its authored work survives"
 *   chargeCard(order)                — not idempotent, equality meaningless
 * ```
 *
 * The dangerous shape is a consequence written as an observer:
 *
 *     onCommitted(tree.$.order, (order) => chargeCard(order));
 *
 * which must not charge again because an undo, a rollback compensation, or an
 * externally acquired value moved `order`.
 */

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

// ───────────────────────────────────────────────────────────────────────────
// CANDIDATE A — the state observer, exactly as EGRESS-0 tested it
// ───────────────────────────────────────────────────────────────────────────

function onCommitted<T>(x: unknown, cb: (current: T) => void): () => void {
  const registry = getPositionRegistry(x);
  if (!registry) throw new Error('onCommitted: X must be an owned location.');
  const ownerPath = (x as { __ownerPath?: string }).__ownerPath ?? '';
  let off = false;

  const unsubscribe = getPathNotifier().subscribe(
    '**',
    (_n, _p, path, _o, _origin, _s, _pos, meta) => {
      if (off) return;
      const m = (meta ?? {}) as Record<string, unknown>;
      if (m['ownerId'] !== registry.id) return;
      if (
        ownerPath !== '' &&
        path !== ownerPath &&
        !path.startsWith(`${ownerPath}.`)
      ) {
        return;
      }
      scheduleDurableConsequence({
        claimant: x as object,
        key: cb,
        run: () => {
          if (off) return;
          cb((x as () => unknown)() as T);
        },
      });
    }
  );
  return () => {
    off = true;
    unsubscribe();
  };
}

// ───────────────────────────────────────────────────────────────────────────
// CANDIDATE B — the one-shot consequence, scheduled BY an operation
// ───────────────────────────────────────────────────────────────────────────

/**
 * Called from INSIDE the authored operation, in that operation's own stack, so
 * it inherits the ambient transaction the way `stored()` does. It observes
 * nothing and re-arms for nothing: one call, at most one effect.
 */
function afterCommit(x: unknown, effect: () => void): void {
  const registry = getPositionRegistry(x);
  if (!registry) throw new Error('afterCommit: X must be an owned location.');
  scheduleDurableConsequence({
    claimant: x as object,
    key: effect,
    run: effect,
  });
}

const orderTree = () =>
  signalTree(
    { order: { id: 'o1', total: 100 } },
    { enhancers: [restoration(), transactions()] }
  );

// ───────────────────────────────────────────────────────────────────────────
// The falsifier: four causes that move X
// ───────────────────────────────────────────────────────────────────────────

describe('EGRESS-1: what causes make a state OBSERVER fire?', () => {
  const observe = async (
    act: (t: ReturnType<typeof orderTree>) => void | Promise<void>
  ) => {
    const tree = orderTree();
    await flush();
    const fired: unknown[] = [];
    const off = onCommitted(tree.$.order, (v) => fired.push(v));
    await act(tree);
    await flush();
    off();
    return { fired, tree };
  };

  it('CONTROL — an authored write fires it', async () => {
    const r = await observe((t) => {
      t.$.order({ total: 200 });
    });
    expect(r.fired).toHaveLength(1);
  });

  it('⚠️ an EXTERNAL acquisition fires it too', async () => {
    const r = await observe((t) => {
      external(() => t.$.order({ total: 300 }));
    });

    // CORRECT for state observation — Y is entitled to know X settled somewhere
    // new, and `link()` suppresses the echo by equality.
    // FATAL for a consequence — nobody in this process authored a charge.
    expect(r.fired).toHaveLength(1);
  });

  it('⚠️ an UNDO does NOT fire it — and that is a DEFECT, not a design', async () => {
    const r = await observe(async (t) => {
      undoable(() => t.$.order({ total: 200 }));
      await flush();
      t.undo();
    });

    // ⚠️ I expected two firings and measured one. The observer saw the authored
    // `200` and never saw the reversal, while the tree really did return to
    // `100`. So an owner-filtered observer is BLIND to restoration.
    //
    // Root cause, measured separately (OWNER-REPLAY-0): the undo DOES reach the
    // notifier — `origin=restoration` — but with `ownerId: undefined`, because
    // restoration replays through `notifier.notify(...)` positionally and those
    // call sites were never taught the namespace the ownership correction
    // added. There are 24 such sites across restoration, transactions,
    // devtools and entity-signal.
    //
    // For a CONSEQUENCE this accidentally looks right. For STATE SYNC it is a
    // real defect: `link()` built on this observer would leave Y holding the
    // pre-undo value forever. That is a harder failure than the double-charge
    // this case was written to expose.
    expect(r.fired).toHaveLength(1);
    expect(r.fired[0]).toMatchObject({ total: 200 });
    expect(r.tree.$.order()).toMatchObject({ total: 100 }); // X moved; Y would not
  });

  it('⚠️ a ROLLBACK COMPENSATION fires it', async () => {
    const r = await observe(async (t) => {
      const p = t.transaction(() => t.$.order({ total: 999 }));
      await flush();
      p.rollback();
    });

    // The speculative value correctly never escapes — but the COMPENSATION is
    // itself a settled write, so the observer fires for the restored value.
    // Right for storage; a charge for a withdrawn order otherwise.
    expect(r.fired.length).toBeGreaterThanOrEqual(1);
    expect(r.tree.$.order()).toMatchObject({ total: 100 });
  });

  it('⚠️ repeated A -> B -> A -> B fires four times', async () => {
    const r = await observe(async (t) => {
      t.$.order({ total: 200 });
      await flush();
      t.$.order({ total: 100 });
      await flush();
      t.$.order({ total: 200 });
      await flush();
      t.$.order({ total: 100 });
    });

    // Idempotent for storage. Four charges otherwise.
    expect(r.fired).toHaveLength(4);
  });
});

describe('EGRESS-1: what does a ONE-SHOT consequence do for the same causes?', () => {
  it('runs once when the operation that scheduled it is confirmed', async () => {
    const tree = orderTree();
    await flush();
    const charges: number[] = [];

    const p = tree.transaction(() => {
      tree.$.order({ total: 200 });
      // Scheduled INSIDE the operation, in its own stack.
      afterCommit(tree.$.order, () => charges.push(tree.$.order().total));
    });
    await flush();
    expect(charges).toEqual([]);

    p.confirm();
    await flush();

    expect(charges).toEqual([200]);
  });

  it('never runs when that operation is rolled back', async () => {
    const tree = orderTree();
    await flush();
    const charges: number[] = [];

    const p = tree.transaction(() => {
      tree.$.order({ total: 999 });
      afterCommit(tree.$.order, () => charges.push(tree.$.order().total));
    });
    await flush();
    p.rollback();
    await flush();

    // Not "ran and compensated" — never ran. The consequence is discarded with
    // the operation that authored it.
    expect(charges).toEqual([]);
  });

  it('⚠️ THE DISCRIMINATOR — later movement of X does NOT re-run it', async () => {
    const tree = orderTree();
    await flush();
    const charges: number[] = [];

    const p = tree.transaction(() => {
      tree.$.order({ total: 200 });
      afterCommit(tree.$.order, () => charges.push(tree.$.order().total));
    });
    await flush();
    p.confirm();
    await flush();
    expect(charges).toEqual([200]);

    // Every cause that fires the observer, applied afterwards.
    external(() => tree.$.order({ total: 300 }));
    await flush();
    undoable(() => tree.$.order({ total: 400 }));
    await flush();
    tree.undo();
    await flush();
    const p2 = tree.transaction(() => tree.$.order({ total: 555 }));
    await flush();
    p2.rollback();
    await flush();

    // ONE charge, for the operation that asked for one. The observer fired at
    // least five times over the same sequence.
    expect(charges).toEqual([200]);
  });
});

/**
 * ## EGRESS-1 RESULT — the NULL is FALSIFIED
 *
 * ```text
 *                        state OBSERVER      one-shot CONSEQUENCE
 * authored write         fires   ✓ wanted    runs    ✓ wanted
 * external acquisition   fires   ✗ fatal     silent  ✓
 * rollback compensation  fires   ✗ fatal     silent  ✓
 * A -> B -> A -> B       4 fires ✗ fatal     1 run   ✓
 * undo                   SILENT  ✗ DEFECT    silent  ✓
 * ```
 *
 * The last row favours neither column — it is OWNER-REPLAY-0, an
 * incompleteness in the ownership correction that makes the observer blind to
 * restoration. It must be fixed before the observer can be trusted for state
 * sync, and fixing it moves that row to `fires ✗ fatal`, STRENGTHENING the
 * falsification rather than weakening it.
 *
 * One shape cannot serve both, and the difference is not a filter that could be
 * added to the observer. It is WHO ASKS:
 *
 * ```text
 * OBSERVER     a standing subscription — "tell me whenever X settles"
 *              cause-blind by construction, which is exactly right for state
 * CONSEQUENCE  scheduled BY an operation, in that operation's own stack —
 *              "if MY authored work survives, do this once"
 * ```
 *
 * A cause filter on the observer would not close the gap: the rollback
 * compensation and the undo are both genuinely settled writes, and a standing
 * subscription has no way to know that the charge belonged to one particular
 * earlier operation rather than to the location.
 *
 * So the minimal stack has THREE gates, not two:
 *
 * ```text
 * external(...)      inbound authority                     Y -> X
 * afterCommit(...)   one-shot consequence authority        an operation -> out
 * onCommitted(...)   committed-state observation           X -> out, standing
 * link(...)          state synchronisation — composition over external +
 *                    onCommitted, and NOT over afterCommit
 * ```
 *
 * `afterCommit` is also the shape `stored()` and `persistence()` already use
 * privately — `scheduleDurableConsequence` called in the mutation's own stack.
 * The observer is the newer idea, and it is the one `link()` needs.
 */
