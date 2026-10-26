# Independent A0 interpretation and mechanism review

Reviewed the supplied A0.md SHA-256 `14af9c8e7e174a7b7c5d7e73d8620472dd055e20dd42cf6410043510aedce72e`, verified at initial read and the last source-read checkpoint. At report write the shared path had changed to `e74ff6cd5a52c4ad6afb79755308ba3e20c067fb27a2394a256e48b4374cd741`; that revision was not read or reviewed here. Findings apply to the supplied hash, not automatically to the newer file. Source: clean `/private/tmp/v16-transition-qualification`, `f01ed39a7df8a5de185ebec0773e09e36537dacb`. Contracts read: declared-contract SPEC/README, declaration-examples SPEC/README and archived model/examples source, API PROPOSAL/README, relevant semantic-transition-plan scope, and repository review contract. I also read the draft's referenced WRITER-MAP.md and checked its relevant native source sites. No other new reviewer verdict was read.

I have reviewed earlier designs but did not implement this mechanism. Parent clarifications received during this review are assessed separately below; they do not change the hash-reviewed draft. No model, test, runtime, build or benchmark execution occurred. Paths below are relative to `packages/kernel/src/` unless stated otherwise.

## Disposition

**The exact draft is not yet ready to enter A1.** It contains two interpretation problems and an initialization premise affecting required useful progress. These are bounded corrections, not evidence that the support mechanism is impossible or that a new API/rollback policy is necessary. The parent's proposed corrections to nested interpretation, equal-value reauthoring and initial baseline support are compatible directions, but must be incorporated in the actual contract before its A0-complete claim is used.

The document materially resolves earlier gaps: it acknowledges publication authority, separates installation from logical method/horizon/delivery, preserves native capture timing and partial success, registers no-event pending work, and separates receipt lifetime from live proof. Those claims are plausible internal mechanisms. Native qualification remains necessary and cannot be inferred from this review.

## 1. Equal state is not always a publication no-op

**Finding:** A0 line 62 and discriminator 3 need a responsibility-sensitive definition of no-op. Reading them as suppressing every present equal setter with no P/O adoption or membership change conflicts with the approved fresh same-value post-rejection case.

Smallest sequence:

1. Declare dependence on pending p and ordinarily write y = 7.
2. Reject p; the ordinary write survives as 7. Keep unrelated q pending.
3. In a fresh independent declaration, explicitly write y = 7 again.

The approved API's Binding/scope section says equal-value authored revisions still count as responsibility changes even when value notifications are suppressed. Declared-contract admission rule 6 requires fresh evidence for a later authored revision without relabeling historical payloads. Declaration-examples SPEC expressly allows fresh post-rejection independence. Its archived `examples.mjs` case `fresh surviving write after rejection can bypass unrelated q` uses exactly the same 7 and requires delivery while q remains pending. This is therefore not a policy inferred solely from a model implementation.

At f01, `internals/tree-scalar-slot-runtime.ts:268–269` can return before preparation when physical and ordinary equality both hold. A0 cannot simply inherit that suppression as the publication-support admission criterion. The new explicit setter can replace obsolete value proof even when it installs no different scalar bytes. Existing structural/lifetime support and known updater inputs still constrain publication.

**Required correction:** distinguish state no-op from publication-support no-op. Permit a support-only authored unit for an explicit setter attempt that changes effective publication support; do not manufacture a native value notification or compensation effect. A declaration with no relevant setter cannot bless an old snapshot. Compare effective authority/support, not fresh proof-object identity, which would make every attempt look changed.

The parent supplied this correction during review. It follows the approved same-value new-authorship rule and does not need a new owner policy choice. It is not yet in the reviewed hash.

Cheapest falsifier: the exact three-step same-7 sequence, paired with a genuinely equal state/support setter and a no-setter declaration. Assert useful send, receipt outcome, pending q and no forced native event. **Not run.**

## 2. Shared validation alone does not preserve accumulated same-scope dependencies

**Finding:** A0 lines 84–86 deliberately narrow child-to-enclosing dependency contribution. That interpretation is not established by the approved contract/examples and changes the frozen implementation's result.

Smallest trace on one scalar connection:

```text
outer independent declaration:
    inner dependent(p) declaration: y(9)
    y(7)
```

A0's admission-time child-only rule can replace y's final value proof with the outer empty declaration after the inner scope returns, then send 7 when the shared horizon closes. The API says repeated writes receive the operation's final validated evidence and known dependencies accumulate. The archived model explicitly merges the child's dependencies into `parent.known` before outer validation. In that model an outer empty declaration is then contradictory; f01 instead accumulates p into matching enclosing frames and retains it in final proof (`experimental-publication/lifecycle.ts:70–78,101–110`). The model and native prototype do not settle every diagnostic detail identically, but neither establishes the draft's newly narrowed early permission.

This is not an application-hidden-input case: the inner declaration exposes p. Waiting for the horizon to close prevents premature validation escape; it does not decide which accumulated dependencies the final proof must preserve.

**Required correction:** preserve the existing accumulating same-scope dependency interpretation. Per-fact replacement can still remove obsolete support in a fresh later scope after the earlier horizon closes. Distinguish immutable installed fact identity from the eventual frozen accumulated evidence of its contributing enclosing frames; do not mutate a supposedly final proof after granting permission.

The parent states this is the intended correction. It avoids an owner question by preserving the existing contract rather than selecting narrowed inheritance. Shared validation remains necessary across connections and through return-shape getters/error reporting. It must not become a substitute for dependency accumulation.

Cheapest falsifier: the trace above and a paired independent overwrite in a fresh scope outside the completed horizon; include unknown outer scope and late validation failure controls. Fix expected diagnostic/receipt outcomes from the governing surface before execution. **Not run.**

## 3. Baseline structural evidence needs an explicit trusted initialization rule

A0 line 50 makes unavailable pre-creation support unknown and forbids a later declaration from blessing untouched structure. Line 58 requires scalar exposed presence/lifetime support. Together, these can correctly hold a connection created with unavailable evidence, but they do not yet explain how the required ordinary y literal case gets trusted unchanged member presence. A fresh y value proof alone is insufficient under the draft's own rules.

This is an internal initialization premise, not a demonstrated necessity for new public semantics. The parent supplied a sufficient positive control: establish the relationship baseline when the actual conservative boundary permits it, with no pending/known foreign contributors; later open unrelated x work; then independently replace y. The baseline supplies trusted unchanged structural facts, the declaration supplies fresh y support, and x remains pending. Creation still sends nothing and grants no blanket independence to future writes.

Connections created during pending work with unavailable evidence may remain explicitly unknown; the clarification does not claim universal early progress for that different case. It must preserve distinct creation baselines, including inspection predating creation. Do not replace unavailable evidence with “no currently registered owner” unless the actual native gate establishes that conclusion.

**Required correction:** state when/how a safe initial baseline is certified, which facts it covers, and how the unknown case reaches fresh conservative reevaluation. This can satisfy the existing useful-positive requirement without a new API. It is not in the reviewed hash.

Cheapest falsifier: baseline-before-pending versus connection-created-during-pending, same independent literal replacement, with unchanged initial-send behavior and distinct baseline facts. **Not run.**

## Remaining concrete mechanism checks

### Installation and omission/re-add

The split into native value and later membership units is source-grounded. Native replace/derive call capture after `commitRecorded` but before re-add (`internals/native-tree-scalar-leaf-runtime.ts:182–200`). Neutral scalar and prepared member restoration have different capture boundaries; `internals/plain-branch-membership.ts:1154–1170,1183–1185` deliberately captures at different phases depending on scalar targets. Preserving those boundaries avoids pretending that an entire method is callback-free.

A0 appropriately permits prior installed units to survive later preparation failure and retains masked support where a real retained input may be reused. Equal re-add has an actual supplied value, not implicit resurrection of dormant siblings. No additional rollback authority is demonstrated by these rules. Implementation must retain the identity/provenance of the stored value actually exposed after capture reentry, rather than reapplying a stale outer delta at membership completion. This is a native falsifier obligation, not proof of a further semantic conflict.

### Complete-operation composition must include consumer composition boundaries

The required original compound case is two method calls in one history capture: add w, then overwrite-prepend c (`enhancers/restoration/order-composition-readiness.spec.ts:37–40,76–87`). A0's per-method logical operation closure must not become the only completion boundary.

At f01, `restoration.ts:4447–4463` retains the first ordinary endpoint/domain, while `order-boundary-evidence.ts:43–48` extends only physical endpoints. The existing bucket drain calls that function at `restoration.ts:3967–3972`. A0 must explicitly carry/fold the same completed ordinary membership/order facts across the existing history bucket and selected inverse domain. Likewise order-interference admission currently happens in a later collection-order callback (`transactions.ts:2777–2807`), after committed entity observers can reenter (`physical/entity-mutation-frame.ts:387–392`; `internals/mutation-capture-runtime.ts:118–125`). Completed source evidence must install the corresponding witness before that reentry, with later delivery acknowledging it once.

These are known source-mapping obligations, not new order-policy questions. The draft states the intended result, but its A0 completion should explicitly bind the existing bucket/selector/witness consumers to the completed records; merely marking each individual method complete would reproduce the original deficiency. The unchanged original test is necessary, not a substitute for this known mapping.

### No-event scheduling and receipt/proof lifetime

The proposed registered/incomplete → complete/held → eligible/started state machine covers the earlier `held.size === 0` wake gap (`lib/link.ts:991–1002`). Registration before observable completion and final revision/support preflight are the correct internal obligations. It need not add public notifications. No static contradiction of this scheduling mechanism is demonstrated.

Keep the API's receipt about the **last relevant authored revision of its operation**; A0's “revision(s)” must describe internal support references, not silently turn the receipt into a multi-revision delivery status. A started receipt stays terminal even when live support remains or a newer corrective request exists. Current `lifecycle.ts:86–95` deletes started/superseded operations, so the stated independent support lifetime is a genuine required replacement. Its collectibility and waiter behavior are native proofs still outstanding. I make no new destruction-policy finding here.

## Acceptance boundary

Correct the three interpretation/initialization items in the exact contract, and make the existing complete-operation consumer mapping explicit. The first two corrections preserve already-approved behavior; the supplied baseline clarification provides a concrete useful case. None requires changing compensation ownership or adding a public API. Until incorporated, exact A0 is incomplete under its own requirement that no transfer/lifecycle row depend on an unfilled premise.

After those corrections, the remaining listed installation, scheduling, retention and in-flight obligations are appropriate bounded native A1 falsifiers, with the original compound-undo and leaf tests unchanged. This review does not execute them, approve the runtime, or authorize resuming later release slices.
