# Independent interpretation review

## Disposition and identity

**No concrete interpretation blocker demonstrated for the proposed bounded mechanism.** The spec addresses the known default-Link reentry recurrence without requiring a new public callback order, a new rollback selector, or a second ordinary-value store. Aggregate input/support separation and receipt/fact lifetime separation match the specifically authorized archived proposal. This is design plausibility, not native correctness or authorization to resume the rejected checkpoint.

Reviewed unchanged drafts:

- `AUTHORITY.md`: `ac5534c452bbd6db2c33ebc24b1d50d6c8e24cfce4f55801078abbab88eac8f8`
- `MECHANISM.md`: `259f68ed93b65fa28e78bf37aa07697b692ebfdfe67aea45338bf262f218ac57`
- `ACCEPTANCE.md`: `de70ed14271bea28512419cbcee61d8c361578982400856c79392b693d1f93c9`

Inspected clean source HEAD `d0e7d1659900b18c9a63d280f409c0448a0c1d80` in `/private/tmp/link-a1-installed-operations`; diff against that commit is empty. Read the repository review/contributor contracts and independent-review protocol. Checked the authorized proposal directly at readiness `2782af63d9ad38a905e594190b596b4537ae0143`. I have previously reviewed this lane and produced the delivery source map, but have not implemented its runtime. I did not read other successor reviewers' conclusions. No tests, models or runtime edits in this review.

## Complete admission covers the demonstrated failure

The archived combined Nx regression `heterogeneous/reentry-permanent/FIRST.log` fails its final outbound assertion with A11/B12 after native A777/B12 already passed. The source is an ordinary mixed undo with a default collection Link and a public tap. It neither requests aggregate declarations nor injects a runtime fault.

At d0, `entity-signal.ts:511–590` prepares all old row transitions, installs them, then delivers `notify(oldRow)` followed by that row's tap. `tree-realization-adapter.ts:1435–1470` installs the complete native/ordinary frame before invalidation/publication. Physical completeness therefore does not prevent a later old row notification from following a callback's newer write. Collection Link still reduces those notifications (`link.ts:565–773`, `experimental-publication/projection.ts:10`).

The proposed replacement is more specific than delaying callbacks: MECHANISM 72–96 admits the entire existing atomic selected unit before callbacks, orders private reductions by installation, and stops later public notifications from replaying old deltas. Lines 98–102 explicitly include the conservative/default Link consumer. That last requirement is essential: declared-support fixes alone would leave the exact public regression untouched.

A0's governing premise is: “Public path notifications keep their existing membership/value chronology and coalescing. They no longer create or complete eligibility evidence.” The successor applies that separation to eligible **values** as well as support. It does not infer O from the current physical after-image. Native stores still own facts, incumbent selection still owns inverse domains, and the existing relationship projection remains the sole outbound projection.

## Callback timing is preserved, not silently selected

The relevant boundaries really can reenter:

- `path-notifier.ts:314–341` invokes enqueue observers before queue insertion, even under normal batching. Containment/reporting does not make those callbacks pure.
- With batching disabled, `path-notifier.ts:366–382` runs subscribers immediately. A private `notifyMany` loop would still expose its first row before admitting the rest.
- `location-runtime.ts:355–409` groups native publishers and consumer settlement; it does not group path observers or taps. `entity-tap-reads.spec.ts:262–283` explicitly requires previously held cells to retain their cache until group end, while a fresh collection read sees the installed state.
- `transaction-safety.spec.ts:255–313` preserves synchronous subscriber error identity and already-applied settlement. `entity-replay-tap-boundaries.spec.ts:92–152` requires complete native state, surviving callback writes and tap self-unsubscribe behavior.

MECHANISM 80–109 and D2/D3 require admission before all these entry points, preserve native/public timing and retain first-error handling. I find no contradiction between preserving the existing public callback order and ordering a private eligible reducer by native installation. Private completion must not secretly invoke an endpoint or arbitrary observer before the full older unit is registered. The existing causal/consequence gate and A0 pending-completion rule remain binding even when conservative Link is the consumer.

This is an implementation obligation, not a demonstrated feature of d0. In particular, the native adapter's current `invalidate` loop can abort before later live-point plans; D3 correctly preserves that separate first failure instead of treating the reentry fix as its proof.

## Aggregate support versus receipt lifetime

The selected proposal at `2782af63` says completeness covers “all inputs to newly authored facts,” and separately: “Existing untouched field, ancestor presence, entity lifetime, occupancy and order facts retain their support.” It also says: “The outgoing projection and per-operation receipt remain conservative/held until every contributing fact and validation horizon permits it.” AUTHORITY 14–25 and MECHANISM 113–138 preserve these distinctions.

G1 is a useful public construction: obtain p from its completed synchronous transact call, then use a fresh literal equal-value setter outside p with declared dependency p. It creates publication evidence without inventing a transaction handle inside its own callback or transferring native rollback ownership. Its unchanged `p.inspect`, absent synthetic value event and rollback assertions distinguish that mechanism from an ownership rewrite. G2 and G3 correctly separate rejection of native-owned x from rejection of a dependency supporting an ordinary surviving copy. G4 requires useful fresh replacement while p remains pending, not mere refusal.

G8 catches the principal proof-lifetime trap: a terminal superseded receipt cannot be the only root of a still-contributing x dependency. Confirmation must wake the newest projection through live fact indexes without reviving the old receipt. G9 covers meaningful equal-support replacement without a value event, and Q2 requires detached terminal receipt results. I see no need for another native payload store or permanent operation history to express these obligations.

Two readings must remain explicit in implementation, but are already resolved by the governing text rather than new owner decisions:

1. AUTHORITY's brief supersession sentence is read with MECHANISM 127's **unstarted** qualifier and A0 terminality: a newer revision cannot rewrite a started receipt into superseded. A receipt is not mutable transport status.
2. “Masked without a surviving obligation” (MECHANISM 128–129) cannot mean every omitted value's proof can be deleted. A0 expressly retains masked support when the same retained value can be reused by re-add/inverse. Only proof replacement, actual retirement or legitimate terminal baseline compaction discharges it. Visible noncontribution alone is insufficient.

## Bounded unresolved implementation proof

The remaining questions do not require new publication policy, and the spec does not claim them solved:

- The prepared packet must contain the complete selected O domain and install no admission for an uninstalled plan. Allocation, cloning, equality, reflection and reentrant revision checks must be outside the primitive install interval. Partial ordinary methods retain actual prefix boundaries; they are not silently made atomic.
- All affected relationships must consume each exact delta once, including default Link, no-event units and later-arriving public notifications. Wake/drain cannot expose an incomplete older prefix. Disposal must release pending records without erasing live foreign obligations.
- Sparse O presence is a new native representation of a previously missing fact, not permission for Link to manufacture absence or select inverses. Fresh identities/missing ordinary ancestors remain explicitly gated. This review does not close their source mappings or the separate source-authority review.
- Admission ordering must not be replaced by broad revision suppression. A same-row callback changing one field while another selected old field still needs application, and an unrelated-row callback, discriminate exact composition from whole-row/global dropping. These are small concrete instantiations of D2/D4, not new architecture requirements.

Falsifier status: the preserved public D1 regression ran and failed on rejected A1; this review inspected its raw log/spec and unchanged-source record. D2 variants, D3 correction, G1–G9 aggregate behavior, masked-support reuse, collectibility and costs were **not run** here. Their written expectations are acceptance inputs, not passing evidence. No blocking contradiction was found that requires inventing new callback semantics or asking the owner to choose another aggregate rule. Native authorization and final acceptance remain with the centralized controller under the stated stops.
