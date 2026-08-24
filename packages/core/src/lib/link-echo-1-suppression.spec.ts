import { describe, expect, it } from 'vitest';

import { deepEqual } from './utils';
import { external } from './external';
import { getPathNotifier } from './path-notifier';
import { getPositionRegistry } from './internals/position-registry';
import { restoration } from '../enhancers/restoration/restoration';
import { scheduleDurableConsequence } from './internals/commit-consequence';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';
import { withWriteContext } from './write-context';

/**
 * LINK-ECHO-1 — IS CORRELATION THE MINIMAL SELF-ECHO MECHANISM, OR JUST THE ONE
 * LINK-1 HAPPENED TO IMPLEMENT?
 *
 * ⚠️ THIS FILE EXISTS TO FALSIFY A CLAIM I MADE. I concluded from LINK-1 that
 * "a correct two-way link must be CORE, because self-echo needs a link-local
 * correlation and `external()` cannot stamp one." LINK-1 proved correlation
 * WORKS. It did not prove correlation is NECESSARY, and those are different
 * claims. If value-equality suppression survives the same battery, the
 * core-necessity argument collapses — a link would be buildable in user-land on
 * public `external()` alone.
 *
 * ```text
 * ARM A  CORRELATION      stamp linkId on inbound; outbound skips its own
 * ARM B  VALUE EQUALITY   remember what Y said; at outbound execution read X
 *                         late and skip if semantically equal
 * ```
 *
 * Arm B is the more explainable rule, and it describes the RELATIONSHIP rather
 * than its implementation:
 *
 *     Y already told us X = A. Don't immediately tell Y that X = A.
 *     If X becomes B, tell Y B.
 *
 * It also draws a boundary worth having: `link()` is STATE SYNCHRONISATION, so
 * difference is meaningful. An event emission (`sendOrder(order)`) has no
 * "only if different", and belongs to the committed-consequence side instead.
 *
 * ## RESULT — the claim IS falsified, and the real argument is different
 *
 * ```text
 * correlation      8/8
 * equality-said    7/8  ELIMINATED by the last case: Y is stranded, silently
 * equality-held    8/8  equivalent to correlation, and stamps NOTHING
 * ```
 *
 * So correlation is sufficient, not necessary, and "a link must be core because
 * `external()` cannot stamp a correlation" is WITHDRAWN. `equality-held` — skip
 * the outbound write when X already semantically equals what Y is known to hold
 * — is the better rule anyway: it describes the relationship rather than its
 * implementation, and it needs no privileged ingress.
 *
 * What DOES survive is simpler and was hiding underneath:
 *
 * ```text
 * INBOUND   reachable from public `external()` alone
 * OUTBOUND  NOT reachable. `scheduleDurableConsequence` is not exported and
 *           `getPathNotifier` is explicitly "not root app API", so application
 *           code has no way to defer a write until the tree settles. Measured
 *           below: a user-land write-through leaves Y holding a rolled-back
 *           value with nothing coming to correct it.
 * ```
 *
 * `link()` is core because of the EGRESS authority, not the ingress
 * classification.
 */

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

type Suppression = 'correlation' | 'equality-said' | 'equality-held';

interface Endpoint<T> {
  get?(): T | Promise<T>;
  set?(value: T): void | Promise<void>;
  subscribe?(next: (value: T) => void): () => void;
}

let nextLinkId = 1;

const linkableWrite = <T>(x: unknown): ((value: T) => void) => {
  if (!getPositionRegistry(x)) throw new Error('LINK: X must be owned.');
  const leafSet = (x as { set?: (v: T) => void }).set;
  if (typeof leafSet === 'function') return (v: T) => leafSet.call(x, v);
  if (typeof x === 'function') return (v: T) => (x as (v: T) => void)(v);
  throw new Error('LINK: X must be writable.');
};

const makeLink = <T>(
  x: unknown,
  endpoint: Endpoint<T>,
  mode: Suppression
) => {
  const registry = getPositionRegistry(x);
  const write = linkableWrite<T>(x);
  const linkId = `link#${nextLinkId++}`;
  const ownerPath = (x as { __ownerPath?: string }).__ownerPath ?? '';

  let disposed = false;
  let chain: Promise<unknown> = Promise.resolve();
  let unsubscribeSource: (() => void) | undefined;

  /**
   * The equality arms' whole state.
   *
   * `equality-said`  remembers what Y SAID — the rule exactly as first proposed.
   * `equality-held`  remembers what Y is known to HOLD, so an outbound send
   *                  updates it too. The battery's last case is what separates
   *                  them, and it is not a hypothetical.
   */
  let lastAtY: { value: T } | undefined;

  const acquire = (value: T) => {
    if (disposed) return;
    lastAtY = { value };
    withWriteContext(
      {
        origin: 'external',
        participation: 'realized',
        // ARM B stamps nothing. If it survives, `external()` alone suffices.
        ...(mode === 'correlation' ? { correlationId: linkId } : {}),
      },
      () => write(value)
    );
  };

  const readX = () => (x as () => unknown)();

  const offNotifier = endpoint.set
    ? getPathNotifier().subscribe(
        '**',
        (_n, _p, path, _o, _origin, _s, _pos, meta) => {
          if (disposed) return;
          const m = (meta ?? {}) as Record<string, unknown>;
          if (m['ownerId'] !== registry?.id) return;
          if (
            ownerPath !== '' &&
            path !== ownerPath &&
            !path.startsWith(`${ownerPath}.`)
          ) {
            return;
          }
          if (mode === 'correlation' && m['correlationId'] === linkId) return;

          scheduleDurableConsequence({
            claimant: x as object,
            key: linkId,
            run: () => {
              if (disposed) return;
              const current = readX() as T;
              if (
                mode !== 'correlation' &&
                lastAtY !== undefined &&
                deepEqual(current, lastAtY.value)
              ) {
                return;
              }
              // The refinement, and the ONLY difference between the two
              // equality arms: what Y now holds is what we just sent it.
              if (mode === 'equality-held') {
                lastAtY = { value: current };
              }
              chain = chain
                .then(() => endpoint.set?.(current))
                .catch(() => void 0);
            },
          });
        }
      )
    : undefined;

  if (endpoint.subscribe) unsubscribeSource = endpoint.subscribe(acquire);

  return {
    async retrieve() {
      if (!endpoint.get) throw new Error('no get');
      acquire((await endpoint.get()) as T);
    },
    async settled() {
      await chain;
    },
    dispose() {
      disposed = true;
      offNotifier?.();
      unsubscribeSource?.();
    },
  };
};

const leafTree = () =>
  signalTree(
    { theme: 'light' },
    { enhancers: [restoration(), transactions()] }
  );
const branchTree = () =>
  signalTree(
    { settings: { theme: 'light', units: 'imperial' } },
    { enhancers: [restoration(), transactions()] }
  );

const MODES: Suppression[] = ['correlation', 'equality-said', 'equality-held'];

// ───────────────────────────────────────────────────────────────────────────
// The battery. Every case runs against BOTH arms.
// ───────────────────────────────────────────────────────────────────────────

describe.each(MODES)('LINK-ECHO-1 [%s]', (mode) => {
  it('leaf self-echo — an acquired value does not go back out', async () => {
    const tree = leafTree();
    await flush();
    const sent: string[] = [];
    const link = makeLink<string>(
      tree.$.theme,
      { get: () => 'from-Y', set: (v) => void sent.push(v) },
      mode
    );

    await link.retrieve();
    await flush();
    await link.settled();
    link.dispose();

    expect(tree.$.theme()).toBe('from-Y');
    expect(sent).toEqual([]);
  });

  it('CONTROL — an authored change DOES go out', async () => {
    const tree = leafTree();
    await flush();
    const sent: string[] = [];
    const link = makeLink<string>(
      tree.$.theme,
      { set: (v) => void sent.push(v) },
      mode
    );

    tree.$.theme.set('typed');
    await flush();
    await link.settled();
    link.dispose();

    expect(sent).toEqual(['typed']);
  });

  it('cross-link — Y1 -> X reaches Y2', async () => {
    const tree = leafTree();
    await flush();
    const toA: string[] = [];
    const toB: string[] = [];
    const a = makeLink<string>(
      tree.$.theme,
      { get: () => 'from-A', set: (v) => void toA.push(v) },
      mode
    );
    const b = makeLink<string>(
      tree.$.theme,
      { set: (v) => void toB.push(v) },
      mode
    );

    await a.retrieve();
    await flush();
    await a.settled();
    await b.settled();
    a.dispose();
    b.dispose();

    expect(toA).toEqual([]);
    expect(toB).toEqual(['from-A']);
  });

  it('an authored change AFTER an acquisition, before settlement, still goes out', async () => {
    const tree = leafTree();
    await flush();
    const sent: string[] = [];
    const link = makeLink<string>(
      tree.$.theme,
      { get: () => 'from-Y', set: (v) => void sent.push(v) },
      mode
    );

    await link.retrieve();
    tree.$.theme.set('then-typed'); // same tick, before the consequence runs
    await flush();
    await link.settled();
    link.dispose();

    expect(tree.$.theme()).toBe('then-typed');
    expect(sent).toEqual(['then-typed']);
  });

  it('rapid A then B inbound — neither echoes', async () => {
    const tree = leafTree();
    await flush();
    const sent: string[] = [];
    let emit: ((v: string) => void) | undefined;
    const link = makeLink<string>(
      tree.$.theme,
      {
        set: (v) => void sent.push(v),
        subscribe: (next) => {
          emit = next;
          return () => void (emit = undefined);
        },
      },
      mode
    );

    emit?.('A');
    emit?.('B');
    await flush();
    await link.settled();
    link.dispose();

    expect(tree.$.theme()).toBe('B');
    expect(sent).toEqual([]);
  });

  it('branch — a FULL-shape acquisition does not echo', async () => {
    const tree = branchTree();
    await flush();
    const sent: unknown[] = [];
    const link = makeLink<Record<string, unknown>>(
      tree.$.settings,
      {
        get: () => ({ theme: 'dark', units: 'metric' }),
        set: (v) => void sent.push(v),
      },
      mode
    );

    await link.retrieve();
    await flush();
    await link.settled();
    link.dispose();

    expect(tree.$.settings()).toMatchObject({ theme: 'dark', units: 'metric' });
    expect(sent).toEqual([]);
  });

  it('branch — a STRUCTURALLY EQUAL but different-reference payload does not echo', async () => {
    const tree = branchTree();
    await flush();
    const sent: unknown[] = [];
    // What a transport that deserializes JSON hands back: equal contents, new
    // object identity every time. Reference equality would echo forever.
    const link = makeLink<Record<string, unknown>>(
      tree.$.settings,
      {
        get: () => JSON.parse('{"theme":"light","units":"imperial"}'),
        set: (v) => void sent.push(v),
      },
      mode
    );

    await link.retrieve();
    await flush();
    await link.settled();
    link.dispose();

    expect(sent).toEqual([]);
  });

  it('⚠️ THE HARD ONE — X returns to a value Y supplied EARLIER, after Y moved on', async () => {
    const tree = leafTree();
    await flush();
    const sent: string[] = [];
    const link = makeLink<string>(
      tree.$.theme,
      { get: () => 'light', set: (v) => void sent.push(v) },
      mode
    );

    // 1. Y supplies 'light'. Nothing goes out.
    await link.retrieve();
    await flush();
    await link.settled();
    expect(sent).toEqual([]);

    // 2. The app authors 'dark'. That goes out, so Y now holds 'dark'.
    tree.$.theme.set('dark');
    await flush();
    await link.settled();
    expect(sent).toEqual(['dark']);

    // 3. The app authors 'light' again — the value Y supplied in step 1, but
    //    NOT the value Y currently holds.
    tree.$.theme.set('light');
    await flush();
    await link.settled();
    link.dispose();

    // Y must end holding what X holds.
    if (mode === 'equality-said') {
      // ⚠️ MEASURED DEFECT, and it eliminates the rule as first stated.
      // 'light' is still what Y SAID in step 1, so the suppression fires — but
      // Y has held 'dark' since step 2. Y is stranded, permanently, and nothing
      // later will correct it because the mismatch is invisible to the rule.
      expect(sent).toEqual(['dark']);
      expect(tree.$.theme()).toBe('light'); // X and Y now disagree, silently
    } else {
      expect(sent).toEqual(['dark', 'light']);
      expect(tree.$.theme()).toBe('light');
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// What survives of the core-necessity argument
// ───────────────────────────────────────────────────────────────────────────

describe('LINK-ECHO-1: what a PUBLIC-ONLY link cannot do', () => {
  it('inbound needs nothing internal — public external() suffices', async () => {
    const tree = leafTree();
    await flush();

    // `equality-held` stamps no correlation, so the inbound half of a link is
    // reachable from the public ingress door alone.
    external(() => tree.$.theme.set('from-Y'));
    await flush();

    expect(tree.$.theme()).toBe('from-Y');
  });

  it('⚠️ OUTBOUND CANNOT — there is no public door onto settlement', async () => {
    const tree = leafTree();
    await flush();
    const y = new Map<string, string>([['theme', 'light']]);

    // The only thing application code can actually do: write through at
    // authoring time. `scheduleDurableConsequence` is not exported, and
    // `getPathNotifier` is explicitly "not root app API", so there is no public
    // way to say "run this once the tree has settled".
    const pending = tree.transaction(() => {
      tree.$.theme.set('dark');
      y.set('theme', 'dark'); // write-through, the user-land shape
    });
    await flush();

    pending.rollback();
    await flush();

    // X recovered; Y did not, and nothing is coming to correct it. This is
    // LINK-1's PUSH-OUT requirement — "only settled state escapes" —
    // unreachable from user-land.
    expect(tree.$.theme()).toBe('light');
    expect(y.get('theme')).toBe('dark');
  });
});
