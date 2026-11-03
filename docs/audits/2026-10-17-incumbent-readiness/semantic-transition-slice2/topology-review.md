# Independent topology/identity review

Reviewed native entity topology planning and complete-target realization, not the transaction/restoration consumers I authored. No runtime changes. External probes were bundled once against the frozen candidate; no Nx or broad suite executed by this reviewer.

## Primary interpretation: rekey into inspected ordinary vacancy

Sequence: ordinary old A7 and B8; inspection removes A; pending transaction rekeys B to A; reject transaction. The unchanged old A lifetime/value must return at A and B must return at B. This follows from the approved ordinary-topology-within-authored-footprint rule, not an inference from implementation output. `semantic-transition-plan/README.md:134` W5 explicitly describes key authorship and key occupancy, while excluding implicit field/order adoption. Source/destination occupancy are authored by rekey. The prior ordinary occupant A therefore belongs to that occupancy footprint. Its unchanged value and identity are required restoration facts, not a proposal to adopt incidental inspected payload. The owner-approved C2 test in `entity-semantic-topology.spec.ts:28–38` already establishes preservation/restoration of the ordinary occupant behind inspected vacancy for same-key replacement.

This does not require another payload semantics decision. The existing physical occupied-destination guard remains valid; the case is physically vacant and ordinary-occupied. Restoring old A and B does not waive that guard.

This is an implemented path: `entity-signal.ts:754–767` prepares transfer-key responsibility and sends it through the generic `prepareOrdinaryTopology`; lines649–652 explicitly handle rekey. The latter records the source ordinary key but does not consult the displaced destination index. That index is consulted only in the separate add/existence-adoption branch at638–644. Thus the omitted ordinary occupant is a missing fact in the claimed migrated W5 admission mechanism, not an untouched later writer.

Raw sibling evidence supplied by parent/reviewer: `review/rekey-vacancy.ts` and `.log`. The log shows rollback completes with only B restored, old A missing. I inspected the raw result and independently adjudicated the premise; parent separately reproduced execution. This is stronger than my safe-refusal case below and sufficient to block this implementation.

## My independent executable probes

Files: `retention-review/witness.ts`, `build.mjs`, `bundle.mjs`, `first.log`.

- PASS: C2 confirmation establishes fresh A; later field rollback restores fresh value99, old handle remains detached.
- PASS: inspection removes old A, creates/removes another A lifetime, then transaction creates third A; rollback restores exact old handle/value7 and both newer references stay detached.
- PASS: inspection replaces old A with new A; transaction field-writes that inspection lifetime; rollback restores exact old A and detaches the inspected replacement.
- FAIL, distinct safe refusal: inspection rekeys old A to B, transaction adds fresh A, rollback refuses `Subject 1 is already active in owner 2`. Physical state remains B plus fresh A. Preparation recorded remove-old/add-fresh ordinary responsibility, but its inverse attempts to add the old lifetime that remains physically active at B. This is unavailable compensation; do not describe it as successful state corruption. No failure weakening or repair performed.

The last case also traces to the authored ordinary footprint versus physical topology join. Its representation needs an appropriate active-lifetime transition rather than assuming every ordinary removed lifetime is physically tombstoned. It remains secondary to the proven successful omission above.

## Retention: what is established and what is not

`entity-ordinary-topology.ts:10–20` retains sparse divergent identity and displaced-key entries. Present ordinary topology is a live obligation while inspection removes its physical member; `entity-signal.ts:2714` correctly prevents no-owner retirement from dropping such an obligation. The passing repeated-lifetime and confirmed-C2 probes establish useful identity/recovery behavior in those cases; they are not heap/reclamation measurements.

Source-only cleanup concern: the inspection branch (`entity-signal.ts:622–626`) retains `{present:false}` even when an inspection-created subject is subsequently inspection-removed, leaving ordinary and physical absence aligned. `EntityOrdinaryTopology.clear()` at24 has no production call site in this source. Neither the retirement loop at2705–2728 nor the target realization path supplies a general removal of these obligation-free false entries. This identifies an unqualified cleanup path; no retained-count/GC probe was run, and no numeric leak claim is made. A teardown/retention qualification would still be required even without the correctness blocker. Do not conflate the live present-ordinary obligations with this possible obsolete-absence retention.

## Exact execution identity

Source fingerprint supplied by parent: `69de6f8dd1f4327932b12f57cc661837ec60fdb5d6cabba14ade920d7c9e5134`.

SHA256:
- witness.ts `84472961e883cbdc2e4ddbda33b302b061dbcb356ade0eaf9c788bd8aee8ba9e`
- bundle.mjs `61f84d18d2cab8a56024e963a02a794732b6afad46c9b635c187cbffeba6e126`
- first.log `4743074f2d5612e3c24ff8d4157dea9100e0c8ca79f182d26ecc2679d489a266`

Replay (Node24.15.0): `node /private/tmp/semantic-transition-slice2/retention-review/bundle.mjs`. Rebuilding uses `build.mjs` and therefore requires preserving the source fingerprint. No further repair is recommended inside this review; the parent has stopped at the recurrence boundary.
