# Optional target preparation — exact implementation review

**Bounded acceptance by source inspection: no semantic regression found in the supplied extraction.** This is a partial import-boundary split, not proof that all full-target machinery is absent from collection-only output. Tests, types and builds are being run by the owner; no success is assumed here.

Baseline verified clean at `f962e9038838570912545d11f48c4251537979e3` in `/Users/jonathanborgia/.codex/worktrees/capture-point-owner/signaltree`. Candidate is the non-Git archive `/private/tmp/signaltree-optional-preparation-20261014`. Compared the kernel source trees: only the three implementation files and two identified direct-binding specs differ. No edits, tests, builds or benchmarks performed by this reviewer; this report is the only write.

## Exact preservation

- **Preparation:** the extracted body retains the owner check; current subject/selection capture; entity-value validation and deep cloning; structural then value target preparation; affected-subject, neighbor, epoch and weak-facade capture. Host construction adds only ordinary field reads/references. All destructured functions were closure functions already, and store/notifier methods retain their receivers. No new equality, cloning, callback or observer is introduced by host construction.
- **Selection:** selected subject follows its prepared new key; otherwise the selected key is retained, including absent/removed subjects. Selection changes remain after structural/value installation and before membership close. Publication still does not restore selection, so later replay-tap selections survive.
- **Installation:** exact order remains membership-open → structural target → retained values → selection → membership-close in finally. Membership-open itself remains outside try, as in the baseline. No new transactionality, revision check or single-use guarantee is introduced.
- **Dynamic membership:** the host defines `get membershipTap() { return membershipTap; }`; the extracted algorithm does NOT destructure this property. `install()` reads `host.membershipTap`, then retains that same local tap for open/close. A reader attached after preparation is therefore seen at installation, and replacing the tap during installation does not mismatch the close callback. Snapshotting this field at host construction or destructuring it would have been a regression; the candidate avoids both.
- **Publication:** epoch advancement, facade binding invalidation, `updateSignals`, optional physical revision advancement, per-subject notifications and add/remove/update taps remain in their original order. Structural metadata, realized/system classification, unchanged-row silence and no rekey lifecycle tap are preserved. `publish(options)` retains the same option evaluation and failure behavior; no catch/retry behavior was added or removed.
- **Reentry/failures:** application getters during clone, membership callbacks, selection publication and replay taps retain their original positions. Environment members other than membershipTap are stable references; positionId is read when preparing, and this binding is only created when it already has a position. The original algorithm did not contain a general prepare/install stale-revision or single-use guard; the extraction preserves that existing limit rather than establishing stronger safety. Outer installation/publication ordering and completion notification in `prepareDeclarativeTransitionInstallation` are unchanged.

## Callers, types and public surface

The production collection-binding call in `target-transition.ts` now supplies `prepareEntityTransitionTarget`. Other production binding uses found in transactions, restoration, membership and state-location inspection read ownership/source data; they do not invoke an unadapted one-argument preparation call. Both direct internal-binding specs add the required preparer argument. Their assertions and scenario bodies are unchanged beyond import/signature/call plumbing. No additional direct calls were found in the searched tools/research scripts.

`CollectionTransitionTargetBinding.prepareTarget` intentionally changes its **internal** contract from one argument to two required arguments. A stale direct internal caller would fail (`prepare` is not a function); there is no default preparer. This is not a new public collection method or adapter requirement: the binding and new host/preparer types are not re-exported by kernel root, adapter or internals barrels, and the package does not expose a wildcard deep-import path. Existing fake bindings that ignore the extra argument need not implement the generic algorithm themselves.

`EntityTargetHost<E,K>` preserves typed stores, key/value parameters, epoch/location types and typed lifecycle arguments; no `any` escape was introduced. The generic function type is carried by `EntityTargetPreparer`. The dependency from the new algorithm back to target-transition is type-only, so this pairing creates no runtime import cycle. Type-check success remains unverified by this review.

## Optionality: what is and is not established

`entity-signal.ts` imports the binding/target types only and has no value import of the new algorithm. Its persistent hook supplies the physical environment to a consumer-provided function; the environment object is allocated when preparation is invoked, not for every ordinary collection write or construction.

`target-transition.ts` value-imports the algorithm, and transactions/restoration import that consumer. Thus the extraction removes the direct runtime edge from collection implementation to this high-level planning/publication body. It is consumer-import optionality, not runtime lazy loading or an optional argument once the hook is called. A bundled consumer that retains declarative preparation still requires the algorithm.

The resident hook/readSource, physical stores, StructuralStore.prepareTarget/installPreparedTarget and EntityValueStore.prepareTargetValues/installPreparedTargetValues remain. Existing per-effect/point realization and publication support also remain. Calling this removal of *all* target-preparation machinery would be false; no emitted bundle exclusion or byte saving is established by source inspection.

## Falsifiers that matter for owner validation

- Attach a membership reader **after prepare and before install**: one balanced open/close and the correct delta; replace the tap during open and confirm the captured tap receives close.
- Selected subject rekey/key swap; selected subject removed; selection authored by a replay tap must survive publication.
- Prepared target clones remain detached; held subject facades follow lifetimes through reorder/key swap; owner mismatch and invalid target reject before installation.
- Mixed collections/scalars/plain-member targets: all installation completes before delivery; hidden collection compensation stays hidden until the existing membership target re-adds it.
- Throwing/reentrant membership or publication callbacks, including `throw undefined`: preserve baseline completion/refusal behavior, not a newly inferred guarantee.

Existing carriers include `physical/declarative-target-binding.spec.ts`, `enhancers/restoration/designated-collection-omission.spec.ts`, `entity-membership-capture.spec.ts`, and `membership-declarative-delivery-v16-controls.spec.ts`. The two edited files alone do not explicitly establish the late-attached membership-tap case. No test outcome is claimed here.

Reviewed SHA-256:
- entity-signal.ts: `8e948600adbe8610850aa681fa74f4377b5c97ab2c6d87159b195348d26d8186`
- prepare-entity-target.ts: `bf4c4ef10c5f4f3ccb50dfff250745e880a5c36e38c79c215bceb1eb8078be37`
- target-transition.ts: `369fdac7fe0471215708011f4d5510c94771a535db58e238e59c609b2cacb45f`
