# C6 frozen bounded composition

Candidate: /private/tmp/st-native-combined-c6/candidate.
Full manifest SHA256: `925bd916560115e5fffd9c761e2eeca6a170f43dab0c8214aa5c7177315b69b4`.
FROM-C5.patch SHA256: `e299f8b10e219089f6b72a4ce27cd7fcb934161f26386e02a17e289d76bcc475`.

Exact C5 plus cumulative C0→dynamic enrollment→base cleanup→shared construction. All six enrollment runtime files verified; all 23 newer C5 files remain unchanged. No R2/R3. No root or predecessor edits. Initial wrong-base assembly preserved separately; corrected composition is conflict-free and patch dry-run against C5 succeeds.

| Unique run | Result |
|---|---|
| construction-kernel | 433 passed, 16 files |
| construction-angular | 28 passed, 5 files; actual Angular |
| packet-accounting | 138 passed, 1 existing skip, 9 files |
| retirement-enrollment | 61 passed, 5 files |
| recipient-cause-exact | 6 passed, 1 file |
| source-types | exit 0 |
| spec-types | existing ratchet exit 0; baseline unchanged, not a raw-zero claim |

Total targeted executions: 666 passed, 1 existing skip, 36 files. All seven commands exit0 and report unchanged source before/after. Exact commands, pinned environment and first logs retained per run. Recipient exact run closes an unmatched recipient-domain filter; see COMPOSITION.md. No failing gate occurred in this corrected assembly.

Frozen for independent integration review, not activation/release. R3 live-slot publication binding and inherited parent snapshot completion freshness remain unresolved and explicitly required in COMPOSITION.md. Component GC acceptance is not a new C6 GC qualification. No performance/budget claim or broader suite was added.
