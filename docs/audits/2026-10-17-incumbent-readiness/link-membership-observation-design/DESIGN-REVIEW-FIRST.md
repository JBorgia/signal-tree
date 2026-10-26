# Independent membership-observation design review

## Disposition and reviewed identity

**The design explains the membership recurrence and identifies a real remaining policy decision; it does not clear the recurrence or authorize a runtime successor.** The observation contract is substantially sound. Before implementation, clarify the evidence-class boundary below, select the unobserved-origin fallback policy, and provide a concrete mapping for certificate installation/invalidation. Those are different obligations; only the fallback policy requires a product choice.

Reviewed DESIGN.md SHA256 `3a32ed88d4ccc9293685285629465f8a7d5b9e55400d266d119ef441938c33a0` (including the final symbol/carrier/framework clarification); SOURCE-READ-INVENTORY.md `eb15ebb46f4b7853bd867bb75050c5f1087832faad3c12e0faeaf51b05cc9416`; SEPARATE-FAILURES.md `9e75b6326d86e6d650db28f1f13b875ccd7130e1df0025893fbb3bc6f918150a`. Native checkout HEAD is `2dacae7b9e9137018d05c4e00382ac9287bc76d4`, clean when inspected. I read the review contract, relevant approved A0/aggregate clauses and exact source sites. I did not read FALLBACK-PREMISES.md or other new review verdicts. I previously authored the omission falsifier/review; no claim of independence from that prior work. No new execution, models, runtime edits or test edits in this review.

## Required clarification: an argument certificate is not callback completeness

The fallback table's “Complete native evidence, recipient-only coverage unavailable” class is safe only if completeness includes the origin of **all newly authored inputs**. It must not mean merely that the supplied updater argument has a complete native descriptor.

Concrete discriminator: with foreign p pending, compare undeclared `target(old => source.x())` with undeclared `target(source.x())`. The first has a fully describable native argument `old`, but its callback additionally reads pending source.x. Current native capture does not observe that consumption edge. Both remain unobserved-origin work unless an applicable complete declaration or separately authorized tracked boundary covers the extra input. They cannot differ merely because one uses updater syntax.

The later paragraph about the sixth wider-input case correctly requires both complete native evidence **and a complete application declaration**. Put that qualification into the table/routing rule. This is a concrete textual classification gap, not a request for arbitrary read tracking. Cheapest falsifier is that paired undeclared updater/direct-copy case; **not run**, as instructed. Do not infer its outcome from the previous declared native-input18 passes.

## Membership and cache premise

The omission explanation is source-supported. `private.ts:73–81` ignores nonenumerable dormant children. `utils.ts:368–398` deliberately observes retained dormant children for reactive invalidation while excluding their values from the returned object. Capturing all retained values instead would overstate the supplied input. The already-executed isolated omission falsifier remains decisive: independent sibling overwrite removes incidental p support, then absence-derived target 0 sends with declared basis while p remains pending. No new execution is claimed here.

A containing domain certificate plus retained responsible negative facts can describe never-present keys without allocating every absent string. Merely calling a counter a membership revision is insufficient: its proof must retain the dependent omission after an independent sibling edit. The proposal states that invariant correctly. It also correctly separates lifetime/occupancy from business-key spelling and preserves held old lifetime identity.

A concrete internal mapping is still needed for support-only changes on cached snapshots. `snapshot-authority.ts:76–99` caches a derived value, whereas equal support reauthoring intentionally may produce no public value event. Specify which existing installed unit changes the certificate, how a cache hit pairs its value with evidence for that exact view, and how old supported descriptors retain their original evidence. A certificate cannot simply be recomputed from whatever source proof is current when a saved snapshot is later reused. This is a representational/installation obligation, not a new public semantic decision.

The final text properly limits certification to native supplied arguments. Angular's `signal(read())` carrier and `peek: read` are separate (`observation-adapter.ts:24–37`); public carrier reads need not call the native reader. Native scalar derive independently chooses its supplied argument and ordinary before (`native-tree-scalar-leaf-runtime.ts:280–283`). Thus a hook only in snapshot construction or peek cannot establish general application read provenance. P/O mismatch must remain unavailable or explicitly described, as the proposal says. It cannot be repaired by relabeling the O ledger as proof of the displayed P argument.

Entity ids/all/count/activeEntity have different domains (`entity-signal.ts:1349–1394`, `3409–3458`). Sorted ids may additionally depend on row values; activeEntity reads selection and conditional occupancy. The inventory recognizes those differences and the absence of an existing publication consumption port. The matrix is a taxonomy/requirement, not proof that collection queries are now supported native inputs. No additional collection API or automatic query tracking approval follows from it.

## Fallback and wake decision

The literal/raw-copy indistinguishability claim is correct for the current target preparation boundary. The two writes may have identical target value/metadata while the raw read has no consumption token. A complete declaration can supply responsibility; a passive recipient cannot. “Hidden-input misuse” does not waive undeclared default-Link safety.

A fixed possible-owner window is a coherent policy option, but it is not native provenance. It imposes false-positive holds on unrelated undeclared literals and requires revision-bound wake/retirement. A later unrelated owner must not silently extend a fixed window. The design explicitly leaves that tradeoff and rejection/unavailability disposition unselected; it does not infer approval. Confirmation alone cannot answer whether a merely possible rejected owner must block forever or when a fresh surviving ordinary baseline is allowed. Approved surviving-write semantics do not supply that missing rule automatically.

The source wake diagnosis is independently supported: predecessor821 `project()` stores blocker cells but does not register an operation with them; `ownerWake` visits only `cell.dependents`. At2dacae the blockers are empty, allowing target-local fallback. The historical hold-without-progress and premature-send outputs are therefore distinct failures. A future hold needs a wake edge even with no value notification. This review performed no rerun and makes no new timing claim.

## Separate failures verified

The three membership controls collide with the exclusive private registration guard (`intrinsic-mutation.ts:337–349`) after permanent native registration (`private.ts:285`). Their assertions have not tested payload/refusal/retry on this candidate. Composing optional participants with native preparation, preserving throwing-preparation atomicity and native registration across participant release, is a separate internal-port obligation. Disabling native preparation for the test would not qualify it.

The mixed-undo source account is also supported. `tree-realization-adapter.ts:1440–1462` installs the selected points; line1515 publishes plans individually. `entity-signal.ts:569–588` publishes captured after-images with synchronous taps between rows. The unchanged witness verifies physical777/12 but historical output11/12. That is stale consumer chronology, not physical inverse overwriting777. The separate document correctly labels its source reconstruction rather than claiming an instrumented trace.

Any later chronology design must also cover invalidation callbacks before path publication (`tree-realization-adapter.ts:1465–1486`), not only the tap loop. Its existing controlled-invalidation acceptance requirement is therefore necessary. Neither absence certification nor rereading a whole physical row resolves that obligation; the latter can import inspection state. No callback-timing policy is selected here.

## Bounded conclusion

No contradiction was found in the proposed own-key/dormant/never-present/P–O observation contract after the final clarification. It explains what the native input description must contain. It is not yet a selected mechanism or complete fallback contract. Preserve the recurrence stop until the classification clarification, explicit fallback disposition and concrete certificate mapping are reviewed. Collision and mixed-undo obligations remain separate gates. Historical passes do not close any of these gaps.
