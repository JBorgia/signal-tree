import { expect, it } from 'vitest';

import type { PendingTransaction } from './enhancers/transactions/transactions.types';

function required<T>(value: T | null | undefined): T {
  if (value === undefined || value === null) {
    throw new Error('Missing required test value');
  }
  return value;
}

/**
 * PROPOSAL-REALIZATION-CONFORMANCE — PROPOSAL-0 Phase B.
 *
 * The kernel owns what pending semantics MEAN; Phase A settled that against
 * framework-neutral behaviour and it is not re-litigated here. This contract
 * asks one narrower question per adapter:
 *
 * > does this framework's native reactive carrier PHYSICALLY REALIZE those
 * > semantics through references a component already holds?
 *
 * The assertions live here and are shared. An adapter supplies only physical
 * hooks. That is deliberate: adapter test depth is wildly uneven — angular 29
 * specs, vue 6, react 2, solid 1 — and "is PendingTransaction supported here" must stop
 * being answerable by spec count. THIS CONTRACT IS THE DEFINITION OF SUPPORT.
 * A future adapter proves the same five behaviours rather than copying
 * whichever existing adapter happens to have the most tests.
 *
 * ## Why the hooks own writes as well as construction
 *
 * Measured, not assumed: the write grammar is genuinely adapter-physical.
 * React writes `tree.$.count(2)`; Solid leaves are real Solid accessors and
 * write `tree.$.count.set(2)`, documented in its README, with the callable
 * form rejected by its types. A contract that hard-coded either spelling would
 * be testing one adapter's grammar in the others' names.
 *
 * Out of scope on purpose: no adapter-specific pending helpers, no re-testing
 * of pending semantics, no export plumbing. `transact()` rides on the tree and
 * the public types already reach every adapter barrel by facade re-export.
 */

export type ConformanceRow = { id: string; name: string };

/** A live observation through the framework's own reactive primitive. */
export type Observation<T> = {
  /** Every value the native carrier has published, in order. */
  readonly seen: readonly T[];
  /** What the carrier currently reports. */
  current(): T;
  dispose(): void;
};

export type ValuePublicationFrame = {
  readonly phase: string;
  readonly scalar: number;
  readonly row: string | undefined;
  readonly all: string | undefined;
};

export type EntityProjectionSnapshot = {
  all: string[];
  ids: string[];
  count: number;
  empty: boolean;
  map: string[];
  hasA: boolean;
  where: string[];
  find: string | null;
  slice: string[];
  activeId: string | null;
  activeEntity: string | null;
  row: string | null;
  field: string | null;
};
export type EntityProjectionFrame = {
  phase: string;
  scalar: number;
  projections: EntityProjectionSnapshot | null;
};

export type MixedFrame = {
  readonly scalar: number;
  readonly ids: readonly string[];
};

/**
 * Physical hooks. Everything here is spelling and scheduling; no hook may
 * contain an assertion, and the contract may not branch on `framework` — a
 * contract with per-framework exceptions is four contracts wearing one name.
 */
export type TransactionRealizationHooks<Tree> = {
  readonly framework: string;

  /**
   * Build a tree with `transactions()` and state shaped
   * `{ scalar: number; rows: entityMap<ConformanceRow, string> }`, using THIS
   * adapter's own `signalTree`, inside whatever reactive scope it needs.
   */
  createStore(): { tree: Tree; dispose(): void };

  /** `tree.transact(fn)` — present on every adapter; no re-export needed. */
  transact(tree: Tree, fn: () => void): PendingTransaction;

  writeScalar(tree: Tree, value: number): void;
  readScalar(tree: Tree): number;
  addRow(tree: Tree, row: ConformanceRow): void;
  removeRow(tree: Tree, id: string): void;
  rowIds(tree: Tree): readonly string[];
  /** Write to an existing row as OUTSIDE truth would. */
  realizeRowName(tree: Tree, id: string, name: string): void;

  observeScalar(tree: Tree): Observation<number>;
  holdEntity(tree: Tree, id: string): Observation<ConformanceRow | undefined>;
  /**
   * Observe scalar and collection TOGETHER so a torn read is detectable. Each
   * emission must be one coherent pair sampled at the same instant.
   */
  observeMixed(tree: Tree): Observation<MixedFrame>;

  /** Record when the native observer executes, not when its values are delivered. */
  observeValues(
    tree: Tree,
    phase: () => string
  ): readonly Observation<ValuePublicationFrame>[];

  selectRow(tree: Tree, id: string | undefined): void;
  rekeyRow(tree: Tree, from: string, to: string): void;
  observeProjections(
    tree: Tree,
    phase: () => string,
    enabled: () => boolean
  ): readonly Observation<EntityProjectionFrame>[];

  /** Let this framework's scheduler run to quiescence. */
  flush(): Promise<void>;
};

/**
 * Run the five-behaviour contract. Call inside a `describe`.
 */
export function transactionRealizationContract<Tree>(
  hooks: TransactionRealizationHooks<Tree>
): void {
  // 1 ──────────────────────────────────────────────────────────────────────
  it('1 speculative publication — proposed values reach the native carrier before settlement', async () => {
    const { tree, dispose } = hooks.createStore();
    const observed = hooks.observeScalar(tree);
    await hooks.flush();
    expect(observed.current()).toBe(0);

    hooks.transact(tree, () => hooks.writeScalar(tree, 7));
    await hooks.flush();

    // A reviewer must see the pending through the reference the UI already
    // holds — no extra subscription, no settlement required.
    expect(observed.current()).toBe(7);
    expect(observed.seen).toContain(7);

    observed.dispose();
    dispose();
  });

  // 2 ──────────────────────────────────────────────────────────────────────
  it('2 accept publication — the committed value stays visible through the SAME held reference', async () => {
    const { tree, dispose } = hooks.createStore();
    const observed = hooks.observeScalar(tree);
    await hooks.flush();

    const pending = hooks.transact(tree, () => hooks.writeScalar(tree, 7));
    await hooks.flush();

    pending.confirm();
    await hooks.flush();

    expect(observed.current()).toBe(7);
    expect(hooks.readScalar(tree)).toBe(7);

    observed.dispose();
    dispose();
  });

  // 3 ──────────────────────────────────────────────────────────────────────
  it('3 reject publication — the restored value republishes through the SAME held reference', async () => {
    const { tree, dispose } = hooks.createStore();
    const observed = hooks.observeScalar(tree);
    await hooks.flush();

    const pending = hooks.transact(tree, () => hooks.writeScalar(tree, 7));
    await hooks.flush();
    expect(observed.current()).toBe(7);

    pending.rollback();
    await hooks.flush();

    // A carrier that published the speculative value but not its compensation
    // would strand the UI showing a value the tree no longer holds. That is the
    // failure this case exists for.
    expect(observed.current()).toBe(0);
    expect(observed.seen).toContain(0);

    observed.dispose();
    dispose();
  });

  // 4 ──────────────────────────────────────────────────────────────────────
  it('4 coherent mixed publication — accept exposes no torn scalar/structural frame', async () => {
    const { tree, dispose } = hooks.createStore();
    const observed = hooks.observeMixed(tree);
    await hooks.flush();

    const pending = hooks.transact(tree, () => {
      hooks.writeScalar(tree, 7);
      hooks.addRow(tree, { id: 'A', name: 'Alpha' });
    });
    await hooks.flush();
    pending.confirm();
    await hooks.flush();

    // Both writes belong to ONE turn, so any frame showing one without the
    // other is a torn read of that turn.
    for (const frame of observed.seen) {
      expect(frame.scalar === 7).toBe(frame.ids.includes('A'));
    }
    expect(observed.current()).toEqual({ scalar: 7, ids: ['A'] });

    observed.dispose();
    dispose();
  });

  it('4b coherent mixed publication — reject exposes no torn frame either', async () => {
    const { tree, dispose } = hooks.createStore();
    const observed = hooks.observeMixed(tree);
    await hooks.flush();

    const pending = hooks.transact(tree, () => {
      hooks.writeScalar(tree, 7);
      hooks.addRow(tree, { id: 'A', name: 'Alpha' });
    });
    await hooks.flush();
    pending.rollback();
    await hooks.flush();

    for (const frame of observed.seen) {
      expect(frame.scalar === 7).toBe(frame.ids.includes('A'));
    }
    expect(observed.current()).toEqual({ scalar: 0, ids: [] });

    observed.dispose();
    dispose();
  });

  it('4c coherent value settlement — own collection reads agree in native observers', async () => {
    const { tree, dispose } = hooks.createStore();
    let phase = 'setup';
    hooks.addRow(tree, { id: 'A', name: 'Original' });
    await hooks.flush();
    const observations = hooks.observeValues(tree, () => phase);
    try {
      await hooks.flush();
      phase = 'authoring';
      const pending = hooks.transact(tree, () => {
        hooks.writeScalar(tree, 7);
        hooks.realizeRowName(tree, 'A', 'Proposed');
      });
      phase = 'speculative-delivery';
      await hooks.flush();
      for (const observed of observations) {
        expect(observed.current()).toMatchObject({
          scalar: 7,
          row: 'Proposed',
          all: 'Proposed',
        });
      }

      phase = 'inside-rollback';
      pending.rollback();
      phase = 'after-rollback';
      await hooks.flush();
      for (const observed of observations) {
        const settlement = observed.seen.filter(
          (frame) =>
            frame.phase === 'inside-rollback' ||
            frame.phase === 'after-rollback'
        );
        // A silent observer cannot satisfy coherent publication vacuously.
        expect(settlement.length).toBeGreaterThan(0);
        for (const frame of settlement) {
          expect(frame, JSON.stringify(observed.seen)).toMatchObject({
            scalar: 0,
            row: 'Original',
            all: 'Original',
          });
        }
        expect(observed.current()).toMatchObject({
          scalar: 0,
          row: 'Original',
          all: 'Original',
        });
      }
      // No native computed freshness is required inside the authored group.
      // L13 applies to publication of the completed settlement's own reads.
    } finally {
      for (const observed of observations) observed.dispose();
      dispose();
    }
  });

  for (const operation of ['add', 'remove', 'field'] as const) {
    for (const primed of [true, false]) {
      it(`4d owned projection settlement — ${operation}, ${
        primed ? 'primed' : 'first read during delivery'
      }`, async () => {
        const { tree, dispose } = hooks.createStore();
        let phase = 'setup';
        if (operation !== 'add')
          hooks.addRow(tree, { id: 'A', name: 'Original' });
        hooks.selectRow(tree, 'A');
        await hooks.flush();
        const observations = hooks.observeProjections(
          tree,
          () => phase,
          () =>
            primed ||
            phase === 'inside-rollback' ||
            phase === 'after-rollback' ||
            phase === 'selection'
        );
        const snapshot = (
          present: boolean,
          selected: boolean
        ): EntityProjectionSnapshot => ({
          all: present ? ['A:Original'] : [],
          ids: present ? ['A'] : [],
          count: present ? 1 : 0,
          empty: !present,
          map: present ? ['A:Original'] : [],
          hasA: present,
          where: present ? ['A:Original'] : [],
          find: present ? 'A:Original' : null,
          slice: present ? ['Original'] : [],
          activeId: selected ? 'A' : null,
          activeEntity: present && selected ? 'A:Original' : null,
          row: present ? 'Original' : null,
          field: present ? 'Original' : null,
        });
        try {
          await hooks.flush();
          for (const observed of observations) {
            expect(observed.current().scalar).toBe(0);
            expect(observed.current().projections).toEqual(
              primed ? snapshot(operation !== 'add', true) : null
            );
          }
          phase = 'authoring';
          const pending = hooks.transact(tree, () => {
            hooks.writeScalar(tree, 7);
            if (operation === 'add')
              hooks.addRow(tree, { id: 'A', name: 'Proposed' });
            else if (operation === 'remove') hooks.removeRow(tree, 'A');
            else hooks.realizeRowName(tree, 'A', 'Proposed');
          });
          phase = 'speculative-delivery';
          await hooks.flush();
          for (const observed of observations)
            expect(observed.current().scalar).toBe(7);
          phase = 'inside-rollback';
          pending.rollback();
          phase = 'after-rollback';
          await hooks.flush();
          for (const observed of observations) {
            const delivered = observed.seen.filter(
              (frame) =>
                frame.phase === 'inside-rollback' ||
                frame.phase === 'after-rollback'
            );
            expect(delivered.length).toBeGreaterThan(0);
            for (const frame of delivered) {
              expect(frame.scalar).toBe(0);
              expect(frame.projections, JSON.stringify(observed.seen)).toEqual(
                snapshot(operation !== 'add', true)
              );
            }
          }
          phase = 'selection';
          hooks.selectRow(tree, undefined);
          await hooks.flush();
          for (const observed of observations) {
            const delivered = observed.seen.filter(
              (frame) => frame.phase === 'selection'
            );
            expect(delivered.length).toBeGreaterThan(0);
            for (const frame of delivered)
              expect(frame.projections).toEqual(
                snapshot(operation !== 'add', false)
              );
          }
        } finally {
          for (const observed of observations) observed.dispose();
          dispose();
        }
      });
    }
  }

  for (const scenario of [
    'initial absence',
    'same lifetime restoration',
    'new lifetime at reused key',
    'selection while absent',
    'selected rekey',
    'unrelated writes and disposal',
  ] as const) {
    for (const primed of [true, false]) {
      it(`4e selection lifetime projections — ${scenario}, ${
        primed ? 'primed' : 'first read after change'
      }`, async () => {
        const { tree, dispose } = hooks.createStore();
        const startsPresent =
          scenario !== 'initial absence' &&
          scenario !== 'selection while absent';
        if (startsPresent) hooks.addRow(tree, { id: 'A', name: 'Original' });
        hooks.selectRow(tree, 'A');
        await hooks.flush();
        let phase = 'setup';
        let scalar = 0;
        const observations = hooks.observeProjections(
          tree,
          () => phase,
          () => primed || phase !== 'setup'
        );
        const held = startsPresent ? hooks.holdEntity(tree, 'A') : undefined;
        type Entry = { key: string; id: string; name: string };
        const original: Entry = { key: 'A', id: 'A', name: 'Original' };
        const expected = (
          entries: Entry[],
          selected: string
        ): EntityProjectionSnapshot => {
          const encode = (entry: Entry | undefined) =>
            entry ? `${entry.id}:${entry.name}` : null;
          const rowA = entries.find((entry) => entry.key === 'A');
          const matches = entries.filter((entry) => entry.id === 'A');
          return {
            all: entries.map((entry) => `${entry.id}:${entry.name}`),
            ids: entries.map((entry) => entry.key),
            count: entries.length,
            empty: entries.length === 0,
            map: entries.map((entry) => `${entry.key}:${entry.name}`),
            hasA: rowA !== undefined,
            where: matches.map((entry) => `${entry.id}:${entry.name}`),
            find: encode(matches[0]),
            slice: entries.map((entry) => entry.name),
            activeId: selected,
            activeEntity: encode(
              entries.find((entry) => entry.key === selected)
            ),
            row: rowA?.name ?? null,
            field: rowA?.name ?? null,
          };
        };
        const check = async (entries: Entry[], selected = 'A') => {
          await hooks.flush();
          for (const observed of observations) {
            const delivered = observed.seen.filter(
              (frame) => frame.phase === phase
            );
            expect(delivered.length).toBeGreaterThan(0);
            for (const frame of delivered) {
              expect(frame.scalar, JSON.stringify(observed.seen)).toBe(scalar);
              expect(frame.projections, JSON.stringify(observed.seen)).toEqual(
                expected(entries, selected)
              );
            }
            expect(observed.current().scalar).toBe(scalar);
            expect(observed.current().projections).toEqual(
              expected(entries, selected)
            );
          }
        };
        const change = (name: string, action: () => void) => {
          phase = name;
          const pending = hooks.transact(tree, () => {
            hooks.writeScalar(tree, ++scalar);
            action();
          });
          pending.confirm();
        };
        try {
          await hooks.flush();
          for (const observed of observations)
            expect(observed.current().projections).toEqual(
              primed ? expected(startsPresent ? [original] : [], 'A') : null
            );
          if (held) expect(held.current()?.name).toBe('Original');
          if (scenario === 'initial absence') {
            change('insert', () =>
              hooks.addRow(tree, { id: 'A', name: 'Original' })
            );
            await check([original]);
          } else if (scenario === 'same lifetime restoration') {
            phase = 'remove';
            const pending = hooks.transact(tree, () => {
              hooks.writeScalar(tree, ++scalar);
              hooks.removeRow(tree, 'A');
            });
            await check([]);
            phase = 'rollback';
            pending.rollback();
            scalar = 0;
            await check([original]);
            expect(required(held).current()?.name).toBe('Original');
          } else if (scenario === 'new lifetime at reused key') {
            change('remove', () => hooks.removeRow(tree, 'A'));
            await check([]);
            change('replace lifetime', () =>
              hooks.addRow(tree, { id: 'A', name: 'Impostor' })
            );
            await check([{ key: 'A', id: 'A', name: 'Impostor' }]);
            expect(required(held).current()).toBeUndefined();
          } else if (scenario === 'selection while absent') {
            change('select B', () => hooks.selectRow(tree, 'B'));
            await check([], 'B');
            change('insert unselected A', () =>
              hooks.addRow(tree, { id: 'A', name: 'Original' })
            );
            await check([original], 'B');
            change('insert selected B', () =>
              hooks.addRow(tree, { id: 'B', name: 'Selected' })
            );
            await check(
              [original, { key: 'B', id: 'B', name: 'Selected' }],
              'B'
            );
          } else if (scenario === 'selected rekey') {
            change('rekey', () => hooks.rekeyRow(tree, 'A', 'X'));
            await check([{ ...original, key: 'X' }], 'X');
            expect(required(held).current()?.name).toBe('Original');
            change('write rekeyed lifetime', () =>
              hooks.realizeRowName(tree, 'X', 'Updated')
            );
            await check([{ ...original, key: 'X', name: 'Updated' }], 'X');
            expect(required(held).current()?.name).toBe('Updated');
          } else {
            change('add unrelated B', () =>
              hooks.addRow(tree, { id: 'B', name: 'Other' })
            );
            await check([original, { key: 'B', id: 'B', name: 'Other' }]);
            change('write unrelated B', () =>
              hooks.realizeRowName(tree, 'B', 'Changed')
            );
            await check([original, { key: 'B', id: 'B', name: 'Changed' }]);
            expect(required(held).current()?.name).toBe('Original');
            change('remove unrelated B', () => hooks.removeRow(tree, 'B'));
            await check([original]);
            required(held).dispose();
            const heldCount = required(held).seen.length;
            change('after held disposal', () =>
              hooks.realizeRowName(tree, 'A', 'After disposal')
            );
            await check([{ ...original, name: 'After disposal' }]);
            expect(required(held).seen.length).toBe(heldCount);
          }
        } finally {
          held?.dispose();
          for (const observed of observations) observed.dispose();
          dispose();
        }
      });
    }
  }

  // 5 ──────────────────────────────────────────────────────────────────────
  it('5 lifetime preservation — a held reference never retargets to a reused business key', async () => {
    const { tree, dispose } = hooks.createStore();
    hooks.addRow(tree, { id: 'A', name: 'Original' });
    await hooks.flush();

    const held = hooks.holdEntity(tree, 'A');
    await hooks.flush();
    expect(held.current()?.name).toBe('Original');

    // A DIFFERENT record takes the same business key.
    hooks.removeRow(tree, 'A');
    hooks.addRow(tree, { id: 'A', name: 'Impostor' });
    await hooks.flush();

    // The kernel proved these are different subjects. An adapter must not
    // smuggle the new one into an old reference by path lookup — that bug is
    // reintroducible purely in adapter code, which is why it is checked per
    // framework rather than once in the kernel.
    expect(held.current()?.name).not.toBe('Impostor');

    held.dispose();
    dispose();
  });

  it('5b lifetime preservation holds when the rename happens inside a pending', async () => {
    const { tree, dispose } = hooks.createStore();
    hooks.addRow(tree, { id: 'A', name: 'Original' });
    await hooks.flush();

    const held = hooks.holdEntity(tree, 'A');
    await hooks.flush();

    const pending = hooks.transact(tree, () => {
      hooks.removeRow(tree, 'A');
      hooks.addRow(tree, { id: 'A', name: 'Impostor' });
    });
    await hooks.flush();

    expect(held.current()?.name).not.toBe('Impostor');

    pending.rollback();
    await hooks.flush();

    // And the original must come back through that same held reference.
    expect(held.current()?.name).toBe('Original');
    expect(hooks.rowIds(tree)).toEqual(['A']);

    held.dispose();
    dispose();
  });
}

/** Re-exported so adapters do not each invent an "outside truth" spelling. */
export { withWriteContext as realizeAs } from './lib/write-context';
