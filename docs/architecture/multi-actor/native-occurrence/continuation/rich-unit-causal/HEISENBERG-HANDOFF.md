# Frozen rich-unit causal evidence for joint phase design

Read-only follow-up. No tests rerun, no runtime/test edits, no broader suites. Failed rich-unit remains frozen at manifest `55ba1e3bb29ac66f1a493e196cee9b68853fa8ad30ac7067a7ea8e280bf871f5`, runtime patch `22a4c7349fb65d1ba348058eb557516480b584394708724581385f6ac969df4d`. Candidate root: `/private/tmp/st-rich-unit-successor/candidate`. Scalar review is separate SNAPSHOT-A work, not integrated with this combined-B candidate.

## Classification

| Tests | First causal boundary | Consequence |
| --- | --- | --- |
| Rich committed capture (1) | adapter 1618 calls structural complete before 1619–1620 read-model invalidation | Physical rows 11/12, cached all() 50/60 during observer |
| Private source completion (1) | adapter 1600 ordinary install -> entity-signal 1025 source complete | Callback occurs within installation, before shared clock advance and invalidation |
| Unchanged live-rekey-dependent tests (10) | adapter 1570 unconditionally requires preparedContext subject | Refusal during planning, before new install; not a delivery-order failure |
| Unchanged restore-planning fault injection (1) | test patches old __planRestore().commit; new grouped route does not invoke it | Expected injected failure never occurs; not proof of atomicity or a new public error contract |

The two focused failures recur from the baseline falsifiers, not newly invented oracles. The eleven are failures of unchanged fixtures, not a claim that eleven were inherited before this experiment. Exact eleven unique identities are in FAILURE-IDENTITIES.json; repeated soft-assertion log sections are not extra tests.

## A. Rich observation: actual stores vs derived reads

Frozen adapter install 1584–1602 commits scalar, structural source units, live point plans, ordinary plans, then advances shared clock. In invalidate, structural `complete()` precedes all structural/live-point invalidation. Entity-signal 1555 drains rich observers in that complete method.

Separate already-recorded diagnostic copied frozen runtime and changed only test instrumentation. Raw read-boundary records all() = [50,60], direct rows = [11,12], leafA = 11. Stack reaches entity-signal 1555 through adapter 1618. Final value = [777,12], so the callback's nested truth survives; readable coherence remains false. This does not demonstrate a missed physical write.

## B. Completion: a different, earlier path

Correction to the earlier RESULTS.md causal generalization: completion's successor stack is `EntityPublicationSource.complete` -> entity-signal **1025**, ordinary-plan `install` -> adapter **1600**. It is not the rich observation's entity-signal 1555/adapter1618 path. `prepareOrdinaryRealization` installs transitions, placement and terminal record, then invokes source completion inline. Later ordinary plans and the shared clock may still be pending. The exact test sees left restored and right cached50/60.

Raw completion.jsonl contains two preserved records: first before-runtime stack at old entity-signal1471; second first-runtime stack at1025. They share an append path from the earlier run setup; identify by stack, not by assuming both belong to frozen source. No records were rewritten. The independent direct-row diagnostic was for rich observation; direct-row values for the completion test were not separately measured. Source order shows livePointPlans.install precedes this completion, but do not substitute that inference for a second measurement.

Point plan `invalidate()` itself also calls entityPublication.complete at entity-signal676 before advancing row epochs and updateSignals at677–681. Thus swapping only adapter's structural complete loop is insufficient as a source-level argument. Structural invalidate567–580 also contains synchronization and active-id replacement; the joint design must classify which operations can deliver/reenter rather than assume every method named invalidate is callback-free.

## C. Preparation composition defect: ten tests

At adapter1431–1453, a live rekey legitimately has no preparedContext subject and uses source `__planRekey`. Context.resolveSubject271 only reads its stored map. rememberRekeyedSubject223–230 returns if there is no stored entry. New structural grouping1561–1575 requires the entry anyway. This is **missing source-resolved recipe transport**, not evidence that mutating an existing context entry deletes it. Earlier shorthand suggesting all failures arise from a rewritten context was too broad.

Affected: paired inspection rekey scalarFirst=true/false (2); complete ordered remove then rekey (1); pending-rekey rollback preserves later same-subject field (1); heterogeneous draft abort (1); adapter subject identity, scalar+rekey coherence, causal silence, stale-unit refusal, shared-revision mixed commit (5). All hit the same missing-subject prerequisite. The stale-unit test's expected stale error is masked by that earlier failure; do not count it as demonstrated stale admission or preserved safety merely because it throws.

Required input to joint design: carry exact source-resolved structural recipe from first preparation; compose same-source occupancy in order, including vacancies/rekeys/fresh restoration and dependent anchors. Do not reconstruct authority from physical rows or add a fallback waiver. Preserve value transitions alongside staged placement so separately prepared Map replacements cannot overwrite earlier changes. Existing two-restore passing control does not prove all these composition cases.

## D. Fault-injection seam (one)

Adapter spec1154–1176 replaces old __planRestore().commit with a throwing function and expects applyAtomically to throw. Grouped source unit installation no longer calls that closure. The unchanged test therefore does not inject its failure. Preserve it as historical failure; future qualification needs an equivalent preparation fault at the actual source-group boundary and all-state/history/no-delivery assertions. This report does not change its oracle or waive the underlying safety requirement.

## Scalar independent review: separate pre-store phase gap

Read `/private/tmp/st-scalar-frame-publication-independent/REVIEW.md` in full; raw copy/hash retained. Review disposition is changes required. Scalar manifest e9b1555e1c2f49f1dfd5b26aa56cae20b22afa9d8d386c32f32091d46a8590a6.

Scalar prepareSlots207–224 sequentially prepares each source. intrinsic-mutation311–326 finalizes each source immediately (322). A later sibling preparer opens a real foreign pending transaction without advancing this frame's revision. Earlier requirement is already clean/finalized; later requirement retains pending owner. Independent raw observation: first unknown=false/possible=[], second unknown=true/possible=[owner2 pending]. Earlier-sibling control retains the owner in both. This is reported review execution, not a rerun by this task.

The joint mechanism must retain unfinalized per-source units until **all callback-capable preparers in the owning unit** finish, then finalize before stores with required revision validation. Re-finalizing a cleared proof is not sufficient (lifecycle155–166 clears inputs/known outside frames). Rich source preparation also calls finalize at entity-signal1525; selected point preparation at652 and ordinary install at1016 have different current positions. These are concrete integration sites, not permission to change owner semantics.

## Requirements for Main's concrete joint review

1. Preserve exact prepared responsibility, immutable observation payloads and sequential private witness folds; no generalized overlay inferred from these failures.
2. Define whole-unit callback-capable preparation, finalization, revision validation, installation, read-model invalidation and delivery boundaries explicitly across scalar, structural, selected point and ordinary plans.
3. Completion inside ordinary install must be separated without abandoning its terminal-record installation or remaining plans on error. Read-model invalidation must precede arbitrary reentry, including completion hidden inside point invalidation.
4. Preserve post-install error identity/draining and nested newer truth. Scalar review's exact sentinel/drain positives remain constraints, not grounds to accept its finalization defect.
5. Keep source recipe composition separate from phase ordering: delivery deferral cannot fix missing rekey context, and fixing recipe transport cannot fix stale all() or sibling-window proof gaps.
6. Retain all three original falsifiers, negative controls, ten rekey-dependent controls and meaningful atomic fault injection. No test changes or repair authorized by this handoff.

Raw logs, observations, review and input hashes are under raw/ and INPUTS.json. No directly identifiable Heisenberg task/channel exists in the available app inventory; this is the file handoff for Main to relay, not a claim of direct delivery. Main reviews the concrete joint mechanism before any successor correction.
