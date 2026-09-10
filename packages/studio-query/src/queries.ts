import { absenceCaveats, type RealizationCoverage, type UnknownReason } from './coverage';
import {
  evidenceRef,
  type CapturedValue,
  type EvidenceRef,
  type RealizationEvidence,
  type TransactionEvidence,
  type WriteOrigin,
} from './evidence';

/** The evidence a query operates over. Two sources, never fused. */
export interface EvidenceSet {
  readonly realizations: readonly RealizationEvidence[];
  readonly transactions: readonly TransactionEvidence[];
  readonly coverage: RealizationCoverage;
}

/** Every result carries coverage, so absence is never bare. */
export interface Answered<T> {
  readonly value: T;
  readonly coverage: RealizationCoverage;
  readonly caveats: readonly UnknownReason[];
}

const answer = <T>(value: T, set: EvidenceSet): Answered<T> => ({
  value,
  coverage: set.coverage,
  caveats: absenceCaveats(set.coverage),
});

/** All retained realization evidence, in capture order. */
export function realizations(set: EvidenceSet): Answered<readonly RealizationEvidence[]> {
  return answer(set.realizations, set);
}

/**
 * Realizations at exactly this address.
 *
 * ⚠️ EXACT address equality. No parent/child matching — an entity realization
 * addresses `rows.A`, and pretending it also addresses `rows.A.name` would
 * present a derived diff as a kernel-addressed fact (`SUPERSESSION-0` case 3).
 */
export function realizationsForPath(
  set: EvidenceSet,
  path: string
): Answered<readonly RealizationEvidence[]> {
  return answer(set.realizations.filter((r) => r.path === path), set);
}

/** The most recent retained realization at this address, if any. */
export function latestRealization(
  set: EvidenceSet,
  path: string
): Answered<RealizationEvidence | undefined> {
  const matches = set.realizations.filter((r) => r.path === path);
  return answer(matches.at(-1), set);
}

/**
 * The value this effect replaced — **its own `before`**.
 *
 * ⚠️ NOT the operation responsible for that value. SUPERSESSION-0 returned
 * WEAK: no referent ties a realization to an authored consequence, so a
 * predecessor is a VALUE, never a cause. Locating what produced that value is a
 * separate lookup (`priorProducerFor`), and is itself only DERIVED.
 */
export function predecessor(effect: RealizationEvidence): CapturedValue {
  return effect.before;
}

/**
 * S1 evidence whose committed value MATCHES this realization's `before`.
 *
 * ⚠️ DERIVED, AND DELIBERATELY WEAK. A value match plus "no later retained
 * evidence between them" is not causation — the producer may be unretained, and
 * two operations can commit the same value. Returns candidates, never a cause.
 */
export function priorProducerFor(
  set: EvidenceSet,
  effect: RealizationEvidence
): Answered<readonly TransactionEvidence[]> {
  if (effect.before.kind !== 'value') {
    return answer([], set);
  }
  const target = effect.before.value;
  const candidates = set.transactions.filter((t) =>
    t.effects.some((e) => e.path === effect.path && Object.is(e.after, target))
  );
  return answer(candidates, set);
}

export interface ObservedResponsibility {
  readonly path: string;
  readonly currentValue: CapturedValue;
  readonly source:
    | { readonly kind: 'realization'; readonly evidenceId: EvidenceRef; readonly origin?: WriteOrigin }
    | { readonly kind: 'transaction'; readonly evidenceId: EvidenceRef }
    | { readonly kind: 'unknown'; readonly reason: UnknownReason };
  readonly confidence: 'fact' | 'derived';
}

/**
 * What last established the value currently at this address.
 *
 * ⚠️ "Latest event we hold" must NOT become "current owner" without checking the
 * live value. If the current value differs from the latest retained evidence,
 * responsibility is UNKNOWN — something happened that was not captured.
 *
 * The name says *observed*: this is the latest observed establishment, not a
 * causal claim about who is responsible.
 */
export function currentObservedResponsibility(
  set: EvidenceSet,
  path: string,
  currentValue: CapturedValue
): Answered<ObservedResponsibility> {
  const latest = set.realizations.filter((r) => r.path === path).at(-1);

  if (!latest) {
    return answer(
      { path, currentValue, source: { kind: 'unknown', reason: 'no-retained-evidence' }, confidence: 'derived' },
      set
    );
  }

  const matches =
    latest.after.kind === 'value' &&
    currentValue.kind === 'value' &&
    Object.is(latest.after.value, currentValue.value);

  if (!matches) {
    // Later activity exists that this capture did not observe.
    return answer(
      { path, currentValue, source: { kind: 'unknown', reason: 'no-retained-evidence' }, confidence: 'derived' },
      set
    );
  }

  return answer(
    {
      path,
      currentValue,
      source: { kind: 'realization', evidenceId: evidenceRef(latest), origin: latest.origin },
      confidence: 'fact',
    },
    set
  );
}

export type EpistemicClass = 'fact' | 'derived' | 'unknown';

export interface ExplanationClaim {
  readonly id: string;
  readonly classification: EpistemicClass;
  readonly code: string;
  readonly evidence: readonly EvidenceRef[];
  readonly data: Record<string, unknown>;
}

/**
 * Structured claims, never prose — the UI renders them.
 *
 * Every claim carries an evidence reference from day one, so a rendered
 * statement can highlight the exact record supporting it. That is the seed of
 * the eventual causal graph without building a graph engine now.
 */
export function explainValue(set: EvidenceSet, path: string): Answered<readonly ExplanationClaim[]> {
  const claims: ExplanationClaim[] = [];
  let n = 0;
  const id = () => `claim-${++n}`;

  // S1: what transactions committed here. FACT — S1 is authoritative.
  for (const t of set.transactions) {
    for (const e of t.effects.filter((x) => x.path === path)) {
      claims.push({
        id: id(),
        classification: 'fact',
        code: 'TRANSACTION_COMMITTED_VALUE',
        evidence: [evidenceRef(t)],
        data: { path, turnId: t.turnId, before: e.before, after: e.after },
      });
    }
  }

  const forPath = set.realizations.filter((r) => r.path === path);
  for (const r of forPath) {
    claims.push({
      id: id(),
      classification: 'fact',
      code: 'REALIZATION_CHANGED_VALUE',
      evidence: [evidenceRef(r)],
      data: { path, before: r.before, after: r.after, origin: r.origin },
    });
  }

  const latest = forPath.at(-1);
  if (latest) {
    claims.push({
      id: id(),
      classification: 'derived',
      code: 'VALUE_SUPERSEDED_PREDECESSOR',
      evidence: [evidenceRef(latest)],
      data: { path, superseded: latest.before, current: latest.after },
    });

    // The claim SUPERSESSION-0 forbids making positively.
    claims.push({
      id: id(),
      classification: 'unknown',
      code: 'AUTHORING_CAUSE_UNKNOWN',
      evidence: [],
      data: {
        path,
        reason: latest.transactionId === undefined ? 'no-correlation-referent' : 'correlation-present',
      },
    });
  }

  // Coverage limits are themselves claims, not footnotes.
  for (const reason of absenceCaveats(set.coverage)) {
    claims.push({
      id: id(),
      classification: 'unknown',
      code: 'COVERAGE_LIMIT',
      evidence: [],
      data: { path, reason },
    });
  }

  return answer(claims, set);
}
