# Test-routing successor — bounded qualification

Ready for independent review. Implemented the authorized routing on exact C11 in this disposable copy. No runtime, assertion, budget, or ratchet changes; no skip/xfail introduced. Frozen presence was not edited.

Source manifest: `SNAPSHOT.json`, SHA-256 `def6910829632965f5b05409864721f568834af11962274573a662c9b1c7ce19` (3,049 files). Baseline C11: `dc21671bf92e2a74bd5798bfccfbc0b02d13e58dff4fe328758fd604d9f70148`. Patch: `FROM-C11.patch`, SHA-256 `72311a5041e28774171029c30145727a193d164cb1235008a57ba599297670f0`.

## Changes

Two diagnostic specs moved to `tools/experiments/native-publication-diagnostics/*.replay.ts`. Their bodies and assertions are identical after reversing import-path changes. An uncached `kernel:diagnostic-replay` Nx target supplies a fresh observation sink and checks the complete paired-recording matrix. Both files remain explicit inputs to the passing spec-type gate. They are recording harnesses, not assertions of the recorded later semantic outcomes.

The forwarding probe stays byte-identical in its original path. Kernel and root ordinary discovery exclude that exact probe; the retention config includes it. New `forwarding-retention-gc` runs all nine original modes in fresh sequential processes, with pinned installed Vitest, explicit GC/mode/output settings, and preserved per-mode artifacts. The existing `retention-gc` now explicitly filters its original three files and retains its original Link mutation. Root default exclusions are preserved. Sampling rounds and assertions are unchanged.

**Registry: 84 → 85 gates.** Only `forwarding-retention-gc` was added; no gate was removed. The diagnostic Nx target is not a new semantic acceptance gate. `test:all` coverage wording names the separately routed checks; its command and mutation are unchanged.

## Executed qualification

All requested checks ran sequentially. Exact argv/cwd/environment are in `COMMANDS.json` and each `runs/<name>/COMMAND.json`; first logs are retained.

| Check | Result |
| --- | --- |
| Kernel ordinary file discovery | 608 → 605; exactly the three authorized files removed; none added |
| Root ordinary file discovery | 817 → 814; exactly the same three files removed; none added |
| Explicit diagnostic discovery | Exactly two archived replay files |
| Nx diagnostic replay | 28 tests completed; 28 unique mode/route/observe records |
| Forwarding retention gate | 9/9 original modes passed |
| Existing retention gate | Original 3 files, 10/10 tests passed |
| Source types | Passed |
| Spec types | Passed; both replay files confirmed compiler inputs; ratchet unchanged |

Discovery counts are file counts, not executed ordinary-suite totals. The 28 diagnostic passes establish initial conditions and recording completeness, not conformance of later recorded outcomes. GC results are bounded collectibility evidence for these fixtures, not universal reclamation or heap-cost acceptance.

## Actual mutation checks

- `forwarding-retention-gc`: the registered probe mutant deliberately retained the destroyed tree in the fixture's holder. All nine child runs failed the unchanged `tree: expected true to be false` WeakRef assertion. The gate returned 1; its self-test correctly returned 0. Original probe hash restored and matched C11.
- `retention-gc`: the original Link-disposal mutant failed `disposed: payload is collectible`; its retained Date remained reachable. The other nine tests passed. The gate returned 1; its self-test correctly returned 0. Original Link spec hash restored and matched C11.

`MUTATION-RESTORATION.json` records before/after/base hashes, and every run checks manifest-tracked source preservation. Forwarding raw mutant child logs and source hashes are under `candidate/artifacts/forwarding-retention/run-W3zInz/`; the good matrix is `run-QSJpUR/`. Existing gate raw output is in `runs/existing-retention/child.log` and `runs/existing-mutant/child.log`.

The evidence-only `bin/npx` shim resolves the existing gate's `npx vitest` request directly to the installed Vitest using pinned Node, retaining complete child output that the unchanged gate summary normally suppresses. Requested and resolved argv are recorded in each `child.COMMAND.json`. This shim is outside the candidate and patch; it neither changes tests nor uses fetched tools.

## Preservation and limits

Original three source files and the interrupted C10 full-run evidence are retained under `preserved/`. No first failure was overwritten. There were no unexpected qualification failures; the two intentional mutants failed for their intended retention properties. Existing nonfatal archived-tsconfig/environment warnings remain in logs.

`DISCOVERY-AND-PRESERVATION.json`, `SPEC-INPUTS.json`, `REGISTRY-DELTA.json`, and `PATCH-ROUNDTRIP.json` document exact routing/body/compiler/patch checks. `VERIFICATION.json` verifies this candidate, frozen C11, and frozen presence against their manifests. `ARTIFACT-INDEX.json` hashes all recording/GC artifacts; `EVIDENCE-SHA256.json` hashes the surrounding evidence.

No ordinary full suite was rerun. Other C10 reported failure groups and the interrupted run's unexecuted remainder remain unsupported, not passed. `REPORTED-DISPOSITION.json` preserves all reported groups and separates the prior equality/currentness evidence from this routing qualification. No full release or broad semantic acceptance follows.
