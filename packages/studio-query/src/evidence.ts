import { type StudioTreeId } from './records';

/**
 * A value as it was AT CAPTURE TIME.
 *
 * ⚠️ Queries must respect this discriminator. Reaching for `effect.after.value`
 * without checking `kind` silently treats an unrepresentable value as absent —
 * and serialization loss must never read as observation loss.
 */
export type CapturedValue =
  | { readonly kind: 'value'; readonly value: unknown }
  | {
      readonly kind: 'unserializable';
      readonly valueType: string;
      readonly preview: string;
    };

export type WriteOrigin =
  | 'external'
  | 'restoration'
  | 'devtools'
  | 'transaction-rollback';

/** Stable handle for citing the exact record supporting a claim. */
export type EvidenceRef = string;

/**
 * S1 — a committed transaction's net consequence. Authoritative for what one
 * logical operation caused state to become.
 */
export interface TransactionEvidence {
  readonly kind: 'transaction';
  readonly treeId: StudioTreeId;
  readonly turnId: number;
  readonly disposition: 'committed';
  /** Tree-scoped positions supplied by the confirmed-turn reader. */
  readonly participants?: readonly number[];
  readonly effects: readonly {
    readonly path: string;
    readonly ownerPath: string;
    readonly owner?: number;
    readonly subjectId?: unknown;
    readonly structural?: 'add' | 'remove' | 'rekey';
    readonly before: unknown;
    readonly after: unknown;
  }[];
}

/**
 * S2 — one realized write. Authoritative for value succession at a location.
 *
 * ⚠️ `transactionId` is present ONLY when existing semantics supplied it, and is
 * never inferred from adjacency (`SUPERSESSION-0`, WEAK).
 */
export interface RealizationEvidence {
  readonly captureId?: string;
  readonly kind: 'realization';
  readonly treeId: StudioTreeId;
  readonly sequence: number;
  readonly path: string;
  readonly ownerPath: string;
  readonly before: CapturedValue;
  readonly after: CapturedValue;
  readonly origin?: WriteOrigin;
  readonly participation: 'realized';
  readonly transactionId?: number;
  /** Source-supplied identities, scoped to treeId; path equality is not subject identity. */
  readonly subjectIds?: readonly number[];
  readonly positionIds?: readonly number[];
  readonly metadataOmitted?: true;
}

/**
 * ⚠️ DELIBERATELY A UNION, NEVER NORMALIZED into a universal "causal event".
 *
 * The two sources have different evidentiary strength: S1 proves what a
 * transaction committed; S2 proves what a value became. Fusing them would let a
 * query silently upgrade succession into causation, which is exactly what
 * SUPERSESSION-0 forbade.
 */
export type StudioEvidence = TransactionEvidence | RealizationEvidence;

export const evidenceRef = (e: StudioEvidence): EvidenceRef =>
  e.kind === 'realization'
    ? `realization:${e.treeId}:${e.captureId ? `${e.captureId}:` : ''}${
        e.sequence
      }`
    : `transaction:${e.treeId}:${e.turnId}`;
