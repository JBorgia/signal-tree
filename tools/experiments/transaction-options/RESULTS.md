# Executed architecture comparison

Source baseline: `7ade0e3ecb25ff0d06da4355b5f7d67844e147b7`.
Local Node 24.15.0, darwin/arm64. Research only; production remains unchanged.

## What is real now

Four independently implemented non-shipping models exist: prepared compensation,
sparse contribution resolution, isolated drafts, and a scalar checkpoint/replay
control. They run recorded assignment operations. They do not implement native
SignalTree callback capture, its actual framework realizations, or its real
link/batching/restoration integration.

The original batch contains 676 generated cases: 640 apply to the live profile,
59 to the draft profile, with some shared cases. Many cases are key variants and
settlement permutations; this is NOT 676 independent product workflows. The
original tests and protocol were hashed before candidate implementations and
remain unchanged. Additional attacks are a separately identified second batch.

This is NOT completion of the entire frozen SEMANTICS-2 programme. In particular,
structural authoritative ingress, actual enhancer composition, real four-framework
publication, callback reads/side effects, full production mutation proofs and
heap retention remain outstanding. No candidate is authorized for production.

## Existing source: independently reproduced controls

`current-characterization.mjs` bundles the exact committed source, without dist,
and runs 14 controls without inventing canonical state or revision handling.

**9 passed; 5 failed; zero execution errors or unsupported cases; exit 1.**

- Failed rollback loses the same handle's pending authority.
- Older rejection destroys newer pending truth in two R8 orders.
- Same-tick rollback loses a later ordinary or external write when the notifier
  has not flushed. The corresponding flushed controls pass.

The broader current adapter reports **638 unsupported, one assertion failure,
one execution error, zero passes** in the live profile. That is primarily a
contract-observability mismatch: current SignalTree does not expose separate
canonical truth or per-operation dispositions. It is not evidence of 638
independently reproduced corruptions. The remaining two results concern real
restoration timing and remain preserved.

## Executed options

### Prepared compensation: a safety option, not the full product

Implementation: `prepared.mjs`.

First frozen run: **261 passed, 332 failed, 47 unsupported, 36 profile mismatches,
zero execution errors; exit 1**. The 332 failures are refusals where successful
settlement was required. They are not relabelled as passes.

Supplemental R6 controls in both scalar/structural effect orders show unchanged
state, dispositions and authority on refusal, followed by a successful retry
after removing the conflict. Older overlapping acceptance and rejection refuse
unchanged. This prototype therefore demonstrates a conservative safe behavior;
it does not yet prove that behavior can be integrated into shipped v15.

It retains only active before-images and caller-held terminal summaries. Scalar
50k controls and terminal entity churn remain bounded in model counters.

**Good:** direct live values; prepared all-or-nothing installation; credible
containment strategy; no global terminal transaction registry.

**Cost:** overlap refusal is disruptive and can also block confirmation. The
model copies snapshots and scans active work. Authority ingress, undo, deferral
and some dependent canonical topology are unsupported. It cannot be described
as a complete implementation of the proposed review product.

### Sparse contributions: strongest shared-live-state candidate, still incomplete

Implementation: `frontier.mjs`.

Initial run reported **640/640 applicable model cases passing**. Subsequent work
showed why that was not sufficient:

1. Canonical views for dependent structural support had no specified resolution.
   The implementation was changed to report those views unsupported instead of
   returning an arbitrary answer. This reduces credited passes.
2. A newer correlated acknowledgement exposed an older pending value. The server
   payload changed the canonical value but did not retain the accepted owner's
   authored precedence. This reproduced with full and partial payloads.
3. A subscriber exception during deferred publication left an already-installed
   write queued. Another flush executed it again and duplicated undo history.
4. Entity add/remove churn retained payload cells for dead lifetimes.

The bounded revision preserves authored precedence at acknowledged locations,
consumes queued work at installation rather than delivery success, and removes
unneeded retired payload cells. It does **not** hide the remaining retired-label
registry: that still grows with entity churn and remains a red retention result.

Final source SHA-256:
`d02433285ca8360224298babf92fd02946b2e684afad3649107b0376bb58c380`.
Independent main-loop reruns confirm:

| Batch | Pass | Fail | Unsupported | Other profile |
|---|---:|---:|---:|---:|
| Frozen live | 614 | 0 | 26 | 36 |
| Frozen draft (author run) | 59 | 0 | 0 | 617 |
| Six added falsifiers | 5 | 1 | 0 | 0 |
| Nine independent attacks | 6 | 1 | 2 | 0 |

There are zero execution errors. Strict live/extension/attack runs exit 1; this
is not green-by-explanation. At 1,000 add/remove cycles, model records grow from
7 to 1,007: payloads are reclaimed, but consumed string identity labels remain.
This model still fails its retention test, but that is not evidence that sparse
contributions inherently require a retired-label registry. The protocol lets
callers choose lifetime labels, creating a reuse-validation obligation. Production
already has `StructuralStore.allocateFreshSubjectId()` with monotonic allocation
within a collection incarnation, plus `forgetSubject()` for eligible zero-owner
retirement. Reusing that existing mechanism in the model/integration is untested;
the allocator itself is not hypothetical. Cross-collection and incarnation
identity must remain distinct (`clear()` resets the counter and advances the
incarnation). This result must not be conflated with production turn-history
retention.

Independent final source review confirms that the retained labels also include
rejected additions, not only previously committed entities that were removed.
That review found the acknowledgement fix preserves per-location precedence and
the queue fix distinguishes installation from subscriber delivery; it does not
close the remaining retention or unsupported-composition obligations.

The model distinguishes committed values, pending patches, local precedence,
authority revision and explicit settlement relations. Scalar old-pending/newer-
accepted churn remains bounded: the first model held eight cell/patch records
against seven at baseline after 1,000 newer accepted writes. These are model
record counts, not bytes, and not directly comparable to other models' counters.

**Good:** successful overlapping scalar settlement; same-field supersession;
targeted structural refusal; independent field/rekey behavior; explicit authority
relationships; no need yet demonstrated for a general dependency graph.

**Cost:** retirement/identity integration remains incomplete; structural authority,
structural undo/deferral, dependent canonical support and observer reentrancy are
unsupported. Actual native realization has not been integrated. The draft mode
of this same model also exists, but passing a small draft profile does not prove
that supporting both modes is a justified product choice.

### Isolated draft: a working alternative with deliberately conservative merge

Implementation: `draft.mjs`.

Draft profile: **55 passed, zero failures/errors, four unsupported, 617 profile
mismatches; exit 1**. Diagnostics-on produces the same result. A supplemental
input-aliasing defect was corrected with isolated entity field containers; the
first source/results remain preserved.

Unapproved values remain in a private snapshot. Rejection discards it without
publishing live changes. Disjoint changes merge; an intervening write to a draft
dependency makes acceptance refuse. Equal-value and ABA changes still count as
conflicts. The caller can reject and author a revised draft.

The executed review scenario is concrete:

1. Agent drafts priority=3 and assignee=Ada; normal application state is unchanged.
2. Human changes the live assignee to Grace.
3. Accepting the original draft refuses without changing live state.
4. Discarding succeeds; a revised priority-only draft commits and preserves Grace.

Both 50k scalar settlement controls and terminal entity churn stay bounded in
model counters. Each pending draft nevertheless retains a full private store;
operation counts do not measure that snapshot's byte cost.

**Good:** no compensating rejection; clear unapproved/live boundary; lifetime-safe
structural merge checks; useful review behavior already executable.

**Cost:** review must read a different view. Conflict resolution asks more of the
user. Full snapshots and conflict scans carry costs. Undo, deferred writes and
explicit authority settlement relations are unsupported. This is a changed
product contract, not a transparent v15 patch.

### Scalar checkpoint/replay: useful reference, poor current scaling

Implementation: `replay.mjs`.

First run: **109 passed, zero failures/errors, 531 unsupported, 36 profile
mismatches; exit 1**. Structural operations explicitly do not exist.

Extended attacks find three failures: deferred authorship is ordered at flush
rather than enqueue; newer correlated acknowledgement can resurrect older
pending truth; and one old pending writer retains every accepted successor.
At 1,000 successors the journal retains 1,001 operations; it releases them after
the old writer settles. No heap or production latency claim follows.

**Good:** small independent oracle/control; proves that scalar behavior does not
require a general graph; callback replay is deliberately avoided.

**Cost:** full resolution scans a growing journal; terminal compaction is too
coarse; no structural support. This version is not a recommended production path.

## Mutation evidence: deliberately not 30/30

The runner's own assertions prove constructor failure, assertion failure, cleanup
failure and unsupported capabilities cannot silently produce a strict pass.

Semantic fault wrappers were also executed. Independent review found collateral
kills in the first wrapper run: normal accepted handles were mislabeled rejected
even when the intended refusal mutation never activated. Those kills were
withdrawn, the bug corrected, and the first output retained.

Further review establishes that generic counts still cannot be advertised as
thirty independent proofs. Some mutation IDs share an implementation; M18 changes
an observer payload rather than physically publishing partial state; M25 initially
duplicates M08 rather than proving execution-time context capture; M22 changes
instrumentation rather than retaining real heap objects. E01 and E02 separately
kill path flattening and retired-reference retargeting on passing controls.

These tests are useful evidence of assertion sensitivity. **They are not complete
production-source mutation proof, and no candidate has earned that claim.**

## What the experiments support choosing

| Need | Real option | Main price |
|---|---|---|
| Make existing optimistic transactions safe conservatively | Prepared compensation/refusal | Fewer successful overlapping workflows; integration still needed |
| Normal app references must display concurrent proposed work | Sparse contribution resolution | More authority/identity machinery; retirement and integration obligations |
| Review unapproved work without exposing it to normal consumers | Isolated drafts | Separate review view and explicit merge/conflict UX |
| Avoid owning review at all | Keep SignalTree focused on state | Application owns proposals and conflict work; removal of shipped features requires compatibility decision |

Null is a product control, not an additional prototype with fabricated transaction
passes. TanStack/CRDT adoption was not benchmarked here. The experiments do not yet
justify replacing the entire kernel, adding a general dependency graph, or
promoting a prototype to a release architecture.

The useful next implementation decision is product visibility: shared optimistic
truth versus isolated review. The concrete behavior and costs now exist to inform
that decision; there is no need to select from architectural slogans.

## Evidence and reproduction

`evidence/manifest.json` records the source baseline, runtime, final research source
hashes and preserved report hashes. First reports, failures, pre-revision source
and final results remain separate. First-source snapshots were copied after the
first run; the frontier author verified their hash against its recorded source
hash. They must not be described as a pre-execution archive.

Examples from the repository root:

```sh
node tools/experiments/transaction-options/runner-selftest.mjs
node tools/experiments/transaction-options/current-characterization.mjs /tmp/current-controls.json
node tools/experiments/transaction-options/runner.mjs tools/experiments/transaction-options/frontier.mjs --out=/tmp/live.json
node tools/experiments/transaction-options/runner.mjs tools/experiments/transaction-options/draft.mjs --profile=draft --out=/tmp/draft.json
node tools/experiments/transaction-options/extensions.mjs tools/experiments/transaction-options/frontier.mjs live /tmp/extensions.json
node tools/experiments/transaction-options/frontier-attacks.mjs --out=/tmp/attacks.json
```

The tests currently choose structural dependency refusal as one candidate policy,
even where L8 permits honest preservation. They also impose synchronous model
observation and suppress unchanged notifications. These policies must not be
mistaken for every legal implementation of the broader laws. Structural callback-
time coherence and equivalent object insertion orders need stronger harness
coverage before claiming an architecture-neutral production gate.
