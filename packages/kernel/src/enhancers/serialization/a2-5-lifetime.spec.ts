import { describe, expect, it } from 'vitest';

import { persistence } from './serialization';
import { signalTree } from '../../lib/signal-tree';

import type { StorageAdapter } from './storage-adapters';

/**
 * A2-5 — LIFETIME. What does a durability capability keep alive, and what does
 * `destroy()` actually stop?
 *
 * A2-3.1 established that the surviving placement already ships as
 * `persistence()`, so this is a NON-REGRESSION study of a real surface rather
 * than a design discriminator. Two questions, and the second is the one a
 * capability can silently get wrong:
 *
 * ```text
 * 1  does destroy() stop pending durable work?      (behaviour)
 * 2  does the capability retain the tree forever?   (retention)
 * ```
 *
 * ## Three arms for the retention question, because two would not discriminate
 *
 * ```text
 * A  no persistence enhancer      tree must DIE    -> nothing else retains it
 * B  persistence(), not destroyed tree must LIVE   -> the capability really
 *                                                     holds it, so arm C is not
 *                                                     measuring a tree that was
 *                                                     never retained
 * C  persistence(), destroyed     tree must DIE    -> destroy() releases it
 * ```
 *
 * Requires `--expose-gc`; runs under `vitest.retention.config.ts` as part of the
 * `retention-gc` gate. Without the flag this FAILS rather than skipping — a
 * WeakRef that is merely *eligible* proves nothing, and a skipped retention test
 * reads as evidence in a green run.
 */

const collect = () => {
  const gc = (globalThis as { gc?: () => void }).gc;
  for (let i = 0; i < 6; i++) gc?.();
};

/** Real pressure, so the target is genuinely collected rather than merely eligible. */
const pressure = async () => {
  for (let round = 0; round < 4; round++) {
    collect();
    await new Promise((r) => setTimeout(r, 20));
  }
  let ballast: unknown[] = [];
  for (let i = 0; i < 200_000; i++) ballast.push({ i });
  ballast = [];
  collect();
  await new Promise((r) => setTimeout(r, 20));
  collect();
};

const recordingStorage = () => {
  const map = new Map<string, string>();
  const payloads: Array<Record<string, unknown>> = [];
  const adapter: StorageAdapter = {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
      try {
        payloads.push(JSON.parse(v).data as Record<string, unknown>);
      } catch {
        payloads.push({ __unparsed: v });
      }
    },
    removeItem: (k) => void map.delete(k),
  };
  return { adapter, payloads };
};

/** Long enough for the 100ms polling fallback plus the autoSave debounce. */
const settleTimers = () => new Promise((r) => setTimeout(r, 260));

type Persisted = {
  $: {
    a: { (value: string): void; (update: (current: string) => string): void; (): string };
  };
  destroy?: () => void;
};

const makeTree = (adapter: StorageAdapter, key: string) =>
  signalTree(
    { a: 'a0', obj: null as unknown },
    {
      enhancers: [
        persistence({
          key,
          storage: adapter,
          autoSave: true,
          autoLoad: false,
          debounceMs: 10,
        }),
      ],
    }
  ) as unknown as Persisted;

describe('A2-5 behaviour: destroy() stops pending durable work', () => {
  it('CONTROL — an armed write IS persisted when the tree lives', async () => {
    const rec = recordingStorage();
    const tree = makeTree(rec.adapter, 'a2-5-live');

    tree.$.a('a1');
    await settleTimers();

    // Without this arm, "destroy suppressed the write" is satisfied by a
    // capability that never writes.
    expect(rec.payloads.length).toBeGreaterThan(0);
    expect(rec.payloads[rec.payloads.length - 1]).toMatchObject({ a: 'a1' });
  });

  it('a write armed before destroy() does not reach storage after it', async () => {
    const rec = recordingStorage();
    const tree = makeTree(rec.adapter, 'a2-5-destroy');

    tree.$.a('a1');
    // Destroy INSIDE the debounce window, which is the only interval in which
    // the question has content.
    tree.destroy?.();
    await settleTimers();

    expect(rec.payloads).toEqual([]);
  });
});

/**
 * ⚠️ FIRST ATTEMPT, AND WHY IT WAS WRONG. Arm B originally held a
 * `WeakRef(tree)` and MEASURED COLLECTED — which would have made arm C vacuous.
 * It was not evidence of no retention: `signalTree()` returns a wrapper, and the
 * enhancer's closures capture the object it was HANDED, so the outer reference
 * can die while everything the capability holds lives on. Retention is measured
 * on a PAYLOAD OBJECT written into the state instead — the same technique
 * DIAG-JOURNAL-1 F6 uses, and directly comparable to it.
 */
describe('A2-5 retention: what does the capability hold?', () => {
  const probe = async (mode: 'none' | 'live' | 'destroyed') => {
    const rec = recordingStorage();
    let payload: unknown = { marker: 'a2-5-payload' };
    const ref = new WeakRef(payload as object);

    let tree: unknown =
      mode === 'none'
        ? signalTree({ a: 'a0', obj: null as unknown })
        : makeTree(rec.adapter, `a2-5-${mode}`);

    (tree as { $: { obj(value: unknown): void } }).$.obj(payload);
    payload = null;
    await settleTimers();

    if (mode === 'destroyed') (tree as Persisted).destroy?.();
    tree = null;

    // Long enough for a polling chain that has been told to stop to actually
    // stop — `pollingActive` is only read when the next timer fires.
    await new Promise((r) => setTimeout(r, 160));
    await pressure();
    return ref.deref();
  };

  it('A — no persistence enhancer: the payload is collected', async () => {
    // Establishes that the harness can collect at all. A retention result is
    // worthless without it.
    expect(await probe('none')).toBeUndefined();
  });

  it('B — persistence(), never destroyed: the payload is RETAINED', async () => {
    // autoSave holds `previousState = tree.$()` — a full materialised snapshot —
    // for reference-identity change detection, so the capability really does
    // hold application values. Arm C therefore measures a RELEASE and not a
    // payload nothing was holding.
    expect(await probe('live')).toBeDefined();
  });

  it('C — persistence(), destroyed: the payload is released', async () => {
    expect(await probe('destroyed')).toBeUndefined();
  });
});
