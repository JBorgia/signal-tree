# C11 per-unit physical pairing index: independent-review handoff

Candidate only, ready for independent source/semantic review. This is an existing lookup algorithm correction, not a new publication authority. No root, frozen C11, presence candidate, export, activation, production revision, or release/work ceiling was changed. The original direct-import clear 2N bound remains unchanged and failing at 2N+1.

## Exact base and patch scope

Base `/private/tmp/st-native-combined-c11/SNAPSHOT-COUNTERPARTS.json`, SHA256 `dc21671bf92e2a74bd5798bfccfbc0b02d13e58dff4fe328758fd604d9f70148`, 3045 verified files. Two owned copies: predecessor (unchanged runtime) and candidate. Both use the pinned working dependency tree via an owned-review symlink; Node24.15.0, corepack pnpm10.17.0, Nx kernel targets, NX_DAEMON=false, NX_ISOLATE_PLUGINS=false, NX_NO_CLOUD=true, CI=true. SETUP.json records provenance.

Only runtime difference: packages/kernel/src/lib/experimental-publication/entity.ts. Three new test files cover work, pairing semantics, and singleton Map allocations. RUNTIME.patch and TESTS.patch separate those changes; FROM-C11.patch combines them. SNAPSHOT-PAIR-INDEX.json plus FREEZE.json identify exact final sources and patches. The predecessor baseline files remain byte-identical; all other candidate baseline files remain identical.

## Mechanism and preserved rules

Previously every admitted ordinary edit searched its physical array with Array.find. A root-import rollback of n cleared rows supplies n ordinary/physical edits in one unit, producing n(n+1)/2 pairing predicate visits. Direct implementation imports do not load the root publication factory and hide that work.

The private module-local helper pairs one admitted unit at a time. For repeated lookups in a multi-physical-edit unit, it builds one Map from subject to the **first** physical edit identity, then performs lookups. The Map is temporary to that call; no source, recipient, proof, lifecycle, or history cache is introduced. No row payload, getter recipe, responsibility, completion, or requirement logic is moved into the lookup.

Preserved details:
- First physical match wins within each step, independently of the existing last-ordinary proposal lookup. Duplicate ordinary edits keep their original identities and order.
- Each explicit step gets its own lookup. Repeated/nonmonotonic ordinal values are not sorted or merged. Packet-wide physical membership is never substituted for missing step physical membership.
- Authored removal is paired after step ordinary edits, exactly as before. Existing entityPublicationOrdinary dedup/tombstone logic is untouched.
- The existing paired Map is keyed by ordinary edit identity. A later matching step may overwrite an earlier mapping for the same identity; a later missing match does not delete the earlier mapping.
- Absent steps means one packet unit; an explicit empty steps array suppresses the fallback.
- The Map's SameValueZero treatment of NaN is guarded so the old strict-equality no-match behavior is preserved. This is defensive source inspection, not a newly supported subject-id domain.
- A single physical edit uses direct strict equality; a single requested edit with a longer physical array retains one Array.find. Singleton point units allocate no additional lookup Map/array/closure. Empty units allocate no lookup map.

Admitted metadata is source-owned and stable (entity-publication.ts AdmissionMetadata freezes edit shells and list membership). The optimization changes metadata lookup work only. Per-unit asymptotic lookup work is O(P+O) for indexed units, O(P) for one requested edit, O(O) for one physical edit. This is not a claim that all preparation/rollback is linear, or that indexing improves every small/skewed unit's constant cost.

## Preserved unchanged falsifier and final results

Root-import clear rollback, exact same final test source on both copies:

| Rows | Predecessor pairing find visits | Candidate pairing find visits | Candidate total find visits |
| --- | ---: | ---: | ---: |
| 32 | 528 | 0 | 65 |
| 256 | 32,896 | 0 | 513 |
| 1024 | 524,800 | 0 | 2,049 |

The test checks empty state after clear, rollback success, exact restored row order and full values, count, first/last row values, and a subsequent useful update before its count assertion. Thus all three original failures occur at the measured pairing-work discriminator after useful behavior succeeds. This is a local algorithm regression assertion, not an edited release budget. Predicate totals include the unrelated placement chain-head scans, which are not removed.

The initial raw failing source is WORK-FIRST.spec.ts, with predecessor-work-first.log and observations/predecessor-{32,256,1024}.json. Final candidate/predecessor runs use byte-identical formatted specs and optional isolated ST_PACKET_PAIR_OUTPUT sinks: candidate-final-observations/ and predecessor-final-observations/. No hardcoded review sink is shipped in the final specs; ordinary runs without that env variable emit no files.

- Final new tests: candidate 11/11 pass; unchanged predecessor 8 pass / 3 count failures.
- Six private packet semantics cases pass on both: unstepped duplicate physical subjects/ordinary identities; distinct steps; reused identity across steps; later missing match; omitted step physical list; authored-removal then same-subject restore. These discriminate first physical identity through untouched-field support and per-edit restored endpoint identity, not just final row values.
- Singleton allocation controls: 16 Map constructions in prepare before and after, both unstepped and stepped; factory initialization excluded, positive counter calibration included. This is a Map-allocation comparison, not whole heap/CPU/GC evidence.
- Source types pass. Final spec-type ratchet passes; no baseline update.

Broader unchanged packet/native-publication/reentry/control group: 16 files, **105 pass / 9 fail**. The same nine named first failures reproduce on untouched C11 in a focused two-file comparison (12 pass / 9 fail):
- native-certificate-successor.spec.ts: parent composite readiness, scalar enrollment parent invalidation, and restored retained collection payload/support (three failures).
- publication-enrollment-adjudicated.spec.ts: branch/root x before-pending/during-pending/enroll-in-updater (six failures).

INHERITED-FAILURES.json records exact matching test names. Raw assertion differences/lines are retained in candidate-control-group.log and predecessor-control-failures.log. These were not corrected, reclassified as passing, or hidden. No C11 presence-candidate change was borrowed.

The remaining 14 files pass, including packet admission/index adversarial/review, singleton reuse, native input, admission/invocation/explicit handoff, authored footprints, membership provenance, evidence scope, retirement boundaries, negative-publication retirement, and publication work/lifetime controls. Exact file selection is in candidate-control-group-command.json.

Original direct-import clear oracle replay on the candidate: all six still fail at 513<=512 / 2049<=2048, ten other cases skipped. Its test hash is sealed in FREEZE.json. No 130k-row workload or heavy/full suite was run.

## Raw commands and limits

Every execution has adjacent *-command.json, *.log and *-exit.json. Principal commands:

```
corepack pnpm nx test kernel --skip-nx-cache --testFile=packet-physical-pair --maxWorkers=1
corepack pnpm run typecheck:source
corepack pnpm exec node tools/check-spec-types.mjs
```

Full 16-file group and two-file predecessor comparison arguments are recorded verbatim in their command JSON. Initial and final sources/failures remain preserved; PREDECESSOR-FIRST-FIXTURES and PRE-SINK-FIXTURES record formatting/evidence-sink revisions. Inherited archived audit tsconfig missing-path and npm config warnings remain in logs. No new semantic fixture failure was repaired to obtain green.

Review questions: verify first-match versus last-proposal separation, per-step map lifetime and duplicate identity overwrite behavior, authoredRemoval/no-steps handling, singleton allocation path, and adequacy of the bounded controls. No ambiguity in those source-issued semantics was found during implementation. Independent review is still required before composition; this handoff is not release acceptance. Builds/demo/docs/release gates, broader frameworks, general callback matrices, and whole-runtime complexity/performance claims were not run or established.
