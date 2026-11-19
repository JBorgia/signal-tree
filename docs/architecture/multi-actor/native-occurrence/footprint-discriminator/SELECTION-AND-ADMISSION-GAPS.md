# Concrete producer gaps after discriminator A — no implementation

This supplements, and does not edit, the frozen design under `/private/tmp/st-authored-footprint-successor-design`. Mechanism remains blocked pending review. The original foreign-window restoration assertion and separate wider-updater oracle conflict are unchanged.

## 1. Exact responsibility producer and required result

The authoritative decision point is `transactions.ts:2373` prepareEntityResponsibility. It already has capture.changes, participation, exact subjects/fields, per-source revision/segment identities and access to TransactionAuthority. It filters genuine equal fields at :2442, then prepares source admissions/segment writes and dependency records (:2470–2590). The observed same-tree equal frame still returns a nonempty terminal plan (3–4 metadata writes) even though it adds no field effect. Testing plan presence, row equality, field-mask null or plan-write count cannot certify ownership movement.

The common producer that must consume its result is `entity-signal.ts:1135` commitAndProjectEntityMutationFrame, plus `commitExistingSubjectValue(:2048)` and the already-distinct inverse source preparation. Today frame publication is prepared at :1323 before responsibility at :1350; frame.commit installs native responsibility and the ordinary/publication plan before complete at :1380. `MutationCaptureRuntime.prepareEntityResponsibility` returns only TerminalRecordPlan|undefined. It has no retained/superseded capability or stable authority epoch.

Required private return, at this exact seam (proposal only):

- prepared terminal plan;
- opaque exact unit identity, native source revision and **authority epoch** observed during preparation;
- per-step, per-native-address obligation disposition: retained original obligations; superseded obligations authorized by actual native admission; newly admitted obligations; or authorized realization disposition;
- exact ordinary field/presence domain to which each disposition applies, separate from the writer's declared footprint;
- installation validator and a single-use installed receipt. Publication may prepare against the result, but cannot finalize a certifying support replacement until the native plan and this disposition are installed together.

'Undefined hook return' must be refined into explicit producer cases: no installed settlement authority, inspection/physical-only, realized via a separate existing inverse authority, or no new field effect with pre-existing obligations retained. In particular the last case cannot become an empty owner list. New whole-literal publication support can replace an old foreign possible window, while the result must preserve same-tree q obligations retained by settlement. Source declaration validation/input evidence remains orthogonal; no publication frame creates or changes transaction ownership.

**Where obligation truth comes from:** TransactionAuthority and its exact ordinary admission effects, not a new publication ledger. `sourceSegments` at :1476 is a latest-writer index, not sufficient proof of rollback supersession: pending/confirmed turns and structural dependencies participate in `buildPendingRollbackPlan(:447)`. Do not derive disposition solely from segment writer or scan every pending turn in Link. If existing authority cannot answer exact-address obligation disposition, it needs a private incremental index maintained at the authority's actual pending/admission/confirmation/rejection mutation sites. Index keys must include source owner, lifetime and field/presence/order domain, not business key alone. Cost target O(affected addresses + indexed overlapping obligations), including structural overlap; storage O(active indexed effects and dependencies still required for settlement), released by the same authority lifecycle. This is new missing implementation, not a claimed existing API or proven bound.

A bounded retain result for A is immediate: equal native field effect absent -> retain its existing authoritative obligation selection. A supersede result must be issued by the authority's existing overwrite/conflict rules. If those rules cannot provide an exact preinstall result without changing settlement or scanning unbounded history, this part remains blocked; don't introduce policy that makes A's q rollback preserve7.

**Ordering and validation:** Capture source + authority epochs after user interception/value staging at the established boundaries. Prepare native disposition and publication selection without installing either. Validate source revision AND authority epoch immediately before terminal writes; validate exact subject/lifetime and one-use receipt too. Source physical revision alone misses q.confirm()/rollback() that changes obligation state without a value write. Any legal reentrant completion must be reflected before freezing the plan, or trigger the existing stale-preparation refusal path without rerunning callbacks. Install native ordinary/responsibility state and its paired selection before callbacks/delivery; finalization readiness still follows parent horizon. Abort drops uninstalled handle references and readiness listeners; it cannot revoke prior installed obligations. These requirements need explicit implementation tests; opaque types alone do not enforce them.

## 2. Existing sequence representation is NOT sufficient

Read-only source findings:

| Representation | What exists | Why it cannot serve as an immutable completed selection |
| --- | --- | --- |
| StructuralStore.preparePlacement (:95) | Sparse stage with captured head/tail and callback into mutable placementForSubject | Untouched subjects are read from future live state. Head/tail plus epoch is not a snapshot. |
| EntityPlacementStage (:5) | Mutable patch over base callback | read falls through to mutable base. snapshot(:60) walks every subject and returns only IDs, not frozen payload/support. |
| EntityOrdinaryTopology (:25) | Current divergent placements/head/tail; preparePlacement(:31) overlays mutable ordinary map + physical base | Continuity and before/after tokens identify intervals; they do not retain untouched historical adjacency or rows. prepareInterval(:74) freezes only touched placement pairs. |
| EntityValueStore.ordinaryForSubject (:147) | Current inspection baseline or current retained value | Neither a historical map root nor a unit-owned complete sequence. Subsequent replacements change lookup results. |
| entity-signal.getProjectedEntities (:462) | Active-key traversal plus backing reads | Full physical read, with absence-aware wrappers; precisely unsuitable for hidden ordinary selection. |
| EntityTopology.fork (source-mutation.ts:137) | Recreates topology from order.map(...) | Whole-collection copy, not persistent constant-time fork. |
| EntityEgressProjection.prepare (:205) | Point touched-row updates; returned value still order.map(...); structural draft clones collection | Consumer-specific eligible authority, explicitly not source authority. Cannot adopt it as shared source truth or call it a no-scan representation. |

Conclusion: no existing finite immutable source payload/order root was found. The design's hypothetical source selection handle is not implementable by just retaining a placement stage or continuity token. No constructor/class name proves the required lifetime or cost properties.

## 3. Concrete finite representation candidate and its cost (unimplemented)

A reviewable replacement representation would be a **source-owned persistent ordinary selection root**, with immutable balanced maps keyed by native subject identity:

- adjacency map: subject -> exact ordinary present/key/prev/next record;
- row map: subject -> immutable prepared ordinary row + field requirement references;
- head/tail and exact source/ordinary-unit version;
- explicit ordinary exclusion/member/key/order support, including absence contributions required by the source contract.

Use path-copy balanced search maps (bounded O(log N) depth), not linked deltas that require replaying all history. Preserve exact native identity and deletion versus missing key. Each prepared ordinary step already has touched rows and ordinary placement patches. Apply only those into the next root during the same native preparation; root swap is part of the terminal record. Requirements remain exact references with their own finality, not a newly clean proof. This root is a source-derived ordinary selection representation, never writable by recipients and never an alternative settlement decision maker. Either integrate it as the native ordinary representation or prove its paired derivation/install invariant; a separately updated 'cache' with snapshot fallback is unacceptable.

Costs, explicit and not measured: a point replacement copies O(log N) map nodes plus its already-required row/field work; a k-edge structural edit costs O(k log N); retaining a completed root is O(1); parent membership selection references it without enumerating rows; complete output rendering costs O(N), already inherent when that collection's full payload is requested. If every point packet eagerly converts the root to an array, that is a newly imposed collection walk and violates the proposed bound. Render only as the existing requested output materialization, with no second scan for membership or proof. The source-issued descriptor must represent payload and proof as one immutable version; consumers must not render current physical state later.

A full explicitly supplied setAll already traverses the complete input. Preparing a root from it can use a bulk O(N) build after subject/order resolution rather than N independent updates if this preserves ordered per-step ordinary effects. Reorders necessarily touch their authored domain. This does not justify any whole-collection work for a point update or ancestor activation.

Retention: current source root plus roots referenced by prepared/completing/pending membership units and actual output consumers. Persistent structural sharing costs O(N_current + nodes reachable only from retained versions); for H retained point versions, O(H log N) additional map nodes plus retained row versions, not constant memory. Release handles on abort, supersession, disposal and terminal completion when no consumer requires the version. Do not keep an unbounded root history, use FinalizationRegistry as correctness, or erase recovery/settlement evidence just because a delivery handle is released. Recovery authority keeps its own approved evidence. Destroy/retire must release source references and exact readiness listeners. Implementation must measure live retained nodes under long open horizons and remove/readd churn.

This is a proposed new internal representation with material implementation cost. It is not present in frozen source and has not passed independent review. If adding it exceeds the bounded successor, the honest outcome is to keep runtime blocked, not replace it with a global projection scan.

## 4. Later child interceptor rewrites an earlier child

Counterexample: root writes child A, then child B's interceptor writes A again (possibly under q, inspection, or a nested declaration). A parent composer that saved A's first completion token will select stale payload/support even if every token is authentic.

Required frontier protocol:

1. A structural operation owns a private composition scope indexed by exact child occurrence, with child source revision/selection pointer. Ordinary child installations publish their source selection to the native ancestor edge index synchronously at installation/completion, before the next user callback. This is a source lifecycle hook, not a recipient notification.
2. While B's interceptor runs, its nested A write installs A's newer source selection. Only A and its enrolled ancestor path are marked dirty/replaced. Inspection does not replace A's ordinary root but changes physical validation as already required; native obligation transitions update the matching authority epoch.
3. At parent membership preparation, compose the latest completed ordinary child pointers for dirty/touched paths, preserving each child's original authorship/dependency provenance. Do not replay A's outer supplied literal or re-author A under the parent's declaration. Membership requirement remains separately validated. Respect existing readdedDuringStructuralWrite behavior for reentrant omissions/additions.
4. Freeze parent child-frontier references only after those callbacks and existing ordinary effects complete. Validate the parent descriptor/lifetime plus the exact child/source and authority revisions used by this selection immediately before install. After freezing, no user callback occurs between validation and paired terminal installation. A mismatch before freeze is recomposed from already-installed native selection pointers; do not rerun user code. A mismatch inside preparation obeys existing stale/reentry failure semantics, preserving nested installed writes.
5. Subsequent child writes after the parent unit completes create a new source selection event; they cannot mutate the old parent payload version. Removal/readd uses a different occurrence token; a late old-horizon callback cannot overwrite the new pointer. Scope closure/disposal releases pending subscriptions and old version roots.

Cost: notify/update affected ancestor edges, not all children/collections. A persistent branch child-selection map lets changing A replace O(log B) nodes at each affected branch; initial branch construction uses its existing shape construction. If implementation needs to reread all children at finalization because it lacks source invalidation, it has not implemented this protocol. This new source-edge propagation mechanism also needs review; the recipient occurrence index is not automatically an adequate source composition index.

Required next review decision is feasibility of these exact native producer extensions and immutable source-root lifecycle, not whether the old footprint table is correct. Runtime remains blocked. No new public policy is proposed; native q ownership and existing confirmed-history semantics remain unchanged.
