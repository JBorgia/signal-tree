import {
  type StudioEffect,
  type StudioSession,
  type StudioTreeId,
  type StudioTurn,
} from '@signal-tree/studio-query';

/**
 * The one S1 screen: select a transaction, see what it actually committed.
 *
 * Rendering is kept as a pure projection so the semantics are testable without
 * a DOM. The DevTools panel shell renders this; it does not compute it.
 */

export interface ConsequenceRow {
  readonly path: string;
  readonly before: string;
  readonly after: string;
  /** Present only where the effect is an existence transition. */
  readonly structural?: string;
}

export interface CommittedConsequence {
  readonly treeId: StudioTreeId;
  readonly turnId: number;
  readonly rows: readonly ConsequenceRow[];
  /**
   * What this view is NOT showing, stated rather than omitted.
   *
   * ⚠️ Studio must never present a partial answer as a complete one. S1
   * observes committed net consequence only; every other question the frozen
   * incident asks is out of this slice's declared scope and is named here so
   * the reader can see the edge of what was observed.
   */
  readonly notObserved: readonly string[];
}

const render = (value: unknown): string =>
  value === undefined ? 'undefined' : JSON.stringify(value) ?? String(value);

function toRow(effect: StudioEffect): ConsequenceRow {
  const row = {
    path: effect.path,
    before: render(effect.before),
    after: render(effect.after),
  };
  return effect.structural === undefined
    ? row
    : { ...row, structural: effect.structural };
}

/** S1's declared limits. Widened only by the slice that earns each one. */
const S1_NOT_OBSERVED: readonly string[] = [
  'attempted writes that did not survive (net effects only — MO-1B)',
  'pending or discarded transactions (S1P)',
  'external/realized truth (S2)',
  'restoration lineage (S3)',
  'nested and entity-structural composition (S4)',
];

export function committedConsequence(
  turn: StudioTurn,
  options: { readonly truncated?: boolean } = {}
): CommittedConsequence {
  return {
    treeId: turn.treeId,
    turnId: turn.id,
    rows: turn.effects.map(toRow),
    notObserved: options.truncated
      ? [
          // Retention is not completeness. If the kernel has evicted earlier
          // turns, saying so is the difference between a bounded view and a
          // wrong one.
          'turns older than the retained window (history is truncated)',
          ...S1_NOT_OBSERVED,
        ]
      : S1_NOT_OBSERVED,
  };
}

/** Transaction list for the panel's left pane. */
export function transactionList(
  session: StudioSession
): readonly { treeId: StudioTreeId; id: number; changed: number }[] {
  return session.turns().map((turn) => ({
    treeId: turn.treeId,
    id: turn.id,
    changed: turn.effects.length,
  }));
}

/** Plain-text rendering — the panel's body, and what the S1 demo shows. */
export function formatConsequence(view: CommittedConsequence): string {
  const header = `Transaction ${view.turnId}  (${view.treeId})`;
  const rows = view.rows.map(
    (row) =>
      `  ${row.path}\n    ${row.before} -> ${row.after}` +
      (row.structural ? `  [${row.structural}]` : '')
  );
  return [
    header,
    '',
    'COMMITTED NET CONSEQUENCE',
    ...rows,
    '',
    'NOT OBSERVED BY THIS SLICE',
    ...view.notObserved.map((line) => `  - ${line}`),
  ].join('\n');
}
