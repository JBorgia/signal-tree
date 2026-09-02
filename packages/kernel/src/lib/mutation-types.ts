export type StructuralEffect =
  | {
      kind: 'add';
      subject: number;
      key: string | number;
      value: unknown;
      beforeSubject?: number;
      afterSubject?: number;
      /** Structural ownership positions encompassed by this existence transition. */
    }
  | {
      kind: 'remove';
      subject: number;
      key: string | number;
      value: unknown;
      beforeSubject?: number;
      afterSubject?: number;
      /** Structural ownership positions encompassed by this existence transition. */
    }
  | {
      kind: 'rekey';
      subject: number;
      beforeKey: string | number;
      afterKey: string | number;
      /** Structural ownership positions encompassed by this existence transition. */
    };

export type PositionId = number;

/**
 * ⚠️ `MutationKind` WAS DELETED IN 15.0 with the envelope field it existed for.
 *
 * It enumerated seven mutation shapes — set/update/insert/remove/move/rekey/
 * replace — but only two were ever produced (`'set'`, `'update'`), and the third
 * producer computed its value FROM the `mutationIntent` sitting beside it. Five
 * members were unreachable and the two live ones were redundant with a field
 * that IS consumed. Nothing branched on it anywhere.
 *
 * Do not reintroduce a "kind of mutation" enum here without a consumer that
 * branches on it. The concepts survive where they are actually decided:
 * `mutationIntent` ('replace' | 'derive') for causal participation, and
 * `StructuralEffect.kind` ('add' | 'remove' | 'rekey') for existence
 * transitions — both of which have real readers.
 */

/**
 * How a write participates in SignalTree's causal mechanisms.
 *
 * This is a POLICY dimension and is deliberately independent of `source`, which
 * answers a different question (where the write came from). Two writes with the
 * same origin can participate differently, and two writes with different origins
 * can share a participation — `restoration` and external truth both realize.
 *
 * - `authoring`    application-authored work. Eligible for restoration
 *                  designation, contributes to a transaction, creates dependency
 *                  evidence.
 * - `realization`  established truth or consequence, not newly authored. Never
 *                  becomes an authored turn, but may still create dependency
 *                  evidence (TX-LEDGER C3) and is protected from being
 *                  discarded by a restoration (RESTORE-P0 P0-C).
 * - `inspection`   diagnostic state application — a DevTools jump. Not
 *                  application work and not authoritative truth, so it is
 *                  excluded from restoration admission, transaction
 *                  contribution and dependency admission, and it is not
 *                  protected against being overwritten by a restoration.
 *                  DEVTOOLS-JUMP-0 / 0.1.
 */
export type WriteParticipation = 'authored' | 'realized' | 'inspection';

/**
 * Metadata describing the intent and source of a tree update.
 *
 * Set ambient context for enhancers using `withWriteContext({...}, () => tree.$.x.set(y))`
 * from `@signal-tree/kernel`. Enhancers read the active context via `getActiveWriteContext()`.
 */
export interface WriteMetadata {
  /** Intent of the update (closed union — adding new intents is a core change). */
  intent?: 'hydrate' | 'reset' | 'bulk' | 'migration' | 'user' | 'system';
  /**
   * Origin of the update — where this application came from (closed union).
   *
   * PROVENANCE only. How a write may participate in causal mechanisms is the
   * separate `participation` axis; the two are deliberately independent, so never
   * infer one from the other.
   *
   * An ABSENT origin means ordinary application work. There is no positive
   * `'application'` value: nothing needs to distinguish "no origin recorded"
   * from "authored by the application", and stamping every write to say so
   * would cost the common path for no consumer's benefit.
   *
   * Three spellings were withdrawn in 15.0 because they named no owner:
   * `'system'` was fabricated provenance (the realization adapter's
   * `?? 'system'` fallback, seven sites, deleted); `'user'` duplicated the
   * meaningful absence above; `'serialization'` claimed a provenance nothing
   * ever stamped. A positive origin exists when provenance carries semantic
   * information — not because the union previously admitted the spelling.
   *
   * `'transaction-rollback'` was added by DIAG-JOURNAL-1.1 under that same rule:
   * a compensation write is a realization whose reason to exist is a withdrawn
   * transaction, and a diagnostic reader could not tell it from external truth.
   * It answers only WHY the write exists; WHICH transaction it compensates is
   * `transactionId`, deliberately a separate fact.
   */
  origin?:
    | 'restoration'
    | 'devtools'
    | 'external'
    | 'transaction-rollback';
  /** Suppress guardrails for this update. */
  suppressGuardrails?: boolean;
  /**
   * ⚠️ `positionIds` WAS DELETED FROM `WriteMetadata` IN 15.0 —
   * SUBJECT-IDENTITY-OWNERSHIP-0, an intentional pre-freeze public contraction.
   *
   * Eight writers (replay + restoration stamping the ambient write context),
   * zero production readers, and genuine DUPLICATE transport: every observer of
   * a replayed write already receives the owner position authoritatively —
   * `notify(...)` passes it positionally and `interceptLeafSignals` derives it
   * from the node's own `__positionIds`. Repointing the one carrier that read
   * the copy to the interceptor's own argument kept it green, and that is what
   * proved the duplication.
   *
   *     A PUBLIC OPTIONAL FIELD WITH PRODUCERS BUT NO CONSUMERS DOES NOT EARN
   *     SURVIVAL WHEN THE SAME FACT ALREADY HAS AN AUTHORITATIVE TRANSPORT.
   *
   * ⚠️ `subjectIds` BELOW MEASURED IDENTICALLY AND DID NOT DIE WITH IT. See its
   * note: the same eight-writers/zero-readers count did not mean the same thing.
   */
  /**
   * ⚠️ `subjectIds` WAS DELETED FROM `WriteMetadata` IN 15.0 —
   * REPLAY-SUBJECT-ATTRIBUTION-0, option (a). It outlived its sibling
   * `positionIds` by one round, and the extra round is the record worth keeping.
   *
   * The first deletion attempt FAILED, correctly: substituting the node's
   * `__subjectIds` returned `[1, 2]` for a rekeyed row where the replayed effect
   * names `[1]`. Node subject LINEAGE and causal effect ATTRIBUTION are
   * genuinely different facts.
   *
   *     A FAILED SUBSTITUTION PROVES THE FACT IS DISTINCT. IT DOES NOT
   *     AUTOMATICALLY PROVE THE INCUMBENT CARRIER IS THE RIGHT OWNER.
   *
   * Being distinct did not earn this field a public slot. Eight writers, zero
   * production readers, and the one route where the copy was the sole carrier —
   * `interceptLeafSignals` — is unexported and explicitly "not root app API",
   * with no consumer outside core. Its only readers were two test observers.
   *
   *     A TEST CAN PROVE THAT TWO FACTS ARE DISTINCT WITHOUT EARNING A PUBLIC
   *     OBSERVATION CHANNEL FOR EITHER FACT.
   *
   *     TEST-ONLY OBSERVABILITY DOES NOT CREATE A PRODUCTION SEMANTIC JOB.
   *
   * NOTHING REPLACED IT — no `replaySubjectIds`, no replay context, no newly
   * exposed `CanonicalTurn.__effects[].subjectId`. Building any of those would
   * have been runtime machinery whose only consumers are tests.
   *
   * Correctness never lived here. Reinstating a wrong subject id
   * (`createSubject(mutation.subjectId + 1000, …)`) turns 432 tests red, so the
   * causal machinery depends on real subject identity independently of this
   * copy. What died is one observation channel; the facts — `effect.subjectId`,
   * `restorationSubjectIds`, and StructuralStore subject identity — all survive.
   */
  /** @internal Explicit transaction grouping token for Gate 3 attribution. */
  transactionId?: number;
  /** @internal Owning tree token for transaction attribution isolation. */
  transactionOwner?: object;
  /**
   * @internal Registry namespace of the location this write touched.
   *
   * NOTIFIER-SCOPE-0. The path notifier is process-global and every AUTHORITY
   * consumer subscribes with `'**'`, so restoration and transactions receive
   * writes belonging to OTHER trees. Delivered here so they can decline them:
   * `positionId` alone cannot say which tree it indexes.
   */
  ownerId?: number;
  /** @internal Declared leaf-write semantics for scalar rollback classification. */
  mutationIntent?: 'replace' | 'derive';
  /** @internal Explicitly distinguishes causal authorship from causal realization. */
  participation?: WriteParticipation;
  /** @internal Canonical structural collection effect produced at mutation time. */
  structuralEffect?: StructuralEffect;
  // MATRIX-CLOSE M7 — THE ESCAPE HATCH IS DELETED.
  //
  //     /** Open extension for guardrails' historical custom-key shape. */
  //     [key: string]: unknown;
  //
  // Three facts, in order of weight:
  //
  // 1. It was ACTIVELY HARMFUL. This is the mechanism that let SEMANTICS-NAMES-1
  //    batch 1's stale `meta.source` reads keep compiling after the field was
  //    renamed — every one of them typechecked as `unknown`. Withdrawing the
  //    signature is what forced the compiler to enumerate all 24 readers, and
  //    leaving it in place means the next rename can hide the same way.
  // 2. NOTHING NEEDS IT. Compiler-verified rather than grepped: with the
  //    signature withdrawn, `npm run typecheck` passes across every package and
  //    the demo (`packages/*/src/**` + `apps/demo/src/**`).
  // 3. Its justification names a package that no longer exists — guardrails was
  //    removed in a4bc5493. The hatch outlived its only stated consumer.
  //
  // Per MATRIX-CLOSE's own rule, an open extension nobody uses is UNPROVEN, not
  // PUBLIC. A third-party enhancer that genuinely needs to carry custom keys can
  // earn a declared field the way `'transaction-rollback'` earned its origin
  // value: by producing a consumer.
}

/**
 * ⚠️ `WriteAttribution` WAS DELETED IN 15.0, with the envelope it typed.
 *
 * It was a hand-maintained SUBSET of `WriteMetadata` — intent, origin,
 * transactionId, transactionOwner, mutationIntent, participation — that existed
 * for exactly one field, `MutationEnvelope.attribution`. When ME-B deleted the
 * envelope the type had no consumer left, and the `dead-exports` gate is what
 * said so.
 *
 * The attribution FACT is untouched: `owned-mutation` still spreads
 * `getActiveWriteContext()` plus `mutationIntent` into the `meta` it publishes
 * through `notify(...)`, where it is typed as the `WriteMetadata` it always
 * really was. A parallel subset type that must be kept in sync by hand is a
 * cost the transport imposed, not a fact the kernel needs.
 */

/**
 * ⚠️ `MutationEnvelope` WAS DELETED IN 15.0 — MUTATION-ENVELOPE-OWNERSHIP-0,
 * ruling ME-B: the notification contract is the authority.
 *
 * It was a one-producer, one-consumer parameter object. `owned-mutation` built
 * it, `PathNotifier.emitMutation` immediately unpacked it field-for-field into
 * `notify(...)`, and no decision was taken in between — the adapter even
 * rejoined path segments the producer had just split and rewrapped a position
 * id the producer had just unwrapped.
 *
 *     A ONE-USE OBJECT THAT ONLY TRANSCODES INTO THE ALREADY-AUTHORITATIVE
 *     PROTOCOL IS NOT A SECOND SEMANTIC BOUNDARY.
 *
 * The audit that ended here found, in order: `kind` (produced always, read
 * never), `structural` (read once, produced never), `subjectId` (same shape,
 * plus a dead writer chain through `defineOwnedSubjectIds` and the sidecar
 * slot), and finally the transport itself.
 *
 * THE FACTS ALL SURVIVE — they travel through `notify`, which was already the
 * shared protocol that entity structural mutations used directly:
 *
 *     positionId / ownerId    kernel identity (ownerId scopes positionId,
 *                             which is deliberately NOT globally unique)
 *     path / ownerPath        kernel addressing; ownerPath stays in the
 *                             PROTOCOL because other producers genuinely
 *                             distinguish event address from owner address,
 *                             even though this producer never did
 *     before / after          the transition fact
 *     attribution             capture context + mutationIntent
 *
 * Do not answer this deletion by inventing a new generic notification object
 * carrying `subjectIds`. This route has no subject-identity producer and must
 * not acquire one:
 *
 *     ABSENCE OF A GENERIC PRODUCER IS EVIDENCE AGAINST GENERICIZING THE FACT.
 */
