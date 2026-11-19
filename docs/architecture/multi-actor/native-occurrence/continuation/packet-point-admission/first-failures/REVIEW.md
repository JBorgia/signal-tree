# Independent packet admission/refusal implementation review

Disposition: **changes required before bounded semantic integration**, for one concrete deferred-refusal bookkeeping gap. The direct frozen-shell correction is justified and its supported-input precedence controls pass. The separate unchanged cost gate remains failed; no performance acceptance is given. This is not a public API rejection or a claim that the new counterexample is reachable through an ordinary public producer.

## Identity and execution isolation

Author manifest `872d18d5b66200e6f8254c0c0ee318eb2f2bfd30b7eefff6a0f6efcdb5f4496c`; final branch runtime patch `6086211ecf96ec46d3b07edff8e3e41677b246cb7d985dace86f969ceb05928f`. Base is frozen packet-index-admission R1, manifest `9863ad3f6955407e79e2663c4060f505b5f71c6f49cd96bc6e492335b09cd464`. The branch delta is one runtime edit; review also inspected R1's full admission/index mechanism and actual producers.

Fresh execution copy is candidate/ beside this report. VERIFICATION.json checks all author-manifest source files in both author and copy and all FREEZE artifact hashes. Only two independent specs were added to the copy; runtime and original tests remain byte-identical. Existing first failures were copied to author-preserved-first-failures/. The unchanged prior independent producer fixture was replayed from raw source, without relying on its previous review verdict.

## Finding: a caught refused first fragment leaves an empty source group

`packages/kernel/src/lib/internals/entity-publication.ts:201–212` creates and registers a PointPreparation group before `this.admission.prepare(packet)` runs. The new frozen-shell rejection can throw there. If the grouping body catches that rejection and returns, the group remains registered with zero packets.

`withEntityPointPublicationPreparation` at318–320 subsequently spreads the nonexistent first packet into a fabricated empty aggregate, invokes `state.source.prepare`, and calls recipient preparation. The source group should never have represented admitted work. This violates the stated “refuse before native/responsibility/recipient preparation” boundary for the deferred source path even though immediate prepare and uncaught deferred refusal correctly abort.

Executed discriminator, preserved in `candidate/packages/kernel/src/lib/independent-refusal-branches.spec.ts` and refusal-final.log:

- Subscribe one source participant whose prepare increments a counter.
- Enter `withEntityPointPublicationPreparation`; call preparePoint with a frozen edit containing a borrowed mutable fields array; catch the exact expected rejection inside the grouping body.
- On grouping closure, callback count is1, expected0. Source rows remain0 and the borrowed fields stay mutable. No store installation or public endpoint leak is claimed.
- Uncaught refusal control passes with no callbacks and unchanged borrowed descriptors.
- Caught refusal followed by one valid same-source fragment passes with exactly the valid packet prepared once.

The private grouping body currently has no poison/abort state that rejects the whole scope after a caught fragment error; silently preparing an empty source is not such a contract. Narrow correction: complete fragment admission before publishing its source group into the operation-local map (or explicitly remove a newly created empty group on admission failure). Preserve already admitted valid fragments and callbacks for genuine accepted packets. No runtime edit is supplied here. A generic scheduler or broader public contract change is unnecessary.

## What the frozen-shell correction does establish

AdmissionMetadata.edit:56–69 now rejects a separately frozen edit with a mutable non-null field-name array or mutable structural descriptor, rather than freezing borrowed metadata. The refusal occurs before native, responsibility and recipient preparation on the immediate path. The seven author tests replay successfully, including exact descriptor equality and payload/endpoint/proof mutability.

Mutable source-issued edit shells retain their literal identity, copy shared field/structural metadata before sealing, and transfer their private membership arrays. Frozen shells with already stable nested shape are accepted. Packet/step/order shells are copied and frozen as applicable. Payload values, nested caller payload arrays, restoredFields Maps, endpoint objects and requirement cells are deliberately not deep-frozen. Shallow Object.freeze is not a general hostile-accessor/proxy sandbox; the inspected producers are private data records. This review does not extend the accepted packet contract to arbitrary executable metadata.

The packet/edit types are private and were not found in the public index.ts/adapter.ts export surfaces. Actual source producer replay observed26 distinct edits,15 structural, none already frozen at first source admission. Field writes, rollback fragments, structural remove/restore and prepend controls preserved borrowed descriptor mutability and exact edit identity. Source inspections at entity-signal's prepareEntityPublication call sites corroborate mutable source-created records. This supports the bounded private input restriction; it is not a universal survey of every possible custom private producer.

The unchanged historical precedence test's frozen shell contains a mutable structural descriptor and is now deliberately refused. Its new red is an explicit accepted-private-shape change, not evidence that supported precedence was repaired by weakening the original. The original stays untouched. The supported companion supplies stable nested metadata and verifies proposed11 < selected8 < exact restored5 endpoint precedence. The old independent ownership diagnostic likewise now fails because the unsafe side effect it described is refused; that is an expected diagnostic difference, not a second new blocker.

## Whole indexing mechanism

The ordered ordinary helper retains step array order, same-step authored-removal dedup, duplicates and tombstones. The per-prepare subject→last-edit lookup preserves the previous reverse-find proposal semantics, including rekey-last and omitted-field cases; the singleton branch is a local equivalent, not a cross-revision cache.

Per-edit restoredFields is read before selectedFields and then proposal. Literal edit identity remains the key for forEdit support. Repeated step/edit aliases, duplicate subjects, nonmonotonic ordinals and the empty-steps override are covered by unchanged passing controls. Deferred support retains admitted membership and original proof references after later source retirement. Private mutation attempts now fail at the frozen boundary or return false rather than altering admission. Source revision/enrollment checks still reject preparation/finalizer reentry while preserving independently installed newer facts.

These positives do not close the empty-group refusal path above. Nor do they imply the three unrelated structural-sequence failures have been repaired.

## Independent results

Pinned Node24.15.0/pnpm10.17.0; Nx kernel tests with --skip-nx-cache --maxWorkers=1, NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_TUI=false. Exact selection command is in replay.sh (78 tests across10 selected files). No external reviewer CLI or runtime mutation.

| Run | Result |
| --- | --- |
| replay78.log | 67 pass / 11 fail, matching the author's named set |
| independent-first.log | 7 pass / 2 fail: one expected obsolete ownership diagnostic, one new caught-refusal finding |
| refusal-final.log | 2 pass / 1 fail; adds valid-followup control |
| point-first.log | unchanged point gate fails:15,800 visits versus <2,000;9 skipped |
| source-types.log | source types pass |
| spec-types-final.log | final added tests pass existing ratchet; no baseline edits |

The preserved11 consist of the new explicit frozen-input refusal, seven older private-mutation expectation/diagnostic differences, and three inherited structural-sequence failures. No original was removed or reclassified as green. producer-observations.jsonl records the actual producer/proof observations; first-refusal-fixture.spec.ts preserves the original two-control counterexample before the valid-followup control was added.

Minimal independent failure replay:

```sh
corepack pnpm nx test kernel --skip-nx-cache independent-refusal-branches.spec.ts --maxWorkers=1
```

Point replay:

```sh
corepack pnpm nx test kernel --skip-nx-cache entity-granular-reactivity.spec.ts --testNamePattern='a single-entity update does not rebuild' --maxWorkers=1
```

Working directory is this report's candidate/. Original failure stacks and assertions are in the logs. No allocation suite, full kernel/framework integration, public packaging/release, GC or performance qualification ran. Author source remains unchanged. After the narrow refusal correction, bounded semantic integration can be reconsidered independently of the still-failed cost ceiling; this report does not pre-accept that successor.
