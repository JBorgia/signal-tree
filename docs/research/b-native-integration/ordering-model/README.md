# Executable ordering model — rejected

Baseline: `1d5f8934cb07a5a8824ab9d5ccac3ebf620038f5`.
October 17, 2026. This is a standalone JavaScript model in the research directory.
No kernel, framework, public API, production test or activation change is made.
It does not justify replacing B's ordering representation. B remains rejected.

## Expected outcomes came first

EXPECTED.md was written before implementation, refined after source review, and
sealed before the first model execution. Its SHA256 remains
`7aa83bb9c45b30d7e0cf9bcc00f79162b6cc65a895a2d657c8de1f19819836a9`.
The model did not select expected values from its outputs. The independent review
probes were stated before their execution; they supplement the expectation table.

Moved-anchor refusal is a source-supported conservative policy:
`internals/causal-runtime/target-transition.ts:865` rejects contradictory surviving
anchors. Lower-level StructuralStore successor preference is a different boundary.
No new public transaction replay of this ambiguity was run. Successful rebasing
using authored intent remains an unresolved alternative, not a chosen contract.
The compatible-anchor retry expectation A,B,C follows that same inverse-anchor
policy. Its failure is a mismatch within the model's declared policy, not proof
that every possible ordering contract requires that particular result.

The pure-order experiment explicitly uses whole-fact supersession by newer
confirmed exact order. Partial front/append does not globally supersede older
order. This is an experimental rule, not final production acceptance. Payload
fields are absent; the seventh kernel audit assertion remains separately unresolved.

## Representation and executed results

Local linked-list edits capture inverse placement without a whole-order admission
snapshot. Each admission appends one journal event when obligations exist.
Exact operations may capture the full prior order. Settlement clones state and
journal, rewinds inverses, then replays surviving semantic events. Superseded
ordering events may retain recovery inverses while being excluded from semantic
dependency enumeration. Installation follows model preparation; there is no
framework observer, callback, Link or native kernel integration in this model.

Worker first run: **12 ordinary passes / 2 ordinary failures**. No model repair
followed. Tests later added confirmation cost observations without changing the
failing assertions. Independent review first run: **0 passes / 3 failures**;
one additional fixed-size work control gives **1 pass / 3 failures**.
Root final combined execution: **13 passes / 5 failures / 0 skips**. Two failing
assertions independently cover the same membership defect; this is four distinct
findings, not five independent mechanisms. No expected-failure markers were used.

| Requirement | Observed result | Limit |
| --- | --- | --- |
| Pending exact hiding | Reject newer reveals older; reject older restores original | Finite three-lifetime case |
| Newer exact confirmation | Both later rejection and later confirmation of older owner preserve newer order | Whole-fact experimental supersession rule |
| Dependency release | Old owner remains pending but its dependencies disappear; confirmed C dependency remains and creator rejection refuses | Does not validate every partial supersession relation |
| Recovery-only facts | Retained inverse exists before rejection, is absent from semantic dependencies, and does not overwrite surviving order | Final model state only; no reactive publication test |
| Useful dependency settlement | Reject dependent then creator succeeds; held old identity stays detached from new lifetime | No payload contract tested |
| Stale-order analogue | Modeled pending rekey, confirmed order, replacement B,A, rekey rejection preserves B,A | Supplementary model test; unchanged kernel falsifier still belongs to rejected runtime |
| Removed anchors within one operation | Restores original surviving order while removing created anchors | Does not establish general anchor rebasing |
| Moved inverse anchor | First refusal is atomic; compatible-anchor retry produces A,C,B instead of predeclared A,B,C | Central policy/representation mismatch |
| Pure exact membership | Accepts omitted lifetime instead of rejecting atomically | Two tests fail at missing exception; later state assertions not reached |
| Replaced/missing anchors | Does not refuse when historical anchors are gone and a new same-key lifetime exists | Later state/authority assertions not reached |
| No-obligation churn | After eight create/remove cycles, pending and recovery counts are zero but eight inactive nodes remain | Held-reference assertions after failed count were not reached |
| Preparation failure | Early injected refusal preserves state/dependencies and useful retry | Injection precedes substantive preparation; late atomic failure untested |

## The central counterexample

From A,B,C:

1. Pending removal of B captures historical neighbors A/C.
2. Independent front(C) yields C,A.
3. Reject removal: model refuses contradictory anchors and retains authority.
4. Independent front(A) yields A,C, making those anchors compatible.
5. Retry rejection: chronological replay of front(C), then front(A), yields A,C,B.

The declared inverse-anchor policy expected A,B,C at step 5. The model validates
using one interpretation, then constructs the result using another. Choosing its
actual A,C,B result as the new expected answer would silently decide the open
rebasing question. No such change or extra repair was made.

## Admission work, settlement cost and retention

The unchanged incumbent experiment counter was rerun: Map-constructor input
entries remain **8,256 / 32,896 / 131,328** for N=128/256/512, exactly N(N+1)/2.
Its script and kernel terminal-order assertion remain byte-for-byte unchanged.
It measures a different unit from model ticks; do not compute speedup ratios.

Model instrumentation counts selected explicit visits. For N=64/128/256:

| Operation | Admission ticks | Confirmation ticks | Replayed events |
| --- | --- | --- | --- |
| Append | 320 / 640 / 1280 | 1027 / 2051 / 4099 | 64 / 128 / 256 |
| Prepend | 320 / 640 / 1280 | 1027 / 2051 / 4099 | 64 / 128 / 256 |
| Repeated front | 512 / 1024 / 2048 | 1219 / 2435 / 4867 | 64 / 128 / 256 |

One append/prepend among 64, 1024 or 4096 untouched subjects reports five admission
ticks and zero admission snapshots in all six cases; complete endpoint order is
checked afterward, outside that measurement. Source inspection confirms local
point admission has no accumulated dependency-map copying or collection scan.
Dependencies are enumerated on demand from live journal events, not stored as
copied growing maps. That query cost is separate and is not constant-time.

These counters are **not exhaustive operation counts**. Exact projection uses
`before.includes` inside a loop, introducing uncounted quadratic comparisons;
settlement array filtering and some predicates also perform work beyond ticks.
No claim of bounded total exact-operation work follows from the table. Repeated
front operations even include no-op visible moves, so this is admission-shape
evidence, not a matched production workload or performance result.

Settlement clones every retained node/key map and rewinds/replays the journal;
it is not sparse settlement. The measured transaction retains N events before
settlement and drains afterward in successful controls, while ordinary churn
exposes independent inactive-node retention. No CPU/heap/bundle comparison was
made. Existing B production costs remain open.

## Review and disposition

Independent premise review located the public-target versus storage-primitive
anchor distinction. Independent model review tested membership, anchor lifetime,
reclamation and fixed-one-operation admission. It verified that dependency release
is nonvacuous: old owner still pending, old dependency entries absent, new confirmed
requirement present, creator rejection refused. Root independently ran both test
files and checked the cited source and unchanged-falsifier hashes.

Reject this model without production repair. It establishes useful finite lifecycle
behavior and avoids the prior point-admission prefix-copy pattern, but does not
provide one coherent anchor resolution policy, pure-order validation, complete
reclamation or sparse settlement. It neither falsifies all local-placement
representations nor warrants kernel integration. The next decision, if reopened,
is the specific anchor interpretation; there is no new general architecture or
runtime repair selected here.

No kernel/framework suites, typecheck, lint, build or production performance
campaign was run. Node's built-in test runner is used for this isolated JS model;
package test routing through Nx is unchanged. No v15 change, push, merge, tag,
publication, budget change or default activation.

## Replay

With Node 24.15.0, from the repository root:

```sh
node --test docs/research/b-native-integration/ordering-model/model.test.mjs docs/research/b-native-integration/ordering-model/review.test.mjs
node docs/research/b-native-integration/operation-admission/count-admission.mjs
```

The first command intentionally exits 1 with the preserved failures. The second
prints the unchanged quadratic-admission witness. See EVIDENCE.md for local raw
logs, source seals and first-failure archive.
