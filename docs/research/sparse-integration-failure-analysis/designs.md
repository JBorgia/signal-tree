# Authority alternatives: concrete obligations, not a selected repair

Question: which ownership design can satisfy the existing installation, settlement and observation contracts without maintaining independently writable current truth? No production changes or API acceptance are proposed here.

## Shared premises

Source: `docs/research/transaction-semantics-2/LAWS.md`, last changed at `de432a1f7e4e7edcbb819694f7bf4e1fff66a659`, read at rejected integration `9b9b0b35a7dd207df366047ef5c9621168a2b405`:

> **L2 — settlement authority is conserved.**

> **L14 — settlement has explicit terminality.**

> **L3 — reject removes a contribution; it does not restore an old value.**
> Never specify "rollback P1 writes P1.before". Specify "remove P1's
> contribution, then resolve what should now be visible from surviving truth."

> **L6 — confirmation does not reorder history.**
> A contribution takes precedence by when it was AUTHORED. Settlement changes
> its status, not its causal order.

> **L7 — subject lifetime is not the business key.**
> A(S1) removed, A(S2) added at the same key: no operation concerning S1 may
> mutate S2 unless explicitly defined to.

> **L9 — settlement is atomic over the DISPOSITION of every contribution.**

> **L10 — observation agrees with settlement.**

> **L11 — authoritative truth advances the canonical frontier; superseding a
> pending contribution requires an established relation.**

> **L12 — authority order is explicit, never inferred from arrival.**
> The kernel never infers authority order from arrival order. Authority order
> comes from the semantic contract of the INGRESS OPERATION, or from explicit
> authority evidence.

> **L13 — settlement publishes only coherent truth.**
> Accept, reject, realization and failed settlement must not expose transient
> states that violate the semantic unit being settled.

> **L15 — correctness retention follows live responsibility.**
> State retained for CORRECTNESS exists only while a live semantic obligation
> requires it.

Contributor contract at source9b:

> Framework packages may realize SignalTree truth for their runtime. They must
> not create another state authority.

These premises do not mandate persistence, an AVL tree, a second committed-value cache, or a read-time overlay. Two representations are not inherently two authorities: a derived reactive projection is permissible if it cannot advance independently and the authoritative record determines every admitted installation. The executed failure demonstrates a missing invariant, not a prohibition on caches.

Both designs need an ingress classification carried into preparation: contribution order, authority order, and settlement relation are separate. A fresh authoritative snapshot may advance canonical state while leaving a pending overlay intact; later arrival alone cannot supersede it. Correlated acceptance/rejection, versioned truth, restoration under its existing local contract, and unordered external input cannot all become an undifferentiated owner-null write. The current adapter's undefined-id-to-null mapping does not establish these distinctions. This analysis does not invent new public ingress policy; unresolved capability must remain explicitly unsupported rather than silently assigned local sequence order.

## A: sparse root owns current truth

The authoritative root contains canonical facts, pending contributions, lifetime/ordering facts and dependencies. Native slots and collections are projections of a selected root revision. All mutation routes prepare an operation against that root, including the established authority/settlement relation for ordinary writes, restoration, branch realization, Link ingress, inspector writes and removal/teardown of addressable state. Framework adapters never decide ownership.

Concrete installation unit: `{baseRevision, nextRoot, affectedNativeInstallations, terminalDispositions, provenance, publications, retirements}`. This is a description of an internal unit, not a proposed public type. Resolve/validate every address and allocate fallible data before commitment; validate that the base revision and lifetime dependencies still match. Install root and all affected native values before delivery. Where native installation can throw, either preparation must make installation non-throwing under the supported fault model or the entire unit must retain a reliable abort path. A single root pointer swap alone does not make multi-slot native installation atomic.

Direct native getters, custom equality and object-accessor calls are also reentry boundaries, not only scheduled observers. Potentially reentrant preparation must finish before final revision validation; the commit region must exclude callbacks or define coherent reads throughout. Callback read-own-write requires sequential admission of authored operations, not an invisible whole-callback batch.

Restoration would prepare a new authoritative operation with restoration provenance. It would not first write native x=1 and subsequently notify the root. There is no separate ingress that can become visible before root admission. Reentrant callback writes observe the complete installed unit and author a newer root revision. Deferred work may publish its committed facts but cannot reinstall an older prepared value. Settlement terminality precedes observer-visible successful disposition; reclamation follows delivery and live-obligation checks, with explicit maintenance retry.

Costs/risks: every ordinary current-state mutation enters root preparation, even with zero pending contributions. A persistent implementation pays path copies and its indexes; native value storage is still needed for framework reads. Retained root facts for active current entities are current-state storage, not automatically a leak under L15, but they duplicate native payload/index storage. Full payload semantics, branch replacement, omitted fields, identity-preserving restoration, Link provenance and creation of dynamic locations must all exist in the root model. Read-own-write callbacks must see tentative state without replaying journal prefixes. Persistence is one implementation choice, not a consequence of single authority.

Concrete falsifiers: restore x=1 then rollback later x=3 must remain1; restore the same lifetime then redo; branch omission/recreation; pending overlays during later accepted truth; Link rollback metadata and listener throws; write while publication reenters. A hidden native installer that can change visible state without the same root unit refutes the design as integrated. Ordinary-write CPU and live-store memory across increasing untouched state test its cost, even if point settlement is sparse.

## B: native state owns current truth; sparse records are live obligations

The native semantic installation layer is authoritative. Sparse records contain only pending contributions and the dependencies/baselines/revisions needed to resolve them. No full-store committed mirror survives independently. With no pending or restoration/other live obligation at a location, an ordinary write needs no ownership-cell copy; the native authoritative value is sufficient. This is a proposed implementation property, not a measured performance result.

“Only pending” cannot mean only each transaction's last authored value. Native *visible* value alone cannot recover hidden surviving truth: base1, P1 writes2, P2 writes3 requires enough live responsibility to reject P1 and then P2 back to1 without resurrecting2. The pending index may therefore retain canonical1 while it is hidden, authored order, lifetime/ordering dependencies and supersession facts. That retention is justified by live obligations. Last-obligation handoff must atomically materialize the resolved native fact before removing its only resolving evidence. Retirement of the last pending owner is not sufficient if restoration or another live dependency still needs the lifetime. It must disappear or transfer to an explicit other obligation when the last owner retires; it must not quietly become a second whole-store committed root.

Concrete installation unit: native target writes plus updates to the pending-location/dependency records they actually intersect, terminal disposition, provenance and delivery. Before native installation, indexed lookup identifies affected owners and dependencies. Preparation constructs both native changes and ownership reconciliation. They commit together before observers; a post-publication synchronization callback is insufficient. First pending enrollment atomically captures the current native fact/revision. An unrelated committed write uses the native ordinary path. A committed write intersecting pending state must reconcile authored precedence, canonical authority evidence, the actual settlement relation, address/lifetime dependencies and future settlement at the same boundary. Mere arrival cannot erase a pending overlay; hidden canonical facts must survive if the ingress does not dispose that contribution.

Restoration with no pending obligation writes through native installation and leaves no mirror to become stale. Restoration with a live obligation still requires a defined atomic reconciliation, preserving the existing allowed/refused behavior; it cannot bypass ownership merely because its origin is 'restoration'. Rejection resolves surviving responsibility, then uses the same native unit as ordinary/realized writes, including exact Link provenance and callback recovery. Stored old values are facts needed for resolution, not an unconditional compensation command.

Costs/risks: retaining only active locations may reduce ordinary-write/index cost, but reverse dependency indexes must find every affected obligation under branch deletion, key handoff, membership/order changes and restoration. That is the same capture atomicity obligation in another representation. It must handle ABA by identity/revision, not equality. It may reproduce incumbent complexity if it reconstructs current authority from disconnected journals or defers reconciliation. A native store with no revisioned/addressable installation boundary cannot get this design merely by attaching an observer.

Concrete falsifiers: same ordinary restoration replay; restoration/Link writes while dependencies remain pending; nested enrollment and callback throws; same-key new lifetime vs held reference; removal whose dependency is on a location other than the value being written; zero-pending ordinary-write work. If correct reconciliation repeatedly requires whole-store discovery, this claimed sparse advantage fails. No implementation or cost win for B is established by rejecting A's current adapter.

## Comparison boundary

Both designs must separate precommit failure (no admitted state change and conserved pending authority), postcommit delivery exceptions (terminal disposition does not revert), and retryable maintenance failure after delivery. Neither may overwrite the original thrown value or silently reclaim live responsibility. An unsupported failure boundary remains unproved, not assumed safe.

Both designs require an authoritative *installation* protocol, not merely one settlement function. Both must preserve native framework scheduling without promising fresh application-owned computed values inside groups. Neither may skip provenance, inspection, restoration or reclamation obligations as optional diagnostics. Neither is authorized as a repair in this analysis.

The current integration is neither completed A nor demonstrated B: it computes from a persistent committed root while independently writable native realization remains authoritative for several production operations. That explains a concrete bridge gap. Whether completing A is too expensive cannot be inferred solely from that correctness failure; the matched cost attribution must be evaluated separately. Conversely, an incomplete bridge is not an excuse to assume its existing persistent root is the best production starting point.
