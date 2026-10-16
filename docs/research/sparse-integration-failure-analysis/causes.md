# Bounded first-divergence analysis

Candidate `9b9b0b35a7dd207df366047ef5c9621168a2b405`; baseline `8d220643e0d4e34cbdbc6e55e6ef692b25d5e023`. Runtime unchanged. Uses preserved final full-suite JSON and exact source. No full suites rerun and no assertions changed. `causes.json` preserves each of the **684 original pass-to-fail identities**, raw failure, source excerpt when available, provisional family and confidence. Eleven added tests are outside this count. The candidate has 685 failed assertions overall because one added regression also fails.

These are **not 684 causal diagnoses**, nor nine proven independent defects. Classification by first divergence is complete only for representative mechanisms; downstream cases remain explicitly provisional. The old 400-instance 'absent lifetime' symptom has not been promoted to 400 identical restoration diagnoses.

| Family | Original failed identities | Evidence status |
|---|---:|---|
| Native/sparse lifetime presence disagreement | 400 | Shared guard proven; missing restoration translation source-proven; each originating event not individually replayed |
| Missing member/branch/collection presence translation | 105 | Translation gap source-proven; cases grouped provisionally |
| Missing scalar notifier/owner invalidation publication | 14 | Missing channel source-proven and representative raw events corroborate |
| Downstream Link/publication | 34 | First cause unresolved; missing channel is a hypothesis, not blanket explanation |
| Disposition/refusal/recovery | 44 | Exact refusal changes preserved; first cause unresolved per case |
| Restoration follow-up | 35 | Independent current-truth bug proven; individual causes unresolved |
| Occupancy/identity follow-up | 8 | Rejection observed; first conflicting index change unresolved |
| Fixture/policy assumptions | 6 | Source-established expectation mismatch; assertions remain unchanged |
| Other unresolved | 38 | No demonstrated first divergence |

## 1. Current truth: scalar restoration

Independent review's unchanged ordinary-input probe is decisive: x=1; undoable x=2; undo ->1; transact x=3; rollback -> baseline1, candidate2. No pending owner at undo and no fault injection. Preserved final logs: `../st-sparse-integration-20261016/review/restoration-final.log`, baseline counterpart and `FINDINGS.md`.

First divergence is **undo installation**, before later rollback: native scalar becomes1, sparse committed base stays2. `sparse-adapter.ts:58–60` seeds each scalar only once and subsequently accepts terminal record captures; lower-frame restoration does not call that terminal hook. Settlement at80–86 trusts model targets. This is neither rollback-order corruption nor application native computed staleness. It is an uncovered current-state writer. This external probe is NOT counted as another Nx identity.

## 2. Current truth: lifetime revival omitted from translation

`physical/entity-mutation-frame.ts:65–90` includes `restore-subject` as a distinct instruction preserving subject identity. `entity-signal.ts:576–590` translates only replace-value, create-fresh-subject, tombstone-subject and transfer-key. **There is no restore-subject branch.** A frame can restore the native subject without generating the sparse presence transition. `sparse-adapter.ts:64–69` then reuses its subject-to-ref mapping; core497 rejects any non-add operation on an absent ref.

This is different from merely retaining too little metadata: keeping the mapping does not make its associated ownership presence true. Creating a fresh ref would incorrectly change lifetime semantics; this analysis proposes no such repair.

The 400 raw stacks split into260 restoration planRemove failures (`tree-realization-adapter.ts:1174`),109 ordinary removeOne failures (`entity-signal.ts:3063`),17 point value replacement failures (`1198`),14 other entity routes. That split identifies **where divergence is detected**, not necessarily where created. The same tested scenario may be replayed across enhancer orders/frameworks. Need per-scenario chronological traces to assert all400 share omitted revival; no such claim is made.

Representative unchanged test: `restoration/add-many-overwrite-hardening.spec.ts`, changeId then overwrite under new key, undo/redo/undo. New public regression: restoration history retains an absent lifetime, undo restores it, redo errors `Referenced lifetime is absent` (excluded from684 original counts).

## 3. Unsupported translated facts: omission and reactivation

The adapter at58–74 records a scalar position/value and entity adds/removes/fields/keys/ranks. At80–84 it installs scalar slots and entity deltas. It has **no branch/member-presence or collection-omission installation plan**, although native storage can remain allocated while semantic membership is absent. Thus a scalar value alone cannot represent these operations. The model's optional scalar presence machinery does not help when adapter scalar capture always emits only `{kind:'set',path,value}` and native install always `frame.set`.

Existing `lib/absent-path-write.spec.ts:15–30` records the deliberate contract: writing an absent descendant reactivates its path while siblings remain absent, and dormant storage must not supply reactivated value. A rollback restoring old scalar contents without restoring membership is insufficient. Unchanged absent-path/absent-collection/designated-collection-omission assertions fail in all four frameworks; this is not an unsupported observation API.

The105-family grouping includes downstream omitted-collection restoration/refusal cases. Those have not each been reduced to the same missing fact; raw failures and provisional status remain in JSON.

## 4. Publication: location publication is not the complete event protocol

Sparse settle86 invokes entity plan publishers and `slots.publishPrepared`. `tree-scalar-leaf-runtime.ts:56–66,197–198` publishes location bindings. The former realization path separately calls `getPathNotifier().notify` with before/after, owner/position and realized write metadata at `causal-runtime/tree-realization-adapter.ts:1235–1263`, then `markOwnerInvalidatedFrom` at1267. Sparse scalar settlement omits both. The unused old rollback wrapper also called owner invalidation (`transactions.ts:2791–2812`).

Representative raw failures:
- `owner-invalidation.spec.ts`: expected deliveries[1,0], got[1].
- `path-notifier-attribution.spec.ts`: expected two rollback events, got[].
- `link-reactive-settlement.spec.ts`: notifier-authored downstream hops remain7 after source rollback instead of0.

First divergence is absent mutation delivery after physical rollback, not stale application-owned computed during a grouped write. Reactive slots may be coherent while these other public consumers miss the event. The14 direct-family assertions corroborate missing channels. Another34 Link/persistence cases may additionally involve scope release/order, held-send cancellation or stale ownership; they stay unresolved rather than inheriting one convenient explanation.

## 5. Refusal, errors, identity and fixture assumptions

44 refusal/recovery cases and8 occupancy cases remain per-case unresolved. The old realization validator is bypassed by sparse settlement; tests injecting failure into that old port can lose their injection route. That does not itself authorize removing the tested error/recovery contract. Likewise an original expected refusal may represent dependency safety, not merely incumbent inability. Keep exact thrown-value identity, pending authority and retry assertions unchanged.

Six source-established expectation conflicts are distinct:
- Two `r8-overlap-0` tests explicitly demand safe conservative refusal. Their header calls this containment, not completion of surgical R8 behavior. A useful new settlement can conflict with that assertion, but acceptance still needs independent final-state checks and owner-approved expectation review.
- One descriptor-retention test assumes no physical sink; new reclamation changes instrumentation.
- Three retired-backing fixtures invoke a tombstone-only helper after native forgetting, so helper precondition fails. This does not on its own establish reference retargeting or reclaiming a live obligation; those require their own tests.

A seventh potential event-representation difference (`entity-membership-view-v16-controls`: prepend expects add+reorder, candidate emits add) was intentionally left unresolved. Equivalent end-state replay may be possible, but this analysis did not prove consumer equivalence and did not relabel a failure as harmless.

## Missing evidence and decision limit

The evidence identifies uncovered writers, omitted state facts and incomplete publication channels before architecture/performance claims can be accepted. It does not determine whether adopting a complete authoritative sparse root or retaining native truth with pending-only records is cheaper or safer. Nor does it show that400 guards reduce to one defect. A next bounded diagnostic trace, if authorized, should log the first native/sparse state discrepancy per representative scenario, not patch tests at their assertion sites.

Replay analysis (read-only): `python3 /private/tmp/st-sparse-failure-analysis-20261016/cluster.py`. Input file SHA is embedded in `causes.json`; no new runtime verdicts were manufactured by this classifier.

## Executed publication boundary reduction

`publication-replay.mjs` preserves the existing `owner-invalidation.spec.ts` pending-turn/compensation sequence and its two assertions `[1]` and `[1,0]`, adding a PathNotifier listener and phase-only trace. Baseline exit0, candidate exit1. Both transact calls deliver path1 inside transaction; owner1 arrives during the following flush. Both rollback returns read direct0. During the identical eight-microtask flush baseline then emits path0 and owner0; candidate emits neither. The final original `[1,0]` assertion fails on candidate `[1]`.

Thus this representative divergence occurs at the event-publication boundary despite correct physical rollback. Source identifies the missing channel described above. This is a paired standalone source bundle probe, not a rerun of the entire Nx file, and does not revise suite counts. It does not establish that all Link failures have the same cause.

Exact commands (Node24.15.0):

```
node /private/tmp/st-sparse-failure-analysis-20261016/publication-build.mjs
node /private/tmp/st-sparse-failure-analysis-20261016/publication-replay.mjs baseline
node /private/tmp/st-sparse-failure-analysis-20261016/publication-replay.mjs candidate
```

Raw phase traces and assertion error: `publication-baseline.log`, `publication-candidate.log`. Runtime source was bundled unchanged from exact baseline and sealed final snapshot; no runtime mutation or instrumented implementation was used.
