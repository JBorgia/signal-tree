# Publication evidence-scope successor: rejected

Frozen candidate `2dacae7b9e9137018d05c4e00382ac9287bc76d4` is rejected for
integration. The native updater input map loses a pending omission dependency,
and declared publication sends before that dependency settles. This is a covered
recurrence, not an unimplemented entity writer or an enrollment oracle conflict.
The root independently reproduced the review counterexample. No further runtime
repair followed. Production remains `87f6831fa60cafe87508f0ace84b7638698ca3b0`;
conservative Link, public API status, ceilings and B closure remain unchanged.

## Identities and scope

| Role | Exact identity |
| --- | --- |
| Frozen runtime predecessor | `2d71d73305fea23173b3b681c2a897ef1a7dffba` |
| Test-only design / implementation base | `8212736242e1f85f7e3288dbb0ebda99a575e3b2` |
| Rejected successor | `2dacae7b9e9137018d05c4e00382ac9287bc76d4` |
| Readiness archive parent | `d10687bdb1f3fbd32f20e5cf0423928e7a8a821a` |

The isolated branch is codex/link-evidence-scope-successor at
`/private/tmp/link-evidence-scope-successor`. Its four runtime files and six new
specs are the entire change from the test-only base. No runtime from this branch
is integrated in the readiness checkout. The incremental bundle includes the
test-only base and successor and requires the preserved runtime predecessor.

The [prior reviewed design](../link-evidence-scope-design/README.md) remains the
basis: source requirements, shared execution validation and recipient coverage
are distinct. This attempt places native requirements in the existing installation
record, captures updater inputs before callbacks, and keeps recipient uncertainty
local. [Implementation mapping](IMPLEMENTATION.md) identifies the touched paths.
It improves the bounded controls below, but does not completely implement that
input contract.

## Decisive counterexample

The unchanged isolated fixture performs these ordinary API operations:

1. Create pending owner p and a separate source `{pair:{x:7,y:0}}`.
2. Under dependent(p), replace pair with `{y:0}`, creating a pending absence of x.
3. Independently write y=1, removing its incidental dependency on p; dispose the
   source connection. The absent-x fact still requires p.
4. A target connection declares independence and invokes the native pair updater.
   Its callback writes `hasOwnProperty(input,'x') ? 1 : 0` to the target.

Actual: target0, endpoint `[0]`, receipt started/declared, no contradiction, p still
pending. Required: contradiction and no early publication. The truthful
explicit-dependent(p) control holds and then publishes0 after confirmation.

The source still records the omission requirement. The loss is in nativeInputs:
`Object.keys(storage)` skips a deliberately nonenumerable dormant child. The
updater can observe that child's absence even though it cannot enumerate its
retained storage. The visible payload domain does not cover all membership facts
supplied by that input. This is not the documented misuse where applications omit
unobserved hidden inputs. [Independent review](RUNTIME-REVIEW.md) and
[root verification](ROOT-VERIFICATION.md) trace the same boundary.

The reviewer's first, less discriminating omission fixture passed2/2 because y
still incidentally carried p. Its original fixture/result are preserved alongside
the isolated1-pass/1-fail result. This distinction prevents a vacuous coverage
claim from the simpler pass.

## Separate composition findings

- Default cross-tree pending getter copy: successor sends7 before confirmation.
  Fresh exact predecessor testing holds before confirmation but fails to send
  afterward. Thus the successor regresses the first safety assertion; the whole
  predecessor test was not green. Both raw results are preserved, including which
  later assertions were not reached.
- Three private membership fault controls fail at duplicate registration after
  native preparation becomes permanently registered. Their later fault, payload
  and recovery assertions were not executed.
- Mixed undo still publishes11 instead of callback-authored777. This is a
  previously preserved selected-delivery failure, not newly caused by this patch.

[Boundary trace and finite alternatives](BOUNDARY-TRACE.md) separate missing
observable omission input from the unobserved raw getter-copy boundary. Comparing
values cannot reconstruct causality. A conservative unknown-origin policy,
additional scoped read provenance, or a public scope restriction require their
own explicit contract disposition; this result authorizes none of them. In
particular, an entity-only guard or another recipient exception would not close
this successor's recurrence.

## Execution ledger

Counts below are per run and overlap; they must not be summed into unique tests.
All raw logs, prewritten fixtures and before/after source snapshots are preserved
in raw-evidence.tar.gz. Exact commands and versions are in [replay](REPLAY.md).

| Run / source | Result | Interpretation |
| --- | --- | --- |
| New native18, initial fixture on base | 0 pass / 18 fail | Invalid unchanged-inspection-status assertion; original source/red preserved |
| Corrected new controls, base821 | 9 pass / 29 fail | Native18 + scope4 + corrected enrollment16, before successor |
| Successor FIRST | 81 pass / 8 fail | Six original passive oracles, historical wider-input oracle, actual disposal-query regression |
| Successor SECOND | 111 pass / 12 fail | Six original passive oracles, four older passive oracles, wider-input oracle, known-input contradiction instead of old unknown expectation |
| New focused controls within SECOND | 42/42 pass | Native18, authorized enrollment16, scope4 and membership4; bounded evidence only |
| Composition, frozen runtime | 106 pass / 5 fail | Cross-tree early send, three hook collisions, preserved mixed undo |
| Independent simple omission control | 2/2 pass | Incidental sibling support masks missing absence input |
| Independent isolated omission | 1 pass / 1 fail | Truthful dependency useful; independence wrongly publishes |
| Root final falsifier replay | 10 pass / 2 fail | Same omission and early cross-tree send reproduced |
| Fresh predecessor default control | 9 pass / 1 fail | No premature send, but post-confirmation progress fails |
| Final source types | Exit0 | Earlier undefined-type diagnostic retained separately |
| Final spec-types | Existing ratchet passes | Baseline unchanged; not zero global diagnostics |

The four preserved scalar membership failures now pass in the exercised original
aggregate controls. That is separate from the four new membership controls. No
old test assertions were edited in the successor.

FIRST and SECOND differ: disposal-query semantics and cold membership enrollment
were corrected after their evidence. A later non-null type assertion changes
private.ts's source hash without changing emitted behavior. Composition, independent
review and root final replay use the final four runtime hashes. FINAL-BEFORE and
FINAL-AFTER match714 measured files; the frozen commit was verified against all714.
Earlier run hashes remain in their own snapshot directories and are not replaced.

## Oracle accounting and owner authority

The owner authorized one enrollment16 correction: passive live recipients may
use legitimate ordinary tree-local fallback but cannot borrow another connection's
declared grant. The corrected copy preserves every c1 useful-send/declared-basis
assertion and checks c2 sends have surviving basis. Original16 remains unchanged
and its six failures remain in FIRST/SECOND. The older four passive assertions
are also left unchanged. This does not waive actual foreign dependencies.

The historical sixth wider-input expectation was separately adjudicated in the
prior design. Unknown prevents a declared grant, not every legitimate ordinary
fallback. The original no-send assertion and red remain archived. A native updater
that actually receives pending input now produces after-callback contradiction;
its older unknown-receipt expectation is inconsistent with the approved known-input
lower bound. [Independent oracle review](NATIVE-ORACLE-REVIEW.md) and
[runtime review](RUNTIME-REVIEW.md) provide the contract basis. Neither result is
counted as a newly passing original test.

The new native18's first equality assertion wrongly required inspect status to
remain current after ordinary replacement superseded its pending field. Its
corrected fixture checks the established current-to-superseded transition while
preserving paths, cardinality and eligibility assertions. Both exact fixtures and
first reds remain in the raw archive.

## Review, limitations and disposition

Independent source/interpretation review examined native inputs and fallback;
independent runtime review added and executed the omission discriminator without
reading the other new review verdict. Root checked source and replayed the decisive
controls. [Root addendum](ROOT-VERIFICATION.md) corrects any earlier implication
that the whole default-copy control passed on the exact predecessor. Reviews are
preserved verbatim with that later evidence explicitly controlling attribution.

The recurrence stop remains active. Enrollment/source-owned preparation results
remain useful bounded evidence; no test count overrides the absence-input failure.
Any successor needs a complete native membership-observation mapping and an explicit
resolution of unobserved-origin fallback, not another output or connection guard.
No mechanism or API expansion is selected here.

No full kernel/framework qualification, lint, installed-artifact check, fresh
bundle/demo build, budgets, timing or heap/collectibility campaign was run. Native
facts now exist without recipients; the passed12-cycle metadata control does not
qualify cold-writer allocation or live/dormant retention. No cost improvement or
neutrality is inferred. Production and all release gates remain unchanged.

Only evidence/controller documentation is archived in the readiness branch.
Unrelated AGENTS.md and measurement-contract edits are preserved. Local conceptual
commits preserve rejected evidence; no activation, push, merge, tag or publication
was performed.
