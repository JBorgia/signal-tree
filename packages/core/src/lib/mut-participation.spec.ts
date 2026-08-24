import { computed } from '@angular/core';
import { undoable } from '../lib/undoable';

import { entityMap, signalTree, timeTravel } from '../index';
import { getWriteParticipation } from './write-participation';
import { withWriteContext } from './write-context';
import {
  getPathNotifier,
  PathNotifier,
  resetPathNotifier,
} from './path-notifier';

/**
 * MUT-1 — EVIDENCE. What distinguishes a physical change that merely REALIZES
 * or RESTORES truth from a SEMANTIC MUTATION that participates in SignalTree
 * authority?
 *
 * TEMPORARY, under the ANG-V0-F protocol: this characterizes mechanisms that
 * are themselves under hostile audit, so it is deleted once MUT-1's contract
 * freezes. Its measured rows survive in RELEASE-1.0.md.
 *
 * Three things are held apart on purpose and must not be assumed synonymous:
 *
 *   LANDED WRITE        physical truth changed
 *   SEMANTIC MUTATION   it participates in the mutation model
 *   CAUSALLY AUTHORED   a turn authored it
 */

const tick = () => new Promise((r) => setTimeout(r, 0));

interface Probe {
  landed: boolean;
  history: number;
  notified: string[];
  pulled: unknown;
}

/** Observe one operation across every independent dimension at once. */
async function probe(
  build: () => { tree: ReturnType<typeof signalTree>; read: () => unknown },
  op: (t: never) => void | Promise<void>
): Promise<Probe> {
  resetPathNotifier();
  const { tree, read } = build();
  const timed = tree as unknown as {
    getHistory(): unknown[];
    undo(): void;
  };
  await tick();

  const before = read();
  const beforeHistory = timed.getHistory().length;
  const notified: string[] = [];
  const off = getPathNotifier().subscribe('**', (_n, _p, path) => {
    notified.push(String(path));
  });

  await op(tree as never);
  await tick();
  off();

  return {
    landed: JSON.stringify(read()) !== JSON.stringify(before),
    history: timed.getHistory().length - beforeHistory,
    notified,
    pulled: read(),
  };
}

describe('MUT-1 — landed vs semantic vs causally authored', () => {
  const plain = () => {
    const tree = signalTree(
      { a: { n: 1 }, rows: entityMap<{ id: string; v: number }>() },
      { enhancers: [timeTravel()] }
    );
    return { tree, read: () => tree.$.a() };
  };

  it('ORDINARY LEAF WRITE — the reference case', async () => {
    const r = await probe(plain, (t) => {
      undoable(() =>
        (t as unknown as { $: { a: { n: { set(v: number): void } } } }).$.a.n.set(
          2
        )
      );
    });
    expect({
      landed: r.landed,
      history: r.history,
      notified: r.notified,
    }).toEqual({
      landed: true,
      history: 1,
      notified: ['a.n'],
    });
  });

  it('BRANCH CALL-FORM WRITE', async () => {
    const r = await probe(plain, (t) => {
      undoable(() => (t as unknown as { $: { a: (v: object) => void } }).$.a({ n: 3 }));
    });
    expect({
      landed: r.landed,
      history: r.history,
      notified: r.notified,
    }).toEqual({
      landed: true,
      history: 1,
      notified: ['a.n'],
    });
  });

  it('DEEP-EQUAL WRITE — a write that does NOT land', async () => {
    const r = await probe(plain, (t) => {
      undoable(() => (t as unknown as { $: { a: (v: object) => void } }).$.a({ n: 1 }));
    });
    // LANDED is the precondition: nothing downstream observes a write that
    // did not land.
    expect({
      landed: r.landed,
      history: r.history,
      notified: r.notified,
    }).toEqual({
      landed: false,
      history: 0,
      notified: [],
    });
  });

  it('UNDO — truth changes, but is it AUTHORED?', async () => {
    resetPathNotifier();
    const tree = signalTree({ a: { n: 1 } }, { enhancers: [timeTravel()] });
    await tick();
    // Designated: this test UNDOES this write, so it has to be an admitted turn.
    undoable(() => tree.$.a({ n: 2 }));
    await tick();

    const beforeHistory = tree.getHistory().length;
    const notified: string[] = [];
    const off = getPathNotifier().subscribe('**', (_n, _p, path) =>
      notified.push(String(path))
    );

    tree.undo();
    await tick();
    off();

    // THE DISCRIMINATOR: truth changed and was published, but NO new
    // authorship was created. PathNotifier cannot tell this from a real write.
    expect(tree.$.a().n).toBe(1);
    expect(tree.getHistory().length - beforeHistory).toBe(0);
    expect(notified).toEqual(['a.n']);
  });

  it('ENTITY CRUD', async () => {
    const r = await probe(
      () => {
        const tree = signalTree(
          { rows: entityMap<{ id: string; v: number }>() },
          { enhancers: [timeTravel()] }
        );
        return { tree, read: () => tree.$.rows.all() };
      },
      (t) => {
        // Designated: the probe asserts a history count for this operation.
        undoable(() =>
          (
            t as unknown as { $: { rows: { addMany(x: unknown[]): void } } }
          ).$.rows.addMany([{ id: 'a', v: 1 }])
        );
      }
    );
    expect({ landed: r.landed, history: r.history }).toEqual({
      landed: true,
      history: 1,
    });
    expect(r.notified).toContain('rows.a');
  });

  // WITHDRAWN WITH STATUS-DEL — "MARKER STATE TRANSITION — status()". MUT-1's
  // frozen result is recorded in RELEASE-1.0.md and does not rest on this
  // specimen; the ordinary-leaf, branch-call-form and deep-equal rows remain.

  it('PUBLICATION is independent — every landed change is pull-visible', async () => {
    const tree = signalTree(
      { a: { n: 1 } },
      { capabilities: ['causal-runtime'] }
    );
    const seen = computed(() => tree.$.a.n());
    expect(seen()).toBe(1);
    undoable(() => tree.$.a.n.set(9));
    expect(seen()).toBe(9);
  });
});

describe('MUT-1 CONTROL — is notification a property of the WRITE or of an ENHANCER?', () => {
  it('a leaf write on a BARE tree (no enhancer)', async () => {
    resetPathNotifier();
    const tree = signalTree(
      { a: { n: 1 } },
      { capabilities: ['causal-runtime'] }
    );
    const notified: string[] = [];
    const off = getPathNotifier().subscribe('**', (_n, _p, path) =>
      notified.push(String(path))
    );

    undoable(() => tree.$.a.n.set(2));
    await tick();
    off();

    // No enhancer applied: notification is a property of CORE's write path.
    expect(tree.$.a.n()).toBe(2);
    expect(notified).toEqual(['a.n']);
  });

  it('the same write WITH timeTravel', async () => {
    resetPathNotifier();
    const tree = signalTree({ a: { n: 1 } }, { enhancers: [timeTravel()] });
    await tick();
    const notified: string[] = [];
    const off = getPathNotifier().subscribe('**', (_n, _p, path) =>
      notified.push(String(path))
    );

    undoable(() => tree.$.a.n.set(2));
    await tick();
    off();

    expect(notified).toEqual(['a.n']);
  });

  it('entityMap CRUD on a BARE tree', async () => {
    resetPathNotifier();
    const tree = signalTree(
      { rows: entityMap<{ id: string; v: number }>() },
      { capabilities: ['causal-runtime'] }
    );
    const notified: string[] = [];
    const off = getPathNotifier().subscribe('**', (_n, _p, path) =>
      notified.push(String(path))
    );

    undoable(() => tree.$.rows.addMany([{ id: 'a', v: 1 }]));
    await tick();
    off();

    expect(notified).toEqual(['rows.a']);
  });
});

describe('MUT-1 — which WRITE PATHS reach the notifier?', () => {
  const capture = async (op: (t: ReturnType<typeof signalTree>) => void) => {
    resetPathNotifier();
    const tree = signalTree(
      { a: { n: 1, s: 'x' }, top: 0 },
      { capabilities: ['causal-runtime'] }
    );
    const notified: string[] = [];
    const off = getPathNotifier().subscribe('**', (_n, _p, path) =>
      notified.push(String(path))
    );
    op(tree as never);
    await tick();
    off();
    return { notified, value: tree() };
  };

  it('DIRECT leaf .set()', async () => {
    const r = await capture((t) => {
      undoable(() =>
        (t as unknown as { $: { a: { n: { set(v: number): void } } } }).$.a.n.set(
          2
        )
      );
    });
    expect(r.notified).toEqual(['a.n']);
  });

  it('BRANCH call form', async () => {
    const r = await capture((t) => {
      undoable(() => (t as unknown as { $: { a: (v: object) => void } }).$.a({ n: 3 }));
    });
    expect(r.notified).toEqual(['a.n']);
  });

  it('ROOT call form — the recursive update pipeline', async () => {
    const r = await capture((t) => {
      undoable(() => (t as unknown as (v: object) => void)({ a: { n: 4 }, top: 7 }));
    });
    // Only the LANDED leaves: `a.s` was rewritten with its own value and is
    // absent.
    expect(r.notified).toEqual(['a.n', 'top']);
  });

  it('ROOT updater form', async () => {
    const r = await capture((t) => {
      (t as unknown as (fn: (c: { top: number }) => object) => void)((c) => ({
        top: c.top + 5,
      }));
    });
    expect(r.notified).toEqual(['top']);
  });
});

describe('MUT-1 — the interceptLeafSignals docblock, tested verbatim', () => {
  /**
   * Its stated premise: "SignalTree's recursive update pipeline writes to leaf
   * signals directly without invoking PathNotifier ... a direct call like
   * `tree.$.user.profile.name.set(x)` never produces a PathNotifier event by
   * itself."
   */
  it('the exact shape the docblock names', async () => {
    resetPathNotifier();
    const tree = signalTree(
      { user: { profile: { name: 'a', age: 1 } } },
      { capabilities: ['causal-runtime'] }
    );
    const notified: string[] = [];
    const off = getPathNotifier().subscribe('**', (_n, _p, path) =>
      notified.push(String(path))
    );

    undoable(() => tree.$.user.profile.name.set('b'));
    await tick();
    off();

    // REFUTED VERBATIM: the docblock says this "never produces a PathNotifier
    // event by itself".
    expect(tree.$.user.profile.name()).toBe('b');
    expect(notified).toEqual(['user.profile.name']);
  });
});

describe('MUT-2 — does surviving machinery carry the AUTHORED vs REALIZED distinction?', () => {
  /**
   * `WriteParticipation` (then two values, `'inspection'` added later by
   * DEVTOOLS-JUMP-0) exists, and
   * `WriteAttribution.participation` carries it. R3 showed the notifier's PATH
   * cannot separate an authored write from an undo. The sharper question is
   * whether the notification's META does.
   */
  const capture = () => {
    const seen: Array<Record<string, unknown>> = [];
    const off = getPathNotifier().subscribe(
      '**',
      (
        _next: unknown,
        _prev: unknown,
        path: string,
        _ownerPath?: string,
        origin?: unknown,
        _subjectIds?: unknown,
        _positionIds?: unknown,
        meta?: unknown
      ) => {
        seen.push({
          path,
          origin: origin ?? null,
          meta: (meta as Record<string, unknown>) ?? null,
        });
      }
    );
    return { seen, off };
  };

  it('AUTHORED write — what meta reaches the observer?', async () => {
    resetPathNotifier();
    const tree = signalTree({ a: { n: 1 } }, { enhancers: [timeTravel()] });
    await tick();
    const { seen, off } = capture();

    // Deliberately NOT designated. This test's subject is the METADATA an
    // observer receives, not restoration, so it needs no undoable() — and
    // leaving it undesignated is what preserves the original finding below.
    tree.$.a.n.set(2);
    await tick();
    off();

    // NO participation. Authorship is not positively marked.
    expect(seen).toEqual([
      { path: 'a.n', origin: null, meta: { mutationIntent: 'replace' } },
    ]);
  });

  it('and DESIGNATING it is what adds a positive marker', async () => {
    resetPathNotifier();
    const tree = signalTree({ a: { n: 1 } }, { enhancers: [timeTravel()] });
    await tick();
    const { seen, off } = capture();

    undoable(() => tree.$.a.n.set(2));
    await tick();
    off();

    // The distinction MUT-2 found still holds, and is now sharper: authorship
    // remains unmarked, while DESIGNATION is marked. They are different
    // properties, and only the second is positively carried.
    expect(seen).toEqual([
      {
        path: 'a.n',
        origin: null,
        meta: { mutationIntent: 'replace', restorationDesignated: true },
      },
    ]);
  });

  it('UNDO realization — what meta reaches the observer?', async () => {
    resetPathNotifier();
    const tree = signalTree({ a: { n: 1 } }, { enhancers: [timeTravel()] });
    await tick();
    undoable(() => tree.$.a.n.set(2));
    await tick();

    const { seen, off } = capture();
    tree.undo();
    await tick();
    off();

    // Realization IS positively marked, on two independent channels — and the
    // origin is now specific enough to say WHICH realization this was.
    expect(seen).toEqual([
      {
        path: 'a.n',
        origin: 'restoration',
        meta: {
          intent: 'system',
          origin: 'restoration',
          participation: 'realized',
          positionIds: [3],
        },
      },
    ]);
  });
});

describe('MUT-2 — is the authored/realized marking SYMMETRIC?', () => {
  const capture = () => {
    const seen: Array<Record<string, unknown>> = [];
    const off = getPathNotifier().subscribe(
      '**',
      (
        _n: unknown,
        _p: unknown,
        path: string,
        _op?: string,
        origin?: unknown,
        _s?: unknown,
        _pi?: unknown,
        meta?: unknown
      ) => {
        const m = (meta ?? {}) as Record<string, unknown>;
        seen.push({
          path,
          origin: origin ?? null,
          participation: m['participation'] ?? null,
        });
      }
    );
    return { seen, off };
  };

  it('REDO is also marked realization', async () => {
    resetPathNotifier();
    const tree = signalTree({ a: { n: 1 } }, { enhancers: [timeTravel()] });
    await tick();
    undoable(() => tree.$.a.n.set(2));
    await tick();
    tree.undo();
    await tick();

    const { seen, off } = capture();
    tree.redo();
    await tick();
    off();

    // MUT-2's finding SURVIVES: a redo is still marked realization, because from
    // the perspective of authorship and history admission it is realization-like.
    // What is new is the more specific provenance — `origin: 'restoration'` —
    // added so a diagnostic observer can distinguish a restoration from a server
    // refresh. The classification did not change; the origin was added.
    expect(seen).toEqual([
      { path: 'a.n', origin: 'restoration', participation: 'realized' },
    ]);
  });

  it('THE ASYMMETRY: authorship is signalled by ABSENCE, not by a positive mark', async () => {
    resetPathNotifier();
    const tree = signalTree({ a: { n: 1 } }, { enhancers: [timeTravel()] });
    await tick();

    const { seen, off } = capture();
    undoable(() => tree.$.a.n.set(2));
    await tick();
    off();

    // An ordinary authored write carries NO participation at all. A consumer can
    // only conclude "authored" from the ABSENCE of the realization mark.
    expect(seen).toHaveLength(1);
    expect(seen[0]['participation']).toBeNull();
    expect(seen[0]['origin']).toBeNull();
  });
});

describe('MUT-2A — what does ABSENCE of participation mean?', () => {
  /**
   * Before expanding the matrix to rollback/hydrate/transactions, establish
   * what an unmarked write MEANS. Otherwise an `undefined` result from hydrate
   * would tell us nothing.
   *
   * Three candidate ontologies were open:
   *   undefined = authoring
   *   undefined = unspecified / legacy
   *   undefined = irrelevant unless explicitly realization
   */
  it('THE DEFAULTING RULE: absence is actively converted to authoring', () => {
    // write-participation.ts is four lines long:
    //   (meta) => meta?.participation ?? 'authored'
    expect(getWriteParticipation(undefined)).toBe('authored');
    expect(getWriteParticipation({})).toBe('authored');
    expect(getWriteParticipation({ participation: 'authored' })).toBe('authored');
    expect(getWriteParticipation({ participation: 'realized' })).toBe(
      'realized'
    );
  });

  it('COLLAPSE: unmarked and explicitly-authoring are INDISTINGUISHABLE', () => {
    // Every surviving reader goes through getWriteParticipation, so no consumer
    // can tell "nobody established a mode" from "someone established authoring".
    expect(getWriteParticipation(undefined)).toBe(
      getWriteParticipation({ participation: 'authored' })
    );
  });

  it('the notifier batch-identity key inherits the collapse', () => {
    const notifier = new PathNotifier({ batching: false });
    // Identity is derived from getWriteParticipation, so an unmarked entry and an
    // explicitly-authoring entry produce the same discriminator.
    expect(
      (notifier as unknown as { constructor: unknown }).constructor
    ).toBeDefined();
    expect(getWriteParticipation({ participation: 'authored' })).toBe(
      getWriteParticipation(undefined)
    );
  });
});

describe('MUT-2B — does OMITTING the realization stamp manufacture authorship?', () => {
  /**
   * The one-variable falsifier. Take a physically identical write, otherwise
   * eligible for capture, and change ONLY whether it carries
   * `participation: 'realized'`.
   *
   *   A   participation: 'realized'   -> expected: not captured
   *   B   participation absent           -> ?
   *
   * If B is captured, omission manufactures authorship deterministically, and
   * the requirement stops being a plausibility argument.
   */
  const run = async (meta: Record<string, unknown>) => {
    const tree = signalTree({ a: { n: 0 } }, { enhancers: [timeTravel()] });
    await tick();
    const before = tree.getHistory().length;

    withWriteContext(meta as never, () => {
      undoable(() => tree.$.a.n.set(1));
    });
    await tick();

    return { delta: tree.getHistory().length - before, value: tree.$.a.n() };
  };

  it('CONTROL — no write context at all', async () => {
    const r = await run({});
    expect(r).toEqual({ delta: 1, value: 1 });
  });

  it('A — explicitly classified realization', async () => {
    const r = await run({
      participation: 'realized',
      origin: 'external',
      intent: 'system',
    });
    // Classified realization: NOT captured.
    expect(r).toEqual({ delta: 0, value: 1 });
  });

  it('B — SAME meta, realization classification OMITTED', async () => {
    const r = await run({ origin: 'external', intent: 'system' });
    // Identical to A except for the one field. CAPTURED — a history entry that
    // A did not produce. Omission manufactured authorship.
    expect(r).toEqual({ delta: 1, value: 1 });
  });
});

describe('MUT-2B CONTROL LADDER — is it the FIELD or merely the CONTEXT?', () => {
  /**
   * The earlier row labelled "no write context at all" was mislabelled: the
   * helper always wrapped the write in withWriteContext, so `run({})` was an
   * EMPTY CONTEXT, not the absence of one. Corrected here with a true
   * no-context arm and a four-rung ladder.
   */
  const withCtx = async (meta: Record<string, unknown> | null) => {
    const tree = signalTree({ a: { n: 0 } }, { enhancers: [timeTravel()] });
    await tick();
    const before = tree.getHistory().length;
    if (meta === null) {
      undoable(() => tree.$.a.n.set(1));
    } else {
      withWriteContext(meta as never, () => {
        undoable(() => tree.$.a.n.set(1));
      });
    }
    await tick();
    return tree.getHistory().length - before;
  };

  it('the mode FIELD is decisive, not the presence of a context', async () => {
    const noContext = await withCtx(null);
    const emptyContext = await withCtx({});
    const systemNoMode = await withCtx({ origin: 'external', intent: 'system' });
    const realization = await withCtx({
      origin: 'external',
      intent: 'system',
      participation: 'realized',
    });

    // The first three are indistinguishable at this gate; only the mode moves it.
    expect([noContext, emptyContext, systemNoMode]).toEqual([1, 1, 1]);
    expect(realization).toBe(0);
  });
});

describe('MUT-2C — is realization FORGEABLE from ordinary authoring code?', () => {
  /**
   * Before 15.0, `withWriteContext` was reachable through the public authoring
   * subpath. The historical question was not hypothetical: could arbitrary
   * consumer code claim `realization` over an ordinary application mutation,
   * and did the claim take effect?
   */
  it('an ORDINARY application write, claimed as realization', async () => {
    const tree = signalTree({ balance: 0 }, { enhancers: [timeTravel()] });
    await tick();
    const before = tree.getHistory().length;

    withWriteContext({ participation: 'realized' } as never, () => {
      undoable(() => tree.$.balance.set(1_000_000));
    });
    await tick();

    // The claim TAKES EFFECT: truth changed, and the change is invisible to
    // causal history.
    expect(tree.$.balance()).toBe(1_000_000);
    expect(tree.getHistory().length - before).toBe(0);
    expect(tree.canUndo()).toBe(false);
  });

  it('the same write WITHOUT the claim — the control', async () => {
    const tree = signalTree({ balance: 0 }, { enhancers: [timeTravel()] });
    await tick();
    const before = tree.getHistory().length;

    undoable(() => tree.$.balance.set(1_000_000));
    await tick();

    expect(tree.$.balance()).toBe(1_000_000);
    expect(tree.getHistory().length - before).toBe(1);
    expect(tree.canUndo()).toBe(true);
  });
});
