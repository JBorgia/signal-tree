# Exact C18 minimal lint maintenance — frozen for Main review

Manifest `26d128655d1db2ff8472f3be4e83b45060b7d3126db1c9e2c60bf50c8d76e2d1`; patch `936879a4ea737be36185937a8d78278568eb3743ef065744297f3529486f4b57`. Input C18 `cdfdf039f8cac66c90de26ff47cec3850b5e33db00e4b5c335c51bc934facbee`. All 3065 baseline paths verified before copying; original C18 reverified unchanged at freeze. Four files changed; no other source/config/budget/public-surface changes. FROM-C18.patch passes reverse-application check against the frozen successor.

## Changes and validity

- Runtime entity-signal.ts: preserve the existing let declaration location and explicitly initialize snapshotIdentity to undefined, with its pre-proxy lifetime documented. advanceInstalledRead may run before proxy assignment; the binding remains initialized and readable then. Assignment to proxy stays in its original location. No const hoist/TDZ, install-path change, or runtime refactor.
- Fixture value-work-handoff: combine its one assignment into const c at the original link call. This fixture supplies only set, no construction-time subscribe/get callback. Outbound set runs through later delivery, after link returns and c initializes; the unchanged endpoint-reentry assertion passes in the selected run.
- Five intentionally empty fixture callbacks receive explanatory comments only (native-authored-footprint, value-work-handoff and whole-bounded-qualification). No rule disables or relaxed expectations.

## Verification

Sequential pinned-tool checks, own Nx cache/data/tmp, no output-helper environment required:

| Check | Result |
|---|---|
| Affected lint, same seven-file set as C18 | PASS: 0 errors / 27 unchanged warnings (original 7 errors preserved) |
| Source types | PASS |
| Spec types | PASS; no ratchet/config change |
| Four selected specs | 31 pass / 1 inherited mixed-rollback failure |
| Emitted JS/comments and assertions | PASS |

EMITTED-VERIFICATION.json and verify-emitted.cjs establish byte-identical comment-stripped JS for the two comment-only files. For the other two files, emitted JS equals the predecessor after ONLY the explicitly approved binding change; all comments erase identically. AST-extracted expectation expressions are unchanged. This does not falsely claim the added undefined initializer or let-to-const edit emits identical JS.

Selected tests cover value-work handoff/reentry, native footprint, original six equal-whole owner controls and bounded qualification. The sole failure is the same immediate mixed-row rollback output assertion in C18's preserved joint log: expected x0/y9 outbound row, received undefined. Its assertions remain unchanged; it was included, not skipped or repaired. C18-JOINT-FIRST.log and selected-tests-no-output/first.log preserve both results. No full suite or release qualification.

Commands, environment, first logs, source-before identities and unchanged-source results are under runs/. Original C18 lint failure is C18-FIRST-LINT.log. Candidate is frozen for Main's review; no composition performed.
