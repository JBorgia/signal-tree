# Moved-anchor adjudication — owner semantics remain unresolved

Baseline: `9f4135fa72d0dbf4849511c6da0ec79456e3f615`.
October 17, 2026. B, incumbent checkpoints and the rejected model are preserved.
No runtime/model repair, expectation change or integration is made.

## Decision reached

The model's `A,B,C` retry expectation is an explicit experimental policy, **not
an unambiguously derived frozen public outcome**. Preserve the assertion and its
red result. Classify `A,C,B` as failure of that declared policy; it is not yet a
proved violation of the frozen ordering contract. This corrects the earlier
inference that the contradictory-anchor compiler branch established mandatory
public refusal for this singleton sequence.

Independent premise review and a narrow public diagnostic agree on the limitation.
Current public behavior is a third relevant observation: both incumbent and B
succeed on the first rollback with B,C,A. That does not settle which behavior the
owner wants v16 to promise, nor validate the model's hypothetical retry.

## Exact sequence and origin of the expectation

The model test starts with existing lifetimes A,B,C, not creator-owned payload.
Pending removal of B retains historical predecessor A and successor C.
Committed front(C) yields C,A. The model refuses rejection because the surviving
historical anchors are reversed. Committed front(A) then yields A,C. The model's
prewritten policy expects retry to insert B into that now-compatible bracket,
yielding A,B,C. Instead, it produces A,C,B.

EXPECTED.md originally marked the outcome unresolved. Its pre-execution
refinement selected conservative bracket refusal and compatible-bracket retry,
citing `target-transition.ts:865`. That refinement expressly called itself an
experimental policy. It was written before execution, and has not been weakened
or replaced. Its source seal remains recorded in the model evidence archive.

The inference was incomplete because it read a placement function without proving
that the public transaction would invoke that function for this shape.

## Frozen premises and their limits

`docs/research/transaction-semantics-2/LAWS.md` is the authoritative law file;
its latest source revision is `de432a1f7e4e7edcbb819694f7bf4e1fff66a659`:

> **L3 — reject removes a contribution; it does not restore an old value.**

> **L4 — later surviving truth is inviolate.**

> A contribution takes precedence by when it was AUTHORED. Settlement changes
> its status, not its causal order.

L7 separates lifetime from business key; L8 forbids erasing dependent truth;
L9 requires a defined disposition for every contribution. Those requirements
remain binding. None specifies whether a front placement authored while B is
absent also governs its relation to B when B is restored.

`docs/architecture/entity-physical-density.md:833`, introduced at `bceb51dca`, says:

> Frozen law: a designated authored transition that changes observable collection
> order retains positional causal information sufficient to reverse and reapply
> that order while preserving SubjectId identity.

This requires sufficient positional information; it does not define the disputed
relation. The hierarchy document's “anchors either compensate correctly **or
detect that they cannot**” is a disposable-prototype outcome space. The related
history-current-state-gap.md explicitly says “It is not a decision.” Neither
can be promoted into a unique frozen answer to this operation sequence.

## Public route check and execution

At this baseline, `requiresDeclarativeStructuralTarget` in
`packages/kernel/src/lib/internals/causal-runtime/target-transition.ts:230–304`
leaves a singleton addition with surviving anchors on the physical path:

> Surviving anchors retain the existing physical placement behavior.

Transactions select the complete-target path for order deltas or that predicate
(`transactions.ts:2691`). A rejected singleton removal need not have a positional
delta just because later independent operations reorder other rows.
`StructuralStore.resolveRestorePlacement` uses successor preference when the two
historical anchors are reversed; its existing test pins that primitive behavior.
The contradictory-anchor branch at target-transition.ts:865 is therefore a
conditional planner rule, not a universal public transaction refusal rule.

History confirms the qualification: `f2f34753d0e80234ce45e7f1a9fb3a484d957061`
introduced conditional routing for structural key handoffs/permutations. Later
`5fcac0dd` classified target-preparation order failures as typed restoration
refusals, explicitly leaving transaction rollback messages unchanged. Neither
establishes unconditional routing of this singleton through the compiler.

Root executed public-sequence.spec.ts through Nx on the unchanged baseline, with
B disabled and B selected. Both arms produced:

| Stage | Incumbent | B selected |
| --- | --- | --- |
| Remove B pending | A,C | A,C; pending=1 |
| Committed prepend C | C,A | C,A; pending=1 |
| First rollback | **B,C,A; success** | **B,C,A; success; pending=0** |
| Committed prepend A | A,B,C | A,B,C; pending=0 |
| Repeated rollback | A,B,C; success/no-op | A,B,C; success/no-op; pending=0 |

The held B reference still identifies the restored lifetime. The later call is
not a retry after refusal. Final A,B,C is reached by moving A after B was already
restored, so it cannot validate the model's retry expectation. These are observed
outcomes, not normative success assertions. The diagnostic runner reports two
passes for its setup checks; that is not two new contract-conformance passes.

The first diagnostic run suppressed console output. A second run wrote explicit
JSON files; no expected outcome or runtime changed between runs. Temporary package
fixtures were removed. Only these two diagnostic cases ran, not broader suites.

## Where validation and replay disagree

The unchanged model's first validation at model.mjs:146–151 examines current C,A
and historical A/C, then refuses without changing state. Before retry it examines
current A,C and admits settlement. It does not retain the bracket as a constraint
on the target it subsequently constructs.

The independent trace records scratch preparation during retry:

| Preparation step | Scratch order |
| --- | --- |
| Undo latest front(A) | C,A |
| Undo earlier front(C) | A,C |
| Undo removal, using recorded next C | A,B,C |
| Replay surviving front(C) | C,A,B |
| Replay surviving front(A) | A,C,B |
| Install and retire pending owner | A,C,B |

The first constructed-target disagreement with the bracket policy occurs when
replayed front(C) moves across restored B. The model's admission checked historical
anchor compatibility, while its result treats front(C) as an operation over the
restored membership. No final bracket validation reconciles those interpretations.
Scratch rewinding is not itself publication; the trace does not claim observers
saw A,B,C or C,A,B. No framework publication exists in this isolated model.

## Representation versus semantic choice

For this finite example the model retains both historical anchors, stable lifetime
IDs and later operation kind/order. It has not lost the information needed to
express either bracket restoration or operation-based resolution. The failure
therefore does **not** prove that local-placement records cannot represent the
answer or that a new data structure is mandatory. It proves that the current
resolver combines incompatible meanings without an adjudicating rule.

One coherent interpretation could validate and construct from the same proposed
bracket target. Another could treat inverse anchors only as recovery provenance
and consistently resolve surviving authored operations. The current successor
placement is an additional existing behavior to account for. These are semantic
alternatives, not selected repairs, and no implementation of them was attempted.

Membership and missing-anchor facts are likewise present in the model: active
lifetime IDs are distinct from keys, and exact-order input lists are separate
from removals. A pure reorder must not gain membership authority merely by
omitting an ID; the earlier subset failure is a missing domain check. Historical
anchor IDs cannot be satisfied by fresh same-key nodes. The missing-anchor failure
is a missing eligibility rule, not evidence that identity information is absent.
This shows finite representability of the distinctions, not complete coverage,
sparse settlement, or a correct algorithm for all overlaps. The frozen laws still
forbid altering membership or aliasing a replacement to resolve ordering conflicts.

## Reclamation is a separate cleanup-path defect

Root traced eight ordinary create/remove cycles with no transaction or recovery
history. The model has zero pending owners, zero events, zero recovery records,
empty key map and no head/tail; nevertheless state.nodes strongly retains eight
inactive records. Held references contain only their non-reused ID, and reading
an absent record already returns undefined. No inspected live obligation requires
these inactive records.

They are **reachable storage with no live recovery purpose**, not garbage merely
awaiting collection. `admit()` does not enqueue ordinary operations when there is
no pending journal; `settle()` is the only place that prunes inactive nodes, and it
returns immediately for unknown/nonpending owners. Ordinary churn never reaches
that cleanup path. As a diagnostic, opening and confirming an empty model owner
uses the existing cleanup and reduces retained nodes from eight to zero; all held
reads remain undefined. This is evidence of the path omission, not an endorsed
application workaround or a model repair.

By contrast, a superseded exact event retained while its owner remains pending
has an inverse used by the current rewind algorithm. The trace shows one
recovery-only fact, two inverse records and one pending owner; old semantic
dependencies are absent, and rejection preserves newer B,C,A and drains history.
That retention serves this model's live recovery algorithm. It is not evidence
that every such inverse is fundamentally necessary in another representation.

## Owner decision and stopping boundary

The precise question is how a later placement relates to a lifetime absent at
authoring but restored by rejection:

| Alternative | First attempted rollback after front(C) | If the removal remains pending until after front(A) |
| --- | --- | --- |
| Preserve current successor placement | B,C,A succeeds | No refused retry in the executed sequence |
| Captured-bracket restoration | Refuse reversed A/C anchors | A,B,C once anchors are compatible |
| Surviving-operation resolution | C,A,B would follow by removing the removal and applying front(C) | A,C,B from surviving front(C), then front(A) |

The last row is a semantic derivation, not a new successful model or kernel run.
The owner must decide whether later placement owns a relation to absent B and
whether contradictory anchors require refusal or are recovery-only input. Do not
choose based on the model's output. Pending rollback may not silently change its
rule between first attempt and retry.

Recommendation: preserve current observable behavior while this question is open;
retain the model's predeclared bracket test as experimental evidence, not a newly
asserted frozen public contract. No further representation or integration work is
selected. Payload semantics, B's costs and prior rejection reasons stay separate.

## Review and replay

Independent premise review inspected laws, history and conditional routing without
being supplied a preferred outcome. Root verified those claims and executed the
public diagnostic and model trace. A follow-up interpretation review inspected raw
public JSON and confirmed that first success invalidates the proposed retry
comparison. No review claimed B,C,A uniquely follows from the frozen laws.

From repository root with Node 24.15.0 and pinned pnpm 10.17.0:

```sh
node docs/research/b-native-integration/ordering-adjudication/trace.mjs
bash docs/research/b-native-integration/ordering-adjudication/replay-public.sh
```

See EVIDENCE.md for hashes and archived raw output. No production/model changes,
expectation weakening, broader suite, API acceptance, v15 change, push, merge,
tag, release or publication.
