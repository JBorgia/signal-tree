# Frozen R3 bounded qualification — all requested gates pass

**147 unique runtime cases across22 files pass; source, public and unchanged spec-type gates all exit0.** Nine sequential commands, one attempt each. No assertion/compiler failure, retry or fix.

Author explicitly confirmed freeze before copying (AUTHOR-CONFIRMATION.json). Independently verified:

- MANIFEST.json: `e0b64de42df330abff455d2ee1b981c99abee187a77269cd064f52f3b08505f3`
- RUNTIME-MANIFEST.json: `1edb39e668f2a370554f692d455b75fac08a9836003a150acd09e2326368a08c`
- runtime.patch: `e29e34f8b4a5043da4f984c104ad683ba65869c9b2da3a3d5c12bf22ce7db634`

All3,095 manifest files verified into own copy from /private/tmp/st-c28-r3-comparator/candidate. Copied and frozen source checked before/after every gate; no mismatches. Final identity is unchanged. Test-identity checks prove all22 selected files remain byte-identical to the archived C27/C26 inputs. No source, fixture, oracle, config or budget changes.

| Exact prior selection / gate | Result |
| --- | --- |
| Eight-file C27 kernel selection | 54/54 pass |
| Nine-file C27 remaining-failure selection | 59/59 pass |
| Source tsc: tsconfig.typecheck-all.json | exit0 |
| Public tsc: packages/kernel/tsconfig.typecheck.json | exit0 |
| Unchanged tools/check-spec-types.mjs | exit0 |
| Angular facade controls | 8/8 pass |
| React facade controls, existing target typecheck included | 8/8 pass |
| Vue facade controls | 8/8 pass |
| Solid facade + saved-snapshot controls | 10/10 pass |

113 kernel +34 framework cases =147; no duplicate selected runtime file. Author final26, public sibling pair and repeated-use n1–n4 diagnostic are NOT included or replayed here. Their evidence remains separate. No old approved-policy mismatch or new runtime failure arose in these selected tests. This result does not establish missing public unresolved-index coverage noted by the author.

## Evidence and limits

Each runs/<gate>/COMMAND.json records exact archived command provenance, argv/cwd and complete task-set environment: pinned Node24.15.0/Corepack pnpm, own Nx cache/data/TMPDIR, maxWorkers1 and explicit private ST_PREPARED_REVIEW_OUTPUT/ST_PUBLIC_DIAGNOSTIC_OUTPUT/ST_C21_DIAGNOSTIC_OUTPUT sinks. Inherited ST_* variables were cleared; the previous diagnostic redirect helper is unchanged. Commands ran sequentially. Untouched first.log files preserve startup warnings and first outcomes.

RESULTS.json contains counts/exits; per-run PROCESS/RESULT records bind owned PID/group,180-second cap, source identity and frozen-source comparison. No timeout; all owned groups absent. FINAL-IDENTITY.json reports zero copied/frozen mismatches. EVIDENCE-SNAPSHOT.json hashes evidence and report. Spec gate ran without --update; no baseline ratchet.

No full suite/build/cost, GC,130k restoration, author gate or diagnostic replay. No broad architecture or release acceptance. Main retains composition authority.
