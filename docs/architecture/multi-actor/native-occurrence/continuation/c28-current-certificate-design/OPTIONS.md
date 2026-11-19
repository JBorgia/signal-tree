# Current-certificate options after the public A/B observation

Design comparison only. No option, API, policy or C28 implementation is selected. Runtime remains frozen. Evidence: `/private/tmp/st-c28-no-write-discriminator/REVIEW.md`.

The same fresh dependent[p,a] updater produced different public receipts: A's fresh receipt stayed no-write and its historical receipt eventually started; B superseded its historical receipt and eventually started its fresh receipt. Both delivered once, settled, preserved ownership and had identical values/notices. Compatibility now concerns an observed receipt distinction, not just an internal comparison.

| Option | Receipt contract | Feasibility and limit |
| --- | --- | --- |
| **1. Preserve exact historic identity-based no-write** | Preserve A/B's distinction, including old receipt supersession and which receipt starts. | Requires an exact answer to whether an authenticated identity previously occupied each relevant role in the selected history. A flat identity-free summary cannot answer it. Lifetime-aware weak membership may avoid strongly retaining OwnerCells, but no complete bounded construction/handoff has been established. |
| **2. Define current eligibility/ownership equivalence** | Treat differences consisting only of permitted obsolete confirmed I/V history as irrelevant to no-write. | Plausible local direction, but an explicit compatibility change wherever it merges the observed A/B distinction. “Both currently held” is far too weak an equivalence. The treatment of freshly declared confirmed validation must be specified, not accidentally erased. |
| **3. Fresh per-operation authorship when evidence changes** | Give genuinely admitted fresh authorship its own receipt lifecycle even when value is unchanged, rather than retaining historical identity membership solely for no-write. | Existing revision/receipt machinery offers a handoff, but the evidence-change rule is a semantic choice. Merely allocating a new certificate or cleaning metadata cannot count as authorship. An admitted-authorship rule that makes both A/B fresh changes A's observed behavior. |

## 1 — What a bounded membership witness would have to prove

The A/B result does **not** prove that a strong, ever-growing OwnerCell array is necessary. If a cell is no longer reachable through any authentic handle or other path capable of querying that same identity, weak membership can potentially forget it without an observable query. GC must never change the answer for an identity that remains queryable.

But a bounded implementation is not presently specified. Membership must be role-specific and associated with the correct selected lifetime/certificate. Source replacement, rollback to an issued endpoint, and retained snapshots cannot inherit later membership or lose earlier membership. WeakSets are not enumerable: cloning/unioning their exact historical membership into a new immutable certificate is not supplied by replacing arrays with WeakSets. Chaining old certificates to answer membership restores ancestry; sharing a mutable set with issued certificates changes their meaning.

A defensible bound would need explicit parameters such as live queryable identities and retained certificate lifetimes, not merely pending-owner count. A user retaining arbitrarily many authenticated confirmed handles can still make distinct membership queries. That is a constraint on the required information, not proof of a particular representation or a universal impossibility. No lifetime-aware witness meeting all these requirements has been demonstrated here; do not expand into a whole-owner-graph rewrite to assume one.

## 2 — Equivalence must be defined narrowly

Preserve exact destination witness, non-confirmed actual roles, W, unknown/invalid/unavailable/historical facts, rejected bits, readiness, ownership/inverse selection and recipient permission. Current-invocation input captured while pending cannot become historical merely because it confirms before completion. Delivery eligibility being equal at one instant is insufficient: different pending dependencies have different future behavior.

If already-confirmed I/V is excluded from no-write comparison, the treatment of an explicitly repeated confirmed validator must also be resolved. Excluding that validator from the relevant equivalence could make both A/B no-write; retaining it as meaningful fresh evidence yields a different relation. Neither outcome is selected here. The old and new receipts, useful delivery and supersession behavior must have explicit expected counterparts before implementation. Existing issued certificates/receipts remain untouched; the rule applies prospectively at fresh admission.

## 3 — Authorship must not be inferred from representation allocation

Specify which actual admitted operation/evidence change earns a new revision. Empty callbacks, rejected preparation, mere reads, ordinary observation, and cleanup-only certificate replacement must not automatically acquire authorship. Decide the equal explicit-write and derived-write cases, including repeated identical declarations. Counting every new certificate as new evidence would manufacture receipt activity and potentially duplicates.

This option still cannot transfer pending destination ownership, alter inverse selection, grant early delivery through pending inputs, or generate value notifications for equal values. It may replace which receipt represents eventual work while preserving one useful output, as B already does; that does not make the change to A compatibility-neutral. It also does not independently bound owner history: the transported certificate still needs a permitted confirmed-history summary and accounting handoff.

## Shared constraints for any choice

- Pass the fresh certificate through scalar native preparation into both `op.native` and `unit.native` before recipient preparation; otherwise finish/ready can reimport the old history. Replace the exact occurrence contribution through existing cached-count subtraction/addition. Do not strip unrelated contributors or rewrite issued operation dependencies to obtain a count result.
- A new current NativeView alone does not resolve aliases. `suppliedViews(node,value)` first returns an existing snapshotViews certificate for the same object. Leaving it preserves old evidence even for a cached reread; overwriting it can retarget an older alias. Establish the intended evidence for old issued snapshots, same-object cached reads, fresh updater captures and direct scalar captures. No automatic value-identity or API change is authorized.
- Carry the original retirement classification separately from shortened publication roles. Confirmed actual-role presence can remain a retirement blocker. Preserve live Q/source-availability checks and all rejected/abandoned behavior; `compactTerminalProof` is not a drop-in implementation.

The next selection is between preserving the observed historical distinction with a demonstrated lifetime bound, or explicitly defining a different prospective no-write/authorship contract. The existing two-history observations remain frozen evidence for that decision. No new execution or runtime change was made for this comparison.
