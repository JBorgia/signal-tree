# Separate ancestry and owner-history bounds

**Exact finalized-role preservation can bound ancestry for fixed responsibilities; it does not establish a bound independent of historical owner identities.** Frozen C25 has no general terminal-owner discharge at combination/finalization. This is a separate qualification limit, not permission to introduce terminal policy into the normal-form prototype.

Source audit (candidate/packages/kernel/src/lib):

- experimental-publication/lifecycle.ts:152–155 filters already-confirmed owners only from the owners array of a NEW NativeInput. It retains the input requirement for uncertainty and other evidence. An owner captured while pending remains in that immutable captured array even if confirmed later.
- lifecycle.ts:100–110 unions each role by OwnerCell identity, without outcome filtering. Different confirmed cells remain different identities. W remains separate even if its cell also occupies an actual role.
- lifecycle.ts:352–355 materializes a proof and clears input/frame/known scaffolding. It does not remove confirmed cells from the materialized proof. The same applies to no-frame finalization at208.
- private.ts:169–179 retains the owner-bearing selected requirement and combines it with fresh derived invocation evidence. Thus a newly captured proof may omit already-confirmed q1, but the retained predecessor still contributes q1 through its old role sets. That combination defeats any inference that new-consumption filtering alone bounds the selected source's total owner history.
- lifecycle.ts:60–65 removes a terminal cell from pending and eventually the source.cells registry. It does not remove other strong references to that cell in selected proof arrays or recipient operation dependencies. Registry size is not evidence of selected-proof reclamation.

Concrete source-level sequence: keep destination p pending; for each distinct qi, consume qi while pending through a dependent ancestor updater returning the same p-owned value, close validation, then confirm qi before the next invocation. Each qi enters actual input/validation support. The current selected predecessor preserves earlier qi references even though later capture omits those now confirmed. An exact flattened union preserves this accumulation. This sequence was NOT executed here; it is a source-derived residual, distinct from the already executed fixed-two-owner ancestry growth. It requires genuine native updater consumption, not fabricated owner tags or merely listing an unrelated owner as pending.

The requirement to preserve live cell references and exact role sets in the proposed normal form intentionally leaves this behavior unchanged. That does not establish that permanent historical identities are a desired public contract; it establishes that deleting them is a different semantic/lifetime transformation requiring its own authority and proof. In particular, rejected/abandoned outcomes, rejected-role bits, historical W, snapshot aliases, endpoint provenance and rollback/inverse support cannot be silently collapsed under a generic “terminal” label.

Finite-gate split:

1. PRIMARY authorized representation gate: fixed p+q, repeated identical consumed inputs, closed horizons. Bound selected ancestry and exposed roots by fixed obligations, preserve useful settlement and all roles. Passing proves only this scope.
2. SEPARATE eventual qualification: distinct qi consumed pending then confirmed while p remains pending. Count unique cells per D/I/V/W plus selected proof/recipient references, separately from registry entries and component nodes. Determine whether existing approved lifetime contract requires terminal-role retirement before assigning a numeric bound. No new test or policy is authorized/executed by this note.

Do not label a flat proof, constant component depth, or successful fixed-two-owner test as general L15 closure. Normal-form ancestry work may proceed within its existing scope; any owner-history reclamation requirement must be tracked and adjudicated separately. No runtime changes, new runs, or terminal-outcome reclassification.
