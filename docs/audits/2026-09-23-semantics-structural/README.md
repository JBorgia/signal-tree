# Structural lifetime and identity: test-only evidence

207 scenarios exercise the bounded expectations below against the same frozen
baseline (`7ade0e3ecb25ff0d06da4355b5f7d67844e147b7`) and working-tree current
source. This is not 207 independent workflows, whole-law conformance, complete
composition coverage or release approval. There are known reds, missing
capabilities and baseline execution errors. No production/prototype code,
original thirteen cases, frozen law, matrix or prediction was edited.

## Neutral fixture interface

`semantics-structural-domain.ts` adds test-domain operations, not package APIs:

```ts
type EntityKey = string | number;
type EntityFields = { name: string; score: number };
type EntityRef = { readonly kind: 'held-entity' }; // opaque held reference

interface EntityDomain {
  add(key: EntityKey, value: EntityFields): EntityRef;
  lookup(key: EntityKey): EntityRef | undefined;
  remove(ref: EntityRef): void;
  rekey(ref: EntityRef, key: EntityKey): void;
  field(ref: EntityRef, change: { field: 'name'; value: string } | { field: 'score'; value: number }): void;
  heldRead(ref: EntityRef): EntityFields | undefined;
  entries(): { key: EntityKey; value: EntityFields }[];
  linkName(
    ref: EntityRef,
    receive: (name: string | undefined) => void
  ): {
    settled(): Promise<void>;
    dispose(): void;
  };
}
```

`semantics-structural-adapter.ts` maps this vocabulary to actual public
`entityMap`, `addOne`, `ids`, `byIdOrFail`, `removeOne`, `changeId`, callable entity
fields and `link`. An opaque label holds the actual public facade. Looking up its
current key scans real public keys/facades with identity equality; it never
retargets by a reused business key. Payloads do not secretly encode the key;
`addOne` receives its real public per-call selector. Numeric and string keys stay
typed. Reads return native values; no canonical overlay, SubjectId reader,
per-turn algorithm, synthetic settlement, observer or endpoint implementation is
introduced. `linkName` owns an actual asynchronous Link with an in-memory
recording endpoint. A native exception is not changed into a passing capability.

The shared fixture still provides real transaction handles, native pending-ID
membership, confirmed-count instrumentation, owner observation and teardown.
The structural extension is optional; the runner reports a missing structural
factory as unsupported instead of substituting the scalar fixture. Constructor
failures remain execution errors. Every case gets a new tree; all Links, owner
subscriptions, held labels and tree resources are released at case teardown.

## Preregistration and correction trail

`FROZEN.json` was written before the native structural adapter was implemented or
a baseline/current structural run executed. It hashes the test/domain sources
and the unchanged LAWS/MATRIX/MUTATIONS/PREDICTIONS files. Expected states are
literal scenario traces derived from L3–L9/L17 and the matrix rows, not outputs
from a candidate resolver.

The first runs are immutable `baseline-first.json` and `current-first.json`.
Lint then found ten non-null assertions in synchronous fixture setup. Their
replacement by a runtime `requireRef` guard is the only v2 oracle correction;
expected states, case IDs and operation paths did not change. This was checked
mechanically after removing just the guards and formatting. The exact first
oracle is retained in `oracle-v1.ts.txt`, matching its original hash.
`FROZEN-v2.json` records the correction and was written before either v2 run.

The runner checks the v2 freeze before execution and rejects existing output
paths. Both final runs consumed identical harness/expectation hashes and reported
`changedInputs: []`. Native entity/notifier source changed after the first run;
that triggered the separate final current run, not a rewrite of first evidence.
Both final reports record all input hashes and timestamps. They describe those
source snapshots, not future edits by concurrent workers.

## Case coverage and final results

Each keyed T-row uses `A`, `a.b`, `a/b`, `a::b`, `jo.doe@example.com`, `1.2.3`,
numeric `1`, and string `"1"`. Exact typed-key matching is used, never string
flattening. The paired identity cases additionally put distinct keys/lifetimes
in the same tree. Set membership assertions do not accidentally require an
unstated collection iteration order.

H = bounded assertions held; V = violated; U = unsupported; E = execution error.
A held dependency-refusal case is safety evidence, not successful surgery.

| Frozen row | Implemented scenario / exact scope                                                                                                                          |   Count | Baseline                     | Current                       |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------: | ---------------------------- | ----------------------------- |
| T01        | Pending add → reject; membership, held absence and this handle's authority                                                                                  |       8 | 8 H                          | 8 H                           |
| T02/T02a   | Pending-created lifetime → later ordinary field write → reject                                                                                              |       8 | 8 H                          | 8 H                           |
| T03        | Pending add superseded by later removal; no resurrection                                                                                                    |       8 | 8 H                          | 8 H                           |
| T04        | Pending add → remove/re-add same key; new lifetime survives old rejection                                                                                   |       8 | 8 H                          | 8 H                           |
| T05        | Pending remove → new same-key lifetime; honest occupied-destination refusal                                                                                 |       8 | 8 V                          | 8 H                           |
| T06/T06a   | Rekey + independent later held-field write; successful reversal must preserve field and identity                                                            |       8 | 8 H                          | 8 H                           |
| T06b       | Rekey + new occupant at vacated source; real dependency, no displacement/orphaning                                                                          |       8 | 8 V                          | 8 H                           |
| T07        | Rekey superseded by removal; no resurrection                                                                                                                |       8 | 8 H                          | 8 H                           |
| T08        | Rekey → remove old lifetime → re-add at destination; new occupant untouched                                                                                 |       8 | 8 H                          | 8 H                           |
| T09        | Two overlapping rekeys, both rejection orders; independent pending-add control                                                                              |      24 | 8 H / 16 V                   | 16 H / 8 V                    |
| T10        | Three pending rekeys, all six rejection orders and intermediate topology                                                                                    |      48 | 48 V                         | 8 H / 40 V                    |
| T11 / I07  | Held ref across remove/re-add; settlement on new lifetime cannot revive or retarget old ref                                                                 |       8 | 5 H / 3 V                    | 8 H                           |
| T12        | Later pending and confirmed field dependencies on pending-created lifetime                                                                                  |      16 | 8 H / 8 V                    | 16 H                          |
| T13        | Snapshot realization against pending-created lifetime, pending authority check, then required canonical read                                                |       8 | 8 U                          | 8 U                           |
| T14        | Accept/reject independent mixed scalar+add; whole state, held value, owner publication and actual pending membership; terminal disposition remains required |      16 | 16 U                         | 16 U                          |
| I01–I06    | Delimiter-bearing keys and simultaneous numeric/string keys; lookup, field rollback and unrelated field preservation                                        |       6 | 3 H / 3 V                    | 6 H                           |
| I08        | Transaction + actual field Link + EntityMap; admission, rekey, removal/reuse; explicit two-endpoint numeric/string collision control                        |       9 | 9 E                          | 9 H                           |
| **Total**  | **No whole-law conclusion**                                                                                                                                 | **207** | **80 H / 94 V / 24 U / 9 E** | **135 H / 48 V / 24 U / 0 E** |

All 48 current violations are refused operations in the successful overlapping
rekey scenarios: T09 older-first (8) and five T10 removal orders (40). They are
not counted as surgical conformance because the state may have remained safe.
Dependency cases use a different obligation: on actual refusal, check complete
unchanged state, the actual handle's retained authority, no new confirmed record
and no owner publication. A successful alternative must preserve the dependent
truth and provide native disposition evidence; missing disposition cannot pass.

Baseline I08 produces nine native errors saying Link's entity-field argument is
not an owned SignalTree location. Those are preserved execution errors, not
unsupported markers fabricated by the adapter and not silently replaced with
root Links. Baseline dependent-pending removal, refused-authority loss, dotted-key
rollback and rekey-order failures remain visible in their assertion records.

T13 cannot assert a separate server canonical projection using this candidate.
T14 records state/publication assertions but is explicitly **unsupported** for
terminal/per-contribution disposition: ordinary state correctness is not a
substitute for L9. These unsupported results are not passes.

## Verification and commands

```sh
node tools/run-semantics-supplemental.mjs baseline docs/audits/2026-09-23-semantics-structural/baseline-final.json structural
node tools/run-semantics-supplemental.mjs current docs/audits/2026-09-23-semantics-structural/current-final.json structural
NX_DAEMON=false NX_TUI=false pnpm nx test kernel --testFile=semantics-current.spec.ts --testFile=semantics-supplemental-selftest.spec.ts --skip-nx-cache
node tools/check-spec-types.mjs
pnpm exec eslint packages/kernel/src/enhancers/transactions/semantics-current-adapter.ts packages/kernel/src/enhancers/transactions/semantics-supplemental.ts packages/kernel/src/enhancers/transactions/semantics-supplemental-selftest.spec.ts packages/kernel/src/enhancers/transactions/semantics-structural-domain.ts packages/kernel/src/enhancers/transactions/semantics-structural-adapter.ts packages/kernel/src/enhancers/transactions/semantics-structural.ts tools/run-semantics-supplemental.mjs
git diff --check
```

The two evidence commands exited **1**, correctly. Choose new output filenames to
rerun; preserved paths will not be overwritten. Original report/instrument and
supplemental runner integrity tests passed **17/17**. The new integrity control
proves missing structural capability does not fall back to a scalar factory.
Final ESLint passed with no errors or warnings; whitespace checks passed. The
spec-type checker reported no new-slice diagnostics but failed on 11 concurrent
worker diagnostics, preserved in `spec-types-snapshot.txt`; no baseline or
compiler libs were changed.

Sources are stable for Main's integrated checks. No full kernel run, build,
production mutation, full mutation matrix, registry/network operation or commit
was run by this slice. No prototype or architecture document was changed.

Still outside this evidence: complete acceptance/rejection structural permutation
cross-products, all enhancer/framework compositions, canonical/revision/correlated
authority semantics, complete per-contribution dispositions, and production
mutation closure. The test-only domain is deliberately not an implementation
proposal or a new production API.
