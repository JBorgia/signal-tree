import { describe, expect, it } from 'vitest';

// ── The CANDIDATE CORE PRIMITIVE's dependencies. Nothing below the fold uses
//    these; the whole point is that the user-land half cannot. ───────────────
import { getPathNotifier } from './path-notifier';
import { getPositionRegistry } from './internals/position-registry';
import { scheduleDurableConsequence } from './internals/commit-consequence';

// ── PUBLIC surface only, from here on. ─────────────────────────────────────
import { deepEqual } from './utils';
import { external } from './external';
import { restoration } from '../enhancers/restoration/restoration';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';

/**
 * EGRESS-0 / LINK-CORE-NULL — is `link()` the primitive, or does it sit on top
 * of two smaller gates?
 *
 * ```text
 * NULL       one minimal PUBLIC settlement-aware egress primitive, plus the
 *            existing public `external()`, is sufficient to implement link()
 *            correctly OUTSIDE core.
 * FALSIFIER  a correct link still requires private tree machinery even when a
 *            public settlement-aware egress gate exists.
 * ```
 *
 * ⚠️ THIS IS THE SECOND FALSIFIER AIMED AT MY OWN CLAIM. LINK-ECHO-1 already
 * withdrew "link must be core because of correlation" and replaced it with
 * "link must be core because of the egress authority". That replacement proves a
 * settlement-safe public EGRESS is required — it does NOT prove `link()` itself
 * must be that capability. This file separates the two.
 *
 * The candidate gate is transport-neutral and knows nothing about state
 * synchronisation:
 *
 * ```text
 * onCommitted(x, cb)   observe X, defer to settlement, read X LATE, call cb
 * ```
 *
 * That shape matters beyond persistence. Storage SET, HTTP PUT, socket send,
 * POST, telemetry all share the same outbound settlement boundary, and only
 * SOME of them are state synchronisation:
 *
 * ```text
 * link             "is Y already at this state?"    equality is meaningful
 * event effect     "perform this thing"             equality is meaningless
 * ```
 *
 * If `link()` were the only public egress mechanism, the second row would stay
 * unreachable.
 */

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

// ───────────────────────────────────────────────────────────────────────────
// THE CANDIDATE CORE PRIMITIVE — the only thing that would be added to core
// ───────────────────────────────────────────────────────────────────────────

/**
 * Settlement-aware egress gate. Everything private lives HERE and nowhere else:
 * ownership resolution, the observation seam, and the commit-consequence
 * authority.
 *
 * `cb` receives X read at EXECUTION time (A2-3.1's run-time capture), never a
 * value captured when the write was observed.
 */
function onCommitted<T>(x: unknown, cb: (current: T) => void): () => void {
  const registry = getPositionRegistry(x);
  if (!registry) {
    throw new Error(
      'onCommitted: X must be an owned SignalTree location (root, branch or leaf).'
    );
  }
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
// THE USER-LAND LINK — public API only. No import above the fold is used here.
// ───────────────────────────────────────────────────────────────────────────

interface Endpoint<T> {
  get?(): T | Promise<T>;
  set?(value: T): void | Promise<void>;
  subscribe?(next: (value: T) => void): () => void;
}

/**
 * Written the way an application author would have to write it, using only
 * `external()`, `deepEqual()`, the candidate `onCommitted()`, and ordinary
 * JavaScript.
 *
 * `recheckOnSuccess` exists for LINK-RACE-0 and is not part of the question
 * EGRESS-0 asks.
 */
const userlandLink = <T>(
  x: unknown,
  endpoint: Endpoint<T>,
  opts: { reconcile?: 'none' | 'recheck' | 'loop' } = {}
) => {
  if (!endpoint.get && !endpoint.set && !endpoint.subscribe) {
    throw new Error('link: endpoint must supply at least one of get/set/subscribe.');
  }

  // Public shape detection: a leaf has `.set`, a branch/root is callable.
  const leafSet = (x as { set?: (v: T) => void }).set;
  const write =
    typeof leafSet === 'function'
      ? (v: T) => leafSet.call(x, v)
      : (v: T) => (x as (v: T) => void)(v);

  /** What Y is known to HOLD — not what Y last said. LINK-ECHO-1's correction. */
  let knownY: { value: T } | undefined;
  let disposed = false;
  let chain: Promise<unknown> = Promise.resolve();
  let inboundSeq = 0;
  const failures: unknown[] = [];

  const acquire = (value: T, seq: number) => {
    if (disposed || seq < inboundSeq) return;
    inboundSeq = seq;
    knownY = { value };
    external(() => write(value)); // the PUBLIC ingress door, stamping nothing
  };

  const offCommitted = endpoint.set
    ? onCommitted<T>(x, (current) => {
        if (disposed) return;
        if (knownY !== undefined && deepEqual(current, knownY.value)) return;
        chain = chain
          .then(async () => {
            const mode = opts.reconcile ?? 'none';
            // ⚠️ ON SUCCESS ONLY. Advancing `knownY` at schedule time would
            // claim Y holds a value a rejected write never established.
            await endpoint.set?.(current);
            knownY = { value: current };

            if (mode === 'recheck') {
              // ONE corrective pass — LINK-RACE-0's fix.
              const now = (x as () => unknown)() as T;
              if (!deepEqual(now, knownY.value)) {
                await endpoint.set?.(now);
                knownY = { value: now };
              }
              return;
            }

            if (mode === 'loop') {
              // RECONCILIATION: keep going while the two known states differ.
              // No debounce, no retry, no conflict resolver — just do not stop
              // while X and Y's acknowledged state disagree.
              for (;;) {
                if (disposed) return;
                const now = (x as () => unknown)() as T;
                if (deepEqual(now, knownY?.value)) return;
                await endpoint.set?.(now);
                knownY = { value: now };
              }
            }
          })
          .catch((e) => void failures.push(e));
      })
    : undefined;

  const offSource = endpoint.subscribe
    ? endpoint.subscribe((v) => acquire(v, ++inboundSeq))
    : undefined;

  return {
    failures,
    async retrieve() {
      if (!endpoint.get) throw new Error('link: endpoint supplies no get().');
      const seq = ++inboundSeq;
      acquire((await endpoint.get()) as T, seq);
    },
    async settled() {
      await chain;
    },
    dispose() {
      disposed = true;
      offCommitted?.();
      offSource?.();
    },
  };
};

const leafTree = () =>
  signalTree({ theme: 'light' }, { enhancers: [restoration(), transactions()] });
const branchTree = () =>
  signalTree(
    { settings: { theme: 'light', units: 'imperial' } },
    { enhancers: [restoration(), transactions()] }
  );

// ───────────────────────────────────────────────────────────────────────────
// The LINK-1/2/ECHO battery, re-run against the user-land implementation
// ───────────────────────────────────────────────────────────────────────────

describe('EGRESS-0: the whole battery, against a USER-LAND link', () => {
  it('self-echo — an acquired value does not go back out', async () => {
    const tree = leafTree();
    await flush();
    const sent: string[] = [];
    const l = userlandLink<string>(tree.$.theme, {
      get: () => 'from-Y',
      set: (v) => void sent.push(v),
    });

    await l.retrieve();
    await flush();
    await l.settled();
    l.dispose();

    expect(tree.$.theme()).toBe('from-Y');
    expect(sent).toEqual([]);
  });

  it('CONTROL — an authored change does go out', async () => {
    const tree = leafTree();
    await flush();
    const sent: string[] = [];
    const l = userlandLink<string>(tree.$.theme, { set: (v) => void sent.push(v) });

    tree.$.theme.set('typed');
    await flush();
    await l.settled();
    l.dispose();

    expect(sent).toEqual(['typed']);
  });

  it('cross-link — Y1 -> X reaches Y2', async () => {
    const tree = leafTree();
    await flush();
    const toA: string[] = [];
    const toB: string[] = [];
    const a = userlandLink<string>(tree.$.theme, {
      get: () => 'from-A',
      set: (v) => void toA.push(v),
    });
    const b = userlandLink<string>(tree.$.theme, { set: (v) => void toB.push(v) });

    await a.retrieve();
    await flush();
    await a.settled();
    await b.settled();
    a.dispose();
    b.dispose();

    expect(toA).toEqual([]);
    expect(toB).toEqual(['from-A']);
  });

  it('X returns to an earlier value after Y moved on', async () => {
    const tree = leafTree();
    await flush();
    const sent: string[] = [];
    const l = userlandLink<string>(tree.$.theme, {
      get: () => 'light',
      set: (v) => void sent.push(v),
    });

    await l.retrieve();
    await flush();
    await l.settled();
    tree.$.theme.set('dark');
    await flush();
    await l.settled();
    tree.$.theme.set('light');
    await flush();
    await l.settled();
    l.dispose();

    expect(sent).toEqual(['dark', 'light']);
  });

  it('branch — a structurally equal, different-reference payload does not echo', async () => {
    const tree = branchTree();
    await flush();
    const sent: unknown[] = [];
    const l = userlandLink<Record<string, unknown>>(tree.$.settings, {
      get: () => JSON.parse('{"theme":"light","units":"imperial"}'),
      set: (v) => void sent.push(v),
    });

    await l.retrieve();
    await flush();
    await l.settled();
    l.dispose();

    expect(sent).toEqual([]);
  });

  it('PUSH-OUT — only settled state escapes', async () => {
    const tree = leafTree();
    await flush();
    const sent: string[] = [];
    const l = userlandLink<string>(tree.$.theme, { set: (v) => void sent.push(v) });

    const pending = tree.transaction(() => tree.$.theme.set('doomed'));
    await flush();
    expect(sent).toEqual([]);

    pending.rollback();
    await flush();
    await l.settled();
    l.dispose();

    // The requirement user-land could NOT meet before the gate existed.
    expect(sent).not.toContain('doomed');
    expect(tree.$.theme()).toBe('light');
  });

  it('outbound ordering — an older set may not finish after a newer one', async () => {
    const tree = leafTree();
    await flush();
    const done: string[] = [];
    const delays: Record<string, number> = { A: 50, B: 5 };
    const l = userlandLink<string>(tree.$.theme, {
      set: (v) =>
        new Promise<void>((r) =>
          setTimeout(() => {
            done.push(v);
            r();
          }, delays[v] ?? 1)
        ),
    });

    tree.$.theme.set('A');
    await flush();
    tree.$.theme.set('B');
    await flush();
    await l.settled();
    l.dispose();

    expect(done).toEqual(['A', 'B']);
  });

  it('disposal — a held outbound consequence does not escape', async () => {
    const tree = leafTree();
    await flush();
    const sent: string[] = [];
    const l = userlandLink<string>(tree.$.theme, { set: (v) => void sent.push(v) });

    const pending = tree.transaction(() => tree.$.theme.set('held'));
    await flush();
    l.dispose();
    pending.confirm();
    await flush();
    await l.settled();

    expect(sent).toEqual([]);
  });

  it('⚠️ a rejection sends nothing, moves nothing, and does not wedge the link', async () => {
    const tree = leafTree();
    await flush();
    let fail = true;
    const sent: string[] = [];
    const l = userlandLink<string>(tree.$.theme, {
      set: (v) => {
        if (fail) return Promise.reject(new Error('down'));
        sent.push(v);
        return Promise.resolve();
      },
    });

    tree.$.theme.set('dark');
    await flush();
    await l.settled();
    expect(l.failures).toHaveLength(1);
    expect(sent).toEqual([]);
    expect(tree.$.theme()).toBe('dark'); // a failed egress does not un-author X

    fail = false;
    tree.$.theme.set('light');
    await flush();
    await l.settled();
    l.dispose();

    expect(sent).toEqual(['light']);
  });

  /**
   * ⚠️ WHAT THIS BATTERY CANNOT SHOW, found by mutation and worth stating.
   *
   * The refinement "advance `knownY` only once `set()` SUCCEEDS" is a
   * correctness argument, and I wrote a test claiming to measure it. Mutating
   * the harness to advance `knownY` at SCHEDULE time instead left all 12 tests
   * green, so that test was passing for the wrong reason and has been rewritten
   * above to assert only what it actually observes.
   *
   * The reason it is unobservable is structural, not a gap in the cases:
   *
   * ```text
   * a rejected write leaves X at the failed value and Y stale
   * nothing re-evaluates X, because X has not changed
   * the next write to X differs from the failed value, so BOTH rules dispatch
   *   -> a successful send resynchronises `knownY` either way
   * ```
   *
   * A divergence would need the link to consult `knownY` for a value that was
   * never successfully sent, with no intervening send — which requires a RETRY,
   * and retry is deliberately not in scope (it is what `loader()` was).
   *
   * So: keep the on-success rule, because a variable named "what Y is known to
   * hold" must not record a value Y never received — but record it as UNEARNED
   * BY MEASUREMENT rather than claiming this battery proved it. If retry is ever
   * added, this becomes measurable and must be tested then.
   */

  it('the candidate gate itself refuses an unowned X', async () => {
    expect(() => onCommitted({}, () => void 0)).toThrow(/owned SignalTree location/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// LINK-RACE-0 — cross-direction concurrency
// ───────────────────────────────────────────────────────────────────────────

/**
 * The race neither LINK-1 nor LINK-2 hit. Each proved its own direction ordered
 * correctly; this is what happens when they CROSS.
 *
 * ```text
 * X authors B    -> set(B) begins, slow
 * Y pushes C     -> X becomes C
 * set(B) completes
 *
 * X = C, Y = B, and both direction rules were individually obeyed.
 * ```
 */
describe('LINK-RACE-0/1: cross-direction concurrency', () => {
  /**
   * A harness that can block an arbitrary number of outbound writes in turn, so
   * the directions can be made to cross REPEATEDLY rather than once.
   */
  const crossing = async (
    reconcile: 'none' | 'recheck' | 'loop',
    inbound: string[]
  ) => {
    const tree = leafTree();
    await flush();
    const yState: string[] = [];
    const gates = new Map<string, () => void>();
    let emit: ((v: string) => void) | undefined;

    const l = userlandLink<string>(
      tree.$.theme,
      {
        set: (v) =>
          new Promise<void>((resolve) => {
            // ONE-SHOT. The drain below opens every outstanding gate several
            // times, and a re-openable gate would push `v` once per call —
            // which is exactly how the control first failed, reporting six
            // sends where the link made one.
            let fired = false;
            gates.set(v, () => {
              if (fired) return;
              fired = true;
              gates.delete(v);
              yState.push(v);
              resolve();
            });
          }),
        subscribe: (next) => {
          emit = next;
          return () => void (emit = undefined);
        },
      },
      { reconcile }
    );

    // The authored write that starts the chain.
    tree.$.theme.set('B');
    await flush();

    // Each inbound value arrives while the PREVIOUS outbound write is still in
    // flight, then that write is released.
    const pendingOrder = ['B', ...inbound.slice(0, -1)];
    for (let i = 0; i < inbound.length; i++) {
      emit?.(inbound[i]);
      await flush();
      gates.get(pendingOrder[i])?.();
      await flush();
      await flush();
    }
    // Drain anything the reconciler dispatched afterwards.
    for (let i = 0; i < 6; i++) {
      for (const open of [...gates.values()]) open();
      await flush();
    }
    await l.settled();
    l.dispose();

    return { x: tree.$.theme(), y: yState[yState.length - 1], yState };
  };

  it('⚠️ LINK-RACE-0 — ONE crossing, NO reconciliation: permanent divergence', async () => {
    const r = await crossing('none', ['C']);

    // Both direction rules were individually obeyed and the result is still
    // wrong. Nothing corrects it: the consequence for C already ran and was
    // suppressed, because at that moment `knownY` still said C.
    expect(r.x).toBe('C');
    expect(r.y).toBe('B');
  });

  it('ONE crossing, single recheck: converges', async () => {
    const r = await crossing('recheck', ['C']);

    expect(r.x).toBe('C');
    expect(r.y).toBe('C');
  });

  it('⚠️ LINK-RACE-1 — TWO crossings, single recheck: DIVERGES AGAIN', async () => {
    const r = await crossing('recheck', ['C', 'D']);

    // The corrective write is itself an outbound write, so it can be crossed
    // too. A post-success recheck that runs ONCE stops exactly one step short,
    // every time. This is why the fix is not "recheck" but "reconcile".
    expect(r.x).toBe('D');
    expect(r.y).toBe('C');
  });

  it('TWO crossings, reconciliation loop: converges', async () => {
    const r = await crossing('loop', ['C', 'D']);

    expect(r.x).toBe('D');
    expect(r.y).toBe('D');
  });

  it('THREE crossings, reconciliation loop: still converges', async () => {
    const r = await crossing('loop', ['C', 'D', 'E']);

    // The loop terminates on EQUALITY, not on a counter, so depth is not a
    // parameter. Without a terminating condition this would spin forever;
    // `deepEqual(now, knownY)` is what stops it.
    expect(r.x).toBe('E');
    expect(r.y).toBe('E');
  });

  it('CONTROL — with no crossing at all the loop sends exactly once', async () => {
    const r = await crossing('loop', []);

    // Without this arm, "the loop converges" is satisfied by a loop that sends
    // repeatedly until it happens to match.
    expect(r.yState).toEqual(['B']);
  });
});

/**
 * ## EGRESS-0 RESULT
 *
 * Recorded in the audit. The battery above is the evidence; the disposition is
 * whether `link()` is a core primitive or an ergonomic composition over two
 * smaller gates — `external()` inbound and `onCommitted()` outbound.
 *
 * ## LINK-RACE-0 RESULT
 *
 * Cross-direction concurrency is a REAL defect that neither direction's own
 * ordering rule prevents, and it is fixable without inventing distributed
 * conflict resolution — but only if `set()`'s resolution MEANS something:
 *
 *     `set(v)` resolving successfully = the endpoint acknowledges v as its state
 *
 * An endpoint that cannot promise that is not a bidirectional STATE endpoint
 * without supplying version/conflict semantics of its own. That is a contract on
 * Y, not machinery in the link.
 */
