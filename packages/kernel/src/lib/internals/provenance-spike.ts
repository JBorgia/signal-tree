/**
 * ═══════════════════════════════════════════════════════════════════════════
 * RESULT: OUTCOME B. Ownership stays outside the kernel, but a narrow
 * authoring seam is required. Measured 2026-09-08, 9 passed / 5 failed.
 *
 * THE FALSIFIER THAT FIRED. On a tree constructed with `transactions()`,
 * `interceptLeafSignals` observes NOTHING — not inside a transaction, and not
 * outside one either. The enhancer replaces the leaf write path entirely.
 * Probed directly: a write on a plain tree is observed; the identical write on
 * a `transactions()` tree is not, while state demonstrably changes (0 → 5 → 7).
 *
 * That is fatal for outcome A, because `transactions()` is precisely the
 * enhancer producing the committed-versus-rolled-back distinction provenance
 * exists to record. A provenance enhancer cannot observe consequences on any
 * tree that also transacts.
 *
 * WHY B AND NOT C. The kernel already holds every fact required. It knows the
 * write happened, and it knows the outcome at
 * `settleCommitScope(owner, id, outcome)`. What is missing is PUBLICATION, not
 * semantics:
 *
 *   1. a write-observation channel that survives enhancer composition
 *   2. settlement outcome delivered to listeners — `onCommitScopesSettled`
 *      currently passes `() => void` and drops the commit/discard outcome
 *
 * Both expose existing internal truth. Neither is a new semantic fact, so
 * kernel semantics stay closed.
 *
 * WHAT PASSED, AND WHY IT MATTERS. The nine green cases are the semantically
 * hard ones: order-invariance between provenance and `external()`, nested
 * scopes with lineage, partial classification when a scope throws over an
 * already-durable write, `no-published-state-effect` on a same-value write, and
 * coverage-gap accounting for authored writes outside every scope. The evidence
 * MODEL is sound. Only its observational reach fails.
 *
 * SCOPE OF THE EVIDENCE. Only `transactions()` was tested. Whether
 * `restoration()` or `batching()` suppress interception the same way is
 * UNTESTED and must not be assumed either way.
 *
 * NOTHING WAS REPAIRED TO MAKE THIS PASS. Per the preregistration, the
 * limitation is the result.
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
  published: boolean;
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
  const published = record.effects.filter((e) => e.published).length;

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
export function observeProvenance(tree: { $: object }): () => void {
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
        published: !Object.is(next, prev),
        equalityBasis: 'Object.is',
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
