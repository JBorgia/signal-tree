# Independent S3 failure adjudication

## Disposition

The mixed scalar/entity counterexample is valid and independently reproduced without diagnostic instrumentation. It is a failure of the minimal S3 ordinary-baseline discharge path explicitly included and claimed migrated in slice1. It is not an unmigrated S4/structural-writer result and does not depend on unresolved inspection-created lifetime semantics. Under the recurrence clarification, stop dependent migration/qualification and preserve the source for disposition; do not silently repair another handoff. This finding rejects the current slice1 candidate, not the possibility of a shared transition representation.

## Independent raw evidence

Directory `/private/tmp/semantic-transition-s3-review/` contains prewritten `witness.ts`, `build.mjs`, executable `bundle.mjs`, first result `first.log`, and `SHA256SUMS`. The builder bundles current candidate native source directly, with no instrumentation plugin. It uses Node24.15.0 and the candidate's esbuild. This is focused executable evidence, not Nx/package qualification.

Two scenarios differ only in whether the first transaction also writes scalar x:

1. Ordinary row `{id:a,n:7,m:0}`.
2. Inspection writes n99, leaving ordinary n7.
3. Transaction writes m4; mixed arm also writes x1.
4. Reject transaction. Both arms physically restore m0 and x0, preserving displayed inspection n99.
5. New transaction explicitly writes n99. Inspect it, then reject it.

Pure-row control: step5 inspection lists `rows.a.n`; rejection restores n7. Mixed arm: step5 inspection is empty; rejection leaves n99. Both use an ordinarily existing subject with unchanged membership/order, so no new public structural decision is needed. Neither uses `undo`, so the previous missing-designation harness issue is irrelevant.

Replay:

```sh
/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node /private/tmp/semantic-transition-s3-review/bundle.mjs
```

## Precise causal divergence

Candidate paths relative to `packages/kernel/src/`:

- `lib/internals/causal-runtime/tree-realization-adapter.ts:725–740` creates a full physical row from `snapshotCollectionEntityValue`, overlays only reversal field m, then passes `{subjectId,key,value}` to `__preparePointValues`. It does not pass the reversal field footprint or independently computed ordinary target.
- `lib/entity-signal.ts:507–528` clones that full row and calls `prepareValueTransition(subjectId, after)` without fields. It then installs the resulting authority transition.
- `lib/physical/entity-value-store.ts:18–25` correctly reads ordinaryBefore n7/m4, but no-fields default sets ordinaryAfter equal to physicalAfter n99/m0. Lines45–47 calculate no divergence; line57 deletes the inspection baseline. The rollback of m thus accidentally makes untouched inspected n99 ordinary authority.
- The next explicit n99 write is consequently considered ordinary equality. Empty inspection and rollback99 are downstream consequences of baseline promotion, not missing wake-up or display-only staleness.

Worker instrumented `s3-probe/mixed.json` records exactly that transition: ordinaryBefore n7/m4, ordinaryAfter n99/m0, retainDivergence false. Independent public replay confirms the observable consequence without those added hooks. The worker's immediate-undo branch is not used as correctness evidence because it omits the documented settled-turn boundary; its rollback branch is sufficient.

## Contract / recurrence classification

The authorized plan moved minimal S3 discharge into slice1 precisely because adoption/rollback cannot depend on a later slice. Prior independent review marked this exact route unproved: its full-row installation lacked footprint evidence. The current source now demonstrates that concern as an ordinary-input falsifier. Restoring m must not convert unrelated inspection n into ordinary truth; the passing partial-write contract and scalar/entity adoption rule require n99 still be meaningfully adoptable afterward.

The missing fact is the **authorized realization footprint/ordinary target**, lost when point reversal is converted to a full physical row. The prepared transition container's existence does not recover that fact. This is the same class of physical-versus-ordinary misclassification at an already-included handoff, so the unmigrated-path exemption does not apply.

No runtime patch, test weakening, broad suite or performance work was performed in this adjudication. Existing successes and the corrected restoration12/12 result remain valid within their scope; they do not qualify the mixed S3 route.
