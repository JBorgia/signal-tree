# B finite integration qualification: rejected

Qualification starts from `f4d6a7ac30e7aa3c6352627133a702406486c84c` on
`codex/native-ownership-slice`; comparison baseline is exact
`8d220643e0d4e34cbdbc6e55e6ef692b25d5e023`. The final local checkpoint is the
commit containing this record. Source and emitted-artifact hashes identify
what ran. No default activation, public API, ceiling, v15, push, merge, tag or
publication change is accepted.

B's useful overlap and sparse pending-ownership results survive their bounded
controls. This qualification rejects adoption of the current implementation:
unchanged public tests expose state/identity, inspection-participation,
publication and observation gaps. Full-suite failures are not all independent
defects. No hundreds-of-tests repair cycle was attempted.

## Decisive ordinary public counterexample

1. Start with row `{id:'A',n:1}` and scalar `x=0`.
2. Pending transaction writes x=1 and rekeys A to A2.
3. An independent ordinary write updates A2.n to3.
4. Rollback returns success and restores x=0.
5. B reports ids `['A2']`, but the row is `{id:'A',n:3}`.

The incumbent restores key A with n3. B captured membership/key truth again
while processing a nonstructural field update, so the key and separately owned
id field settle to different authored facts. This is neither safe refusal nor
an internal inspection fixture mismatch. A four-case minimal replay has two
incumbent passes and two B failures. The other case adds x,y then removes c
from z,a,c; rollback refuses because c's recorded successor is itself removed
by that settlement. Original source/log remain archived and the minimal source
is copied unchanged under counterexamples/.

Independent replay also proves inspection-only callback n42 is rolled back to0,
and later inspection can preserve a speculative row that rejection should remove.
Current admission uses active transaction identity without sufficiently honoring
inspection participation. Unchanged hidden-collection tests observe row delivery
while their collection is absent. Public inspection also conflates display path
(which includes business keys) with address (which does not). R2's address finding
was valid, but its broader inspection-correctness inference was incomplete.

## Remaining boundary qualification

Link supported controls:18 pass; with14 existing Link controls,32 ordinary pass.
They cover outbound confirmation/rejection, overlap, in-flight acknowledgment,
callback-authored transactions, ordered entity output, explicit disposal,
refusal/retry, failed-abort recovery and inbound truth. B successfully rejects an
older contribution after inbound9; incumbent preserves9 but refuses rejection
and must confirm. That is separately recorded capability evidence.

Two tree-only destruction counterexamples remain ordinary red tests for both
incumbent and B: a pending transaction followed by tree destruction leaves a
Link settlement waiter unresolved after24 microtasks. Existing contracts leave
relationship auto-disposal undecided; explicit connection.dispose passes but
does not erase this narrower unsettled-waiter result. No automatic-disposal
semantic change was introduced.

Dynamic collection acquisition is **unfulfilled**, not silently passed. Inserting
entityMap() into an ordinary dynamic member yields an accessor, not an EntityMap;
the same premise fails exact8d. The marker is a construction/state-definition
facility. Hydration requires an already registered marker node, and root shape
updates discard unknown properties. B discovers collections once; that is a
latent registration limitation, but the attempted input fails before ownership.
No new construction API was invented. Three distinct controls for hydration of
existing collections while pending pass, including preparation refusal/retry,
callback reentry and destruction. They do not stand in for dynamic acquisition.

AUTHORITY.md inventories scalar, presence, entity, restoration, point realization,
Link and settlement routes. B selection returns before incumbent runtime
construction; direct/barrel canaries prove B controls exist and incumbent runtime
is absent. No automatic compensation fallback was found. This is a claim about
the selected route, not that arbitrary direct internal calls cannot instantiate
another runtime. No permanent canonical mirror was added. It does not prove that
all writes receive the correct ownership classification; the failures above
falsify that stronger claim.

## Full verdicts, unchanged assertions

The qualification-only Vitest mock wraps actual transactions(), preserving its
metadata and other module exports. It selects B by enhancer identity. Production
defaults remain unchanged. Default runs therefore test shared-substrate regressions;
selected runs test B. Runtime claims use explicit canaries rather than assuming
the wrapper worked.

| Kernel run | Ordinary pass | Ordinary fail | Expected failures satisfied | Expected-failure tests now succeed | Skip |
| --- | ---: | ---: | ---: | ---: | ---: |
| Exact8d tracked tests | 5745 | 0 | 12 | 0 | 12 |
| Exact8d including preserved temporary research overlays | 5751 | 8 | 12 | 0 | 12 |
| Candidate default authority | 5866 | 6 | 12 | 0 | 12 |
| Candidate B-selected | 5520 | 352 | 10 | 2 | 12 |

Vitest reports354 B failures because two unchanged it.fails provenance tests now
succeed. Those two are desired-behavior gains, not new runtime defects. Exact8d's
eight extra failures are untracked preserved research overlays (primitive,
ordering, overlap/churn and dynamic construction); they are not tracked baseline
regressions. Every overlay identity is retained in raw output and the ledger.

The default six failures are the two unchanged primitive probes, two new Link
counterexamples, and two actual native-substrate regressions versus exact8d:
interceptor-authored collection reentry is rejected; prepend no longer emits the
required reorder descriptor. Both substrate changes already existed in f4d6a7ac;
today's qualification did not introduce them. Baseline targeted controls103 pass.

| Framework | Baseline ordinary pass | Candidate default ordinary pass | B ordinary pass | B fail | Skip |
| --- | ---: | ---: | ---: | ---: | ---: |
| Angular | 237 | 242 | 239 | 3 | 3 |
| React | 74 | 79 | 79 | 0 | 0 |
| Vue | 172 | 177 | 174 | 3 | 0 |
| Solid | 104 | 109 | 106 | 3 | 0 |

Default framework totals607pass/3skip include20 B-explicit controls. B-selected
framework totals598pass/9fail/3skip: Angular exposes missing history observation
and two changed refusal expectations; Vue lacks configured tooling/history
readers; Solid's three fault probes cannot obtain their incumbent-specific test
capability, so those observations did not execute. These are distinct categories.
An initial B Angular command omitted the existing required GC flag and produced
22 extra harness failures; the corrected run matches NODE_OPTIONS=--expose-gc.
React's first qualification config failed CJS/ESM plugin loading before tests;
its .mts correction executes79 tests. Neither startup error is a runtime verdict.

The ledger records all348 default-to-B kernel verdict changes:53 directly
incumbent-runtime-coupled fixtures;37 changed refusal verdicts needing case-level
interpretation;12 missing observation capabilities;6 hidden-collection delivery
mismatches;2 inspection-participation cases;2 large-preparation failures;2 expected
failure tests now succeeding;1 globally selected comparator mismatch;233 other
assertion differences with exact expected/actual and error stacks. Several of
those233 have independently reproduced causal members above, but the whole group
is not assigned one cause. This is exhaustive verdict accounting, not a claim
that every causal defect is diagnosed. The selected harness necessarily changes
the new Link test's nominal incumbent comparator too; its one comparison failure
is separately identified, not counted as B data loss.

Unchanged model41 semantic,14 adversarial and destruction controls still pass.
Their success does not override these native integration counterexamples.

## Static checks and warning accounting

Source typecheck passes. Spec-types passes its unchanged ratchet with six existing
diagnostics; this is not clean spec compilation. Five-package lint passes with
zero errors and23 warnings. The previous three-warning figure was kernel-only;
eight Angular typing warnings also existed. R2 added27 warnings (15 runtime,
12 framework assertions), producing38. Qualification replaces12 test assertions
with explicit authority/recovery checks and three runtime assertions with
preinstallation address validation/safe locals. Remaining23 are11 prior warnings
plus12 R2 physical-preparation assertions:3 target key/order lookups and9 delta
value/epoch/publication assertions. They remain visible, unwaived and unaccepted
in this rejected candidate; no lint rule was disabled or threshold changed.

## Cost decision input

See COST.md. Fresh package builds succeed. Both candidate package budgets fail;
candidate demo generation reaches572.69kB then fails the unchanged570kB error
ceiling. Baseline563.16kB passes the error ceiling but already exceeds its525kB
warning limit. These failures are preserved without raising ceilings.

Two separate campaigns each pass ninety isolated checked timing/heap samples,
including A/A controls. Final ratios include the stated end-of-batch capture drain;
the campaigns are not pooled. Results
favor B's tested settlement cycles but penalize churn and construction. They are
matched **successful-subset** results, not proof of production equivalence. B's
ordinary overlap succeeds where the incumbent refuses; no throughput ratio is
computed for unequal outcomes. Artifact hashes cover emitted dependencies, not
merely index wrappers.

## Closure

The finite qualification is complete as a rejection with preserved counterexamples
and cost evidence. No further runtime repair or new authority design is selected.
The existing R2 checkpoint remains separately identifiable. Acceptance would need
to address the demonstrated semantic gaps and shared-substrate regressions, not
reinterpret the increasing focused pass count as complete replacement proof.
Exact replay commands, source seals, per-test verdicts, first failures, measurement
samples and independent reviews accompany this record. No release sign-off.
