import { expect, it } from 'vitest';

import type { Proposal } from './enhancers/transactions/transactions.types';

/**
 * PROPOSAL-REALIZATION-CONFORMANCE — PROPOSAL-0 Phase B.
 *
 * The kernel owns what proposal semantics MEAN; Phase A settled that against
 * framework-neutral behaviour and it is not re-litigated here. This contract
 * asks one narrower question per adapter:
 *
 * > does this framework's native reactive carrier PHYSICALLY REALIZE those
 * > semantics through references a component already holds?
 *
 * The assertions live here and are shared. An adapter supplies only physical
 * hooks. That is deliberate: adapter test depth is wildly uneven — angular 29
 * specs, vue 6, react 2, solid 1 — and "is Proposal supported here" must stop
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
 * Out of scope on purpose: no adapter-specific proposal helpers, no re-testing
 * of proposal semantics, no export plumbing. `propose()` rides on the tree and
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

export type MixedFrame = {
  readonly scalar: number;
  readonly ids: readonly string[];
};

/**
 * Physical hooks. Everything here is spelling and scheduling; no hook may
 * contain an assertion, and the contract may not branch on `framework` — a
 * contract with per-framework exceptions is four contracts wearing one name.
 */
export type ProposalRealizationHooks<Tree> = {
  readonly framework: string;

  /**
   * Build a tree with `transactions()` and state shaped
   * `{ scalar: number; rows: entityMap<ConformanceRow, string> }`, using THIS
   * adapter's own `signalTree`, inside whatever reactive scope it needs.
   */
  createStore(): { tree: Tree; dispose(): void };

  /** `tree.propose(fn)` — present on every adapter; no re-export needed. */
  propose(tree: Tree, fn: () => void): Proposal;

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

  /** Let this framework's scheduler run to quiescence. */
  flush(): Promise<void>;
};

/**
 * Run the five-behaviour contract. Call inside a `describe`.
 */
export function proposalRealizationContract<Tree>(
  hooks: ProposalRealizationHooks<Tree>
): void {
  // 1 ──────────────────────────────────────────────────────────────────────
  it('1 speculative publication — proposed values reach the native carrier before settlement', async () => {
    const { tree, dispose } = hooks.createStore();
    const observed = hooks.observeScalar(tree);
    await hooks.flush();
    expect(observed.current()).toBe(0);

    hooks.propose(tree, () => hooks.writeScalar(tree, 7));
    await hooks.flush();

    // A reviewer must see the proposal through the reference the UI already
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

    const proposal = hooks.propose(tree, () => hooks.writeScalar(tree, 7));
    await hooks.flush();

    proposal.accept();
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

    const proposal = hooks.propose(tree, () => hooks.writeScalar(tree, 7));
    await hooks.flush();
    expect(observed.current()).toBe(7);

    proposal.reject();
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

    const proposal = hooks.propose(tree, () => {
      hooks.writeScalar(tree, 7);
      hooks.addRow(tree, { id: 'A', name: 'Alpha' });
    });
    await hooks.flush();
    proposal.accept();
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

    const proposal = hooks.propose(tree, () => {
      hooks.writeScalar(tree, 7);
      hooks.addRow(tree, { id: 'A', name: 'Alpha' });
    });
    await hooks.flush();
    proposal.reject();
    await hooks.flush();

    for (const frame of observed.seen) {
      expect(frame.scalar === 7).toBe(frame.ids.includes('A'));
    }
    expect(observed.current()).toEqual({ scalar: 0, ids: [] });

    observed.dispose();
    dispose();
  });

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

  it('5b lifetime preservation holds when the rename happens inside a proposal', async () => {
    const { tree, dispose } = hooks.createStore();
    hooks.addRow(tree, { id: 'A', name: 'Original' });
    await hooks.flush();

    const held = hooks.holdEntity(tree, 'A');
    await hooks.flush();

    const proposal = hooks.propose(tree, () => {
      hooks.removeRow(tree, 'A');
      hooks.addRow(tree, { id: 'A', name: 'Impostor' });
    });
    await hooks.flush();

    expect(held.current()?.name).not.toBe('Impostor');

    proposal.reject();
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
