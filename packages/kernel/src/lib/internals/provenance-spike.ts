/**
 * ═══════════════════════════════════════════════════════════════════════════
 * RESULT 2026-09-08 — A REFUTED. B STRONGLY INDICATED. B vs C NOT CLOSED.
 * 10 passed / 4 red of 14 written. TWO PREREGISTERED CONTROLS WERE NOT WRITTEN.
 *
 * CORRECTION TO THE FIRST REPORT. The first pass blamed `interceptLeafSignals`
 * and declared "outcome B". That was a wrong-channel error, not the finding.
 * `PathNotifier` — already subscribed by `transactions`, `restoration`, `link`,
 * the diagnostic journal and the causal realization adapter — DOES observe
 * transaction writes and delivers `meta.transactionOwner`, so tree isolation is
 * available. `interceptLeafSignals` is explicitly the FALLBACK for direct leaf
 * writes that never reach the notifier, which is why a transacting tree is
 * invisible to it. Switching channel turned case 3 green.
 *
 * WHAT IS ACTUALLY MISSING. Two facts, both narrower than first reported:
 *
 *   1. REVERSAL IS SILENT. A pending scalar transaction rollback emits NOTHING
 *      through the notifier. State returns 0 → 1 → 0 with one event, not two.
 *      `onCommitScopesSettled` also drops the commit/discard outcome
 *      (`() => void`). Cases 4, 6, 12 stay red on this.
 *
 *   2. DEFERRED PUBLICATION BREAKS SYNCHRONOUS ATTRIBUTION — the sharpest
 *      discriminator. A write inside a transaction body publishes AFTER
 *      settlement, when the synchronous provenance scope has already closed.
 *      Case 3 passes only because its scope WRAPS the transaction; case 10,
 *      where the transaction wraps two scopes, records nothing and REFUTES
 *      sub-prediction A with the current seam.
 *
 * WHY B vs C IS NOT CLOSED. Fixing (2) requires carrying a scope token from
 * write time to publication time. `WriteMetadata` is a CLOSED union with no
 * slot for one, so an enhancer cannot stash it. Whether that is publication of
 * an existing fact (B) or a new fact the kernel must retain (C) is exactly what
 * `MUTATION-OBSERVABILITY-0` must decide. Do not assume B.
 *
 * WHAT PASSED. Order-invariance with `external()`, nested scopes with lineage,
 * `partial` when a scope throws over a durable write, same-value suppression,
 * coverage-gap accounting, opaque claim carriage, and transaction COMMIT. The
 * scope model survived every non-rollback discriminator exercised. That is not
 * the same as proving the whole evidence model.
 *
 * KNOWN GAPS IN THIS SPIKE — do not read the result as covering them:
 *   - control 11 (one scope spanning two trees) WAS NEVER WRITTEN
 *   - control 14 (realization/restoration `derivedFrom`) WAS NEVER WRITTEN
 *   - `participation` — the actual authorship/realization axis — is never read;
 *     classification comes only from `meta.origin`, so the four-way
 *     authored/external/realization/restoration model is UNPROVEN
 *   - only `transactions()` tested; `restoration()` and `batching()` untested
 *   - `published` is NOT observed anywhere; see ProvenanceEffect.published
 *
 * NOTHING WAS REPAIRED TO MAKE THIS PASS.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ATTRIBUTION-OWNER-0 — INTERNAL SPIKE. NOT PUBLIC. DELETABLE.
 *
 * Answers exactly one question:
 *
 *   Can SignalTree bind an OPAQUE external claim to a synchronous provenance
 *   scope and correctly observe the resulting state consequences using existing
 *   internal kernel machinery, WITHOUT changing the public kernel contract?
 *
 * Constraints this file must not violate (TODO.md § ATTRIBUTION-OWNER-0):
 *   - inside the kernel package, unexported from index.ts / adapter.ts
 *   - no /authoring, no public API, no actor fields in WriteMetadata
 *   - no provenance fields in core mutation types
 *   - no async ambient context
 *   - externalClaim stays opaque — this file never inspects it
 *
 * DO NOT REPAIR THE KERNEL TO MAKE THIS PASS. A limitation found here is the
 * result, not a bug to fix. Classify it A / B / C and stop.
 *
 * SignalTree does not mint identity. Agent identity, delegation and
 * authorization are commodity concerns owned by an external provider (Entra,
 * Okta, AuthZEN, …). This scope carries whatever that provider issued as an
 * opaque value and binds it to state consequences.
 */

import { interceptLeafSignals } from './intercept-leaf-signals';
import { getPathNotifier } from '../path-notifier';
import type { WriteMetadata } from '../mutation-types';

export interface ProvenanceScopeContext {
  scopeId: string;
  /** Opaque provider-issued evidence. Never interpreted here. */
  externalClaim?: unknown;
}

export type ProvenanceOrigin =
  | 'authored'
  | 'external'
  | 'restoration'
  | 'devtools'
  | 'transaction-rollback';

export interface ProvenanceAttempt {
  path: string;
  origin: ProvenanceOrigin;
}

export interface ProvenanceEffect {
  path: string;
  origin: ProvenanceOrigin;
  disposition: 'committed' | 'rolled-back';
  /**
   * Deliberately NOT a boolean. No existing seam reports whether SignalTree
   * published a reactive consequence, so the spike must not claim to know.
   */
  published: 'unknown';
  /** Only that next/prev differ under Object.is. Not a publication claim. */
  objectIsChanged: boolean;
  equalityBasis?: unknown;
  derivedFrom?: string;
  /** What caused a reversal — never the scope's own actor. */
  revertedBy?: string;
  /** @internal correlation only; not part of the evidence model. */
  transactionId?: number;
}

export interface ProvenanceSummary {
  attempted: number;
  committed: number;
  rolledBack: number;
  published: number;
  classification:
    | 'committed'
    | 'rolled-back'
    | 'partial'
    | 'no-published-state-effect'
    | 'failed';
}

export interface ProvenanceScopeRecord {
  scopeId: string;
  externalClaim?: unknown;
  parentScopeId?: string;
  attempts: ProvenanceAttempt[];
  effects: ProvenanceEffect[];
  threw: boolean;
  summary: ProvenanceSummary;
}

interface Frame {
  ctx: ProvenanceScopeContext;
  parent?: Frame;
  record: ProvenanceScopeRecord;
}

/** Synchronous ambient stack. Mirrors external()'s frame discipline. */
let active: Frame | undefined;

/** Every record this observer produced, in creation order. */
const records: ProvenanceScopeRecord[] = [];

/**
 * Effects indexed by transactionId so a later compensation write can amend
 * them. A record is therefore NOT final when its scope exits — rollback
 * happens after the scope has returned. That is a finding, not a workaround.
 */
const byTransaction = new Map<number, ProvenanceEffect[]>();

/** Authored writes that landed outside every scope, for coverage accounting. */
const uncovered: ProvenanceAttempt[] = [];

function classifyOrigin(meta: WriteMetadata | undefined): ProvenanceOrigin {
  const origin = meta?.origin;
  if (origin === 'external') return 'external';
  if (origin === 'restoration') return 'restoration';
  if (origin === 'devtools') return 'devtools';
  if (origin === 'transaction-rollback') return 'transaction-rollback';
  // Absent origin means ordinary application work — see WriteMetadata.origin.
  return 'authored';
}

function summarize(record: ProvenanceScopeRecord): ProvenanceSummary {
  const committed = record.effects.filter(
    (e) => e.disposition === 'committed'
  ).length;
  const rolledBack = record.effects.filter(
    (e) => e.disposition === 'rolled-back'
  ).length;
  // Counts Object.is changes, NOT publications. See ProvenanceEffect.published.
  const published = record.effects.filter((e) => e.objectIsChanged).length;

  let classification: ProvenanceSummary['classification'];
  if (record.threw && committed > 0) classification = 'partial';
  else if (record.threw) classification = 'failed';
  else if (committed > 0 && rolledBack > 0) classification = 'partial';
  else if (rolledBack > 0 && committed === 0) classification = 'rolled-back';
  else if (published === 0) classification = 'no-published-state-effect';
  else classification = 'committed';

  return {
    attempted: record.attempts.length,
    committed,
    rolledBack,
    published,
    classification,
  };
}

/** Recompute summaries after a post-hoc amendment (rollback). */
function resummarizeAll(): void {
  for (const record of records) record.summary = summarize(record);
}

/**
 * Install the observer on a tree. Returns a teardown.
 *
 * Uses `interceptLeafSignals`, whose own doc comment warns it "misses writes
 * past maxDepth and misses array-valued leaves entirely" and says not to build
 * new consumers on it. Recorded as evidence — the spike uses it because it is
 * the only existing internal write-observation channel.
 */
export function observeProvenance(
  tree: { $: object },
  channel: 'intercept' | 'path-notifier' = 'intercept'
): () => void {
  if (channel === 'path-notifier') return observeViaPathNotifier();
  return interceptLeafSignals(
    tree.$,
    (path, next, prev, meta) => {
      const origin = classifyOrigin(meta);
      const transactionId = meta?.transactionId;

      // A compensation write amends the effects it reverses rather than
      // becoming an effect of whatever scope happens to be open.
      if (origin === 'transaction-rollback' && transactionId !== undefined) {
        const reverted = byTransaction.get(transactionId);
        if (reverted) {
          for (const effect of reverted) {
            effect.disposition = 'rolled-back';
            effect.revertedBy = `transaction:${transactionId}`;
          }
        }
        resummarizeAll();
        return;
      }

      if (!active) {
        if (origin === 'authored') uncovered.push({ path, origin });
        return;
      }

      active.record.attempts.push({ path, origin });

      const effect: ProvenanceEffect = {
        path,
        origin,
        disposition: 'committed',
        // NOT the publication fact. This is only "next and prev differ under
        // Object.is" — SignalTree's equality policy may differ, and no seam
        // currently reports whether a reactive consequence was published.
        // Naming it `published` manufactured evidence we do not have.
        objectIsChanged: !Object.is(next, prev),
        published: 'unknown',
        equalityBasis: 'Object.is (NOT the kernel publication fact)',
        transactionId,
      };
      active.record.effects.push(effect);

      if (transactionId !== undefined) {
        const list = byTransaction.get(transactionId) ?? [];
        list.push(effect);
        byTransaction.set(transactionId, list);
      }

      active.record.summary = summarize(active.record);
    },
    { maxDepth: 32 }
  );
}

/** Shared write handling, independent of which channel delivered the write. */
function ingest(
  path: string,
  next: unknown,
  prev: unknown,
  meta: WriteMetadata | undefined
): void {
  const origin = classifyOrigin(meta);
  const transactionId = meta?.transactionId;

  if (origin === 'transaction-rollback' && transactionId !== undefined) {
    const reverted = byTransaction.get(transactionId);
    if (reverted) {
      for (const effect of reverted) {
        effect.disposition = 'rolled-back';
        effect.revertedBy = `transaction:${transactionId}`;
      }
    }
    resummarizeAll();
    return;
  }

  if (!active) {
    if (origin === 'authored') uncovered.push({ path, origin });
    return;
  }

  active.record.attempts.push({ path, origin });
  const effect: ProvenanceEffect = {
    path,
    origin,
    disposition: 'committed',
    objectIsChanged: !Object.is(next, prev),
    published: 'unknown',
    equalityBasis: 'Object.is (NOT the kernel publication fact)',
    transactionId,
  };
  active.record.effects.push(effect);
  if (transactionId !== undefined) {
    const list = byTransaction.get(transactionId) ?? [];
    list.push(effect);
    byTransaction.set(transactionId, list);
  }
  active.record.summary = summarize(active.record);
}

/**
 * INVENTORY RESULT — the composition-safe channel may already exist.
 *
 * `PathNotifier` is subscribed by `transactions`, `restoration`, `link`, the
 * diagnostic journal, and the causal realization adapter, and its handler
 * already carries `meta` (transactionId, transactionOwner, participation,
 * ownerId). `interceptLeafSignals` is explicitly the FALLBACK for direct leaf
 * writes that never produce a notifier event — which is why a transacting tree
 * is invisible to it.
 *
 * If the transaction cases pass through this channel, no new seam is required
 * and outcome A returns. That is the question this exists to settle.
 */
function observeViaPathNotifier(): () => void {
  const notifier = getPathNotifier();
  if (!notifier) return () => undefined;
  return notifier.subscribe(
    '**',
    (value, prev, path, _ownerPath, _origin, _subjectIds, _positionIds, meta) =>
      ingest(path, value, prev, meta)
  );
}

/**
 * Bind an opaque external claim to a synchronous scope.
 *
 * Synchronous only, for the reason `external()` gives in its ST1035 ruling:
 * ambient context does not survive `await`, and a write after one would land
 * unattributed.
 */
export function provenanceScope<R>(
  ctx: ProvenanceScopeContext,
  fn: () => R
): R {
  const record: ProvenanceScopeRecord = {
    scopeId: ctx.scopeId,
    externalClaim: ctx.externalClaim,
    parentScopeId: active?.ctx.scopeId,
    attempts: [],
    effects: [],
    threw: false,
    summary: {
      attempted: 0,
      committed: 0,
      rolledBack: 0,
      published: 0,
      classification: 'no-published-state-effect',
    },
  };
  records.push(record);

  const frame: Frame = { ctx, parent: active, record };
  const previous = active;
  active = frame;
  try {
    const result = fn();
    // Plain thenable test, matching external()'s ST1035 guard rather than a
    // hand-rolled object-or-function walker (lint: no-restricted-syntax).
    if (
      typeof (result as { then?: unknown } | null | undefined)?.then ===
      'function'
    ) {
      throw new Error(
        'PROVENANCE-SPIKE: async scope refused — see external()’s ST1035 rule.'
      );
    }
    return result;
  } catch (error) {
    record.threw = true;
    throw error;
  } finally {
    active = previous;
    record.summary = summarize(record);
  }
}

export function getProvenanceRecords(): readonly ProvenanceScopeRecord[] {
  return records;
}

export function getUncoveredAuthoredWrites(): readonly ProvenanceAttempt[] {
  return uncovered;
}

export function resetProvenanceSpike(): void {
  records.length = 0;
  uncovered.length = 0;
  byTransaction.clear();
  active = undefined;
}
