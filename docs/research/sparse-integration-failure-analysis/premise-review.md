# Independent premise review

Scope: bounded read-only review of the two alternatives in `designs.md`, installation inventory, and candidate `9b9b0b35a7dd207df366047ef5c9621168a2b405` against baseline `8d220643e0d4e34cbdbc6e55e6ef692b25d5e023`. No production edits, new execution, design selection, or repair authorization. Candidate checkout was clean. Reviewed the current scoped architecture protocol, actual laws, contributor contracts, sparse adapter/core, scalar installer, restoration target installation, preserved replay and integration report. Preserved execution claims below were not rerun in this review.

## Premises verified, but selected quotations are insufficient alone

The quoted L3, L6, L7, L9, L10, L13 and L15 text is verbatim (some quotations are deliberately only law headings or initial sentences). `git log -1 -- docs/research/transaction-semantics-2/LAWS.md` confirms `de432a1f7e4e7edcbb819694f7bf4e1fff66a659` as its last change at candidate HEAD. The contributor ownership quotation also matches source.

The comparison must additionally preserve these frozen qualifications from the same laws file:

> **L11 — authoritative truth advances the canonical frontier; superseding a
> pending contribution requires an established relation.**

> **L12 — authority order is explicit, never inferred from arrival.**

> **L2 — settlement authority is conserved.**

> **L14 — settlement has explicit terminality.**

L11 explicitly distinguishes contribution order, authority order, and settlement relation. A fresh server snapshot can change the hidden canonical base while leaving the pending overlay current. Thus neither “new root revision” in A nor “native committed write intersects pending” in B is enough to determine supersession. Each installation needs the ingress claim/evidence and supported conflict/refusal behavior. This does not authorize a new API or claim that all semantic-matrix ingress modes are supported today. It prevents silently implementing a stronger, incorrect rule from the shortened premises.

L2/L14 require distinguishing failure before admission from an exception delivered after successful commitment. L8 requires preserving dependent structural truth or refusing without change. L16 prevents dependency bookkeeping from blocking independent work. L17/L18 preserve typed identity and deferred provenance. These already-existing laws constrain both alternatives; they are not new requirements invented by this review.

## A: sparse root owns current truth

The proposed authority relation is coherent in principle: one root decides admissible current facts, and native storage is its projection. Maintaining both representations is not independently sufficient evidence of two authorities or an L15 violation. Current canonical facts remain needed even with zero pending contributions; that does not justify retaining obsolete terminal-owner records.

However, a native realization is a projection only if every semantic writer is admitted against that root before visibility. Hooking ordinary scalar/entity writes does not establish this. The inspected restoration scalar target calls `frame.commit`, whereas ordinary capture uses `commitRecorded`. The former directly changes native slots without the sparse prepared record. Sparse scalar initialization runs only once per position. These concrete source facts support the preserved replay explanation: native undo changes 2 to 1, later reject resolves against sparse committed 2. This is a current bridge violation, not a proof that authoritative sparse roots are impossible.

A complete A must define whether synchronous native getters, equality callbacks, object accessors, membership delivery and reentrant writes can run during preparation/install. A root pointer swap plus observer batching cannot protect a direct getter called from an installation callback. A valid protocol must either exclude such callbacks from the commit region or provide coherent reads there. Preparation must validate all relevant revisions after potentially reentrant equality/reflection, and before the first native mutation. Global revision rejection cannot become a permanent unrelated-work lock.

A's read-own-write claim also needs a concrete rule for multiple authored writes within an open callback. Preparing an entire callback invisibly until its end would break immediate reads and updater chaining; sequentially installing individual authored facts can satisfy that contract, but does not follow merely from calling the final settlement atomic.

## B: native installation authority with sparse obligations

B is also coherent in principle, but “native value is authoritative” needs the narrow meaning already suggested by the design: the native *semantic installation layer* decides current state. A currently visible slot is not all surviving truth. For base1, P1=2, P2=3, or for a fresh server base underneath P1, native visible data cannot recover the correct rejection result by itself.

Keeping a hidden canonical fact, contribution order and dependency facts in an active obligation record is not automatically hidden double-authority. It becomes double-authority when that record and native ingress can each independently decide current truth, or when enrollment/reconciliation happens after native publication. A required capability is atomic first enrollment and last-obligation handoff: the final release must materialize the resolved authoritative fact before removing the only evidence needed to resolve it. No implementation of this capability is supplied here.

Sparse dependency lookup must cover removal/omission, key occupancy, order and lifetime dependencies, including obligations whose directly written value is elsewhere. A reverse index can cover this without whole-store discovery, but its completeness and cost are unproved. The phrase “unrelated committed write uses the native ordinary path” still needs a cheap, correct determination of unrelatedness. B cannot promise literally zero additional work at zero pending state simply from deleting a mirror; a fast guard/index lookup may remain. The useful proposed property is no ownership-cell copies or retained whole-store committed mirror in that state.

Restoration claims are separate live obligations. “Last pending owner retired” is not necessarily “safe to forget lifetime.” An explicit transfer of responsibility to restoration is valid; exempting every restoration-enhanced tree forever is not a bounded-obligation argument. The present adapter's early return for any `__restoration` tree demonstrates the latter unqualified retention policy in source, not a measured leak magnitude.

## Shared atomicity and reentry obligations

Both alternatives need an installation protocol that commits native values, ownership/disposition, provenance and terminality coherently before observers. Neither can solve this by running a synchronization subscriber afterward. Both must preserve the original error if preparation fails, and define what a thrown publication callback means after terminal commitment. Maintenance failure after delivery must remain retryable maintenance, not resurrect transaction settlement authority.

The candidate adapter installs scalar values, then entity plans, then sparse state, then deletes the owner and invokes lifecycle/publication. That order gives a concrete region to audit: if a later install throws after an earlier native write, merely catching the error does not restore atomicity. This is a source-level proof obligation, not a newly executed exception counterexample. A supported nonthrowing-install contract can discharge it; otherwise a reliable abort mechanism is required. Arbitrary process termination or out-of-memory recovery need not be promised to resolve the ordinary callback/fault contract.

Reentrant publication must observe the completed unit, author newer truth, and not have that truth overwritten by a remaining older prepared installation. Deferred notifications may describe their committed event, but any new read or inspection must obey the defined current-state contract. Native reactive scheduling does not imply application-owned computed caches become fresh inside groups.

## Evidence needed to distinguish bridge gap from inherent cost

The unchanged restoration replay plus the inspected independent writer paths establishes a concrete bridge gap. An omitted same-lifetime restore translation is a second kind of gap: crossing a shared frame does not imply complete translation. Broad red categories alone do not establish that all failures have either cause.

The preserved matched point workload establishes only costs of the rejected implementation on that passing subset. It does not establish a lower bound for A, a cost win for unimplemented B, or equal-capability comparison. Distinguishing evidence would be: unchanged useful controls for all relevant installation families; actual per-phase attribution separating native installation, sparse model preparation/index allocation, cloning, retained diagnostic journal work and projection; zero-pending ordinary writes plus collection construction and growing untouched state; and retained-object attribution separating active current facts, live obligations and unreachable/obsolete records. Final-state equality alone cannot qualify the controls: observe coherent snapshots, provenance, terminality and callback retry behavior too.

Necessary informational cost must be separated from chosen representation cost. Hidden surviving canonical facts and dependency evidence during pending responsibility follow from the laws. Persistent AVL path copying, eager whole-collection seeding, duplicated current payloads and continued incumbent journals do not follow from them. Completing A necessarily routes all semantic mutations through its authority, but neither persistence nor a specific allocation cost is entailed. B may avoid full-store mirroring, but cannot avoid the same information while live obligations require it or assume dependency indexing is free.

Disposition: neither architecture is selected or refuted by this evidence. Candidate integration is concretely incomplete; its failure is insufficient evidence against contribution ownership, and insufficient positive evidence for the competing native-authority design. The most material premise correction is explicit L11/L12 handling; the most material implementation proof obligation is one coherent native/ownership admission boundary, including precommit reentry and postcommit exception semantics.
