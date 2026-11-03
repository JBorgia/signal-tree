# Independent state-repair review

Disposition: hold this exact two-file candidate for boundary correction/review. Do not waive the unchanged history assertion. A public-only history regression has NOT been demonstrated; a new private-seam regression and an overbroad classification mechanism have been demonstrated. No runtime or fixture edits and no reviewer test runs.

Identity: exact R3 base manifest e0b64de42df330abff455d2ee1b981c99abee187a77269cd064f52f3b08505f3; candidate b528cc06421748f41b570e45ad841786c565dece483cd306922a0e77b49a21b7; runtime patch d82886f6eea6aa5b8f5036f43197d321e6b4817c2079ca6ad1e0feaba119f645. FREEZE-VERIFICATION.json verifies manifests, patch, both first logs and changed source bytes. Root HEAD 628d302dadb082a48c58528651c9088234d0a777 is provenance, not candidate identity. Root dirty files were left untouched.

## Contract and concrete boundary

Frozen candidate lib/undoable.ts:65 says: “It cannot promote a write that is not authored.” Its next sentence excludes external realization even inside undoable. This does not say every unrelated operation invoked synchronously while planning external truth becomes that external truth. The adapter comment at lib/internals/causal-runtime/tree-realization-adapter.ts:472–482 describes classification of the applied effects, preserving caller origin.

The new wrapper at adapter:642–731 marks the entire planning/install/publication callback realized. It covers planHeterogeneousFrame/planScalarFrame, slot equality, publication sealing/validation, installation and notification. It does not cover earlier preparePlainBranchMembers (:615), detached completions or released membership delivery (:738 onward). This is therefore neither an exact per-effect classification nor a uniform lifecycle classification. withWriteContext restores ambient metadata in finally; that fixes escape on return/throw but cannot restore authorship of a callback executed inside the wrapper.

The unchanged adapter spec around :4180–4225 replaces frame.prepareCommit with a wrapper that performs undoable(other='updated elsewhere') before original preparation. Before this change, the independent write survives refusal and produces history baseline+1. Now it still installs and survives refusal, but produces no history. The subsequent notification assertion is unreached. This is a reached, meaningful preparation-reentry discriminator, not an assertion to delete merely because the ingress is private.

Executed by author, raw artifacts preserved: original state trace 2 fail/1 pass; candidate unchanged two-file controls 65 pass/1 fail; exact stale test on baseline 1 pass; candidate source types pass. The history difference is introduced by this patch. Neither 65 passes nor the private ingress establishes its acceptability.

## Reachability assessment

An ordinary callback-capable path exists inside the widened region: tree-scalar-slot-runtime.ts:187–226 performs equality before preparing terminal/publication records. signal-tree.ts:1834 chooses the library equality function; there is no demonstrated public custom-equality option here. Public array/opaque payloads can nevertheless execute property getters during deep equality (utilities/deep-equal.ts:98 onward reads array elements). A one-shot getter performing an unrelated undoable write is a source-grounded next discriminator, not an executed counterexample.

Normal callers require care: restoration.ts:3364 already supplies origin:'restoration' and sets isRestoring; transaction rollback routes at transactions.ts:3857–3886 may carry their own context. A same-tree public undo getter cannot be assumed to earn history before this patch. Require exact baseline comparison, reached getter count, and useful surviving write/history assertions. A separate enhanced tree for the unrelated authored write is a useful additional isolation, but also needs baseline measurement. No supported public callback/equality reproduction was run in this bounded review; do not label the private failure a proven public regression or declare it unreachable.

Existing scalar-frame notification metadata already explicitly marks each realized effect (adapter:1850–1863). Wrapping all notification callbacks additionally changes ambient metadata seen by reentrant code; explicit notification metadata alone does not entail that ambient change. Some per-effect routes already scoped realization before this patch, so avoid a sweeping change to their established callback semantics.

## Mechanism recommendation

Keep the two corrections conceptually separate. transactions.ts:2855 exemption for realized evidence removes the demonstrated loss of independent external ABA truth while preserving the installed-operation dedup predicate for authored replay. No independent blocker found in that guard change within the inspected scope; it is not a universal dedup proof.

Replace the whole-apply ambient solution with classification carried by the actual prepared realization unit into its terminal/native admission. The needed distinction is operation provenance, not everything that happens while computing that operation. Preserve caller origin/transaction identity and native proof inputs. Equality, unrelated preparation callbacks and subsequent unrelated authored writes should retain their caller context; each adapter-owned effect must still be realized at both pre-install admission and publication.

A smaller ambient wrapper around frame.prepareCommit is NOT sufficient: that call itself includes equality and source preparation callbacks and still encloses the injected wrapper. A wrapper only around callback-free internal admission may be viable if the implementation establishes that it is truly callback-free; native publication preparation can invoke other preparers. Prefer explicit private per-unit/prepared metadata through the existing preparation seam where needed, without a new public API. Read that metadata for classification of the selected unit rather than globally rebinding user work. Do not clear transactionOwner, native support, origin or restoration designation wholesale. No concrete implementation approved by this report.

## Finite falsifiers before promotion

1. Preserve/replay the unchanged stale heterogeneous history test with baseline+1, surviving other value, unchanged target structure/value, no target notifications and exact refusal. No oracle waiver.
2. Preserve both ABA variants and the original outer A / realized B / outer C rollback distinction. Retain authored same-operation notification dedup.
3. One public payload-getter reentry differential, armed only during reached frame equality; compare baseline and candidate and retain callback count, history, surviving value, target refusal/coherence and later useful writes. If normal public callers mask the distinction, report that limit rather than weakening assertions.
4. A throw and a nested reentry at the chosen narrow admission boundary: exact first error, restored outer context, no duplicate history, correct realized record and useful later authored history. Existing passing controls can cover these where they actually reach the new seam.

No broad suites, new runtime, fixture changes, policy change or release acceptance. Dynamic-admission review is reassigned and outside this report.
