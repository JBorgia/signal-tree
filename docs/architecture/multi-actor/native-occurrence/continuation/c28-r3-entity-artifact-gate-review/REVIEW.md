# Independent tooling review — entity artifact gate

**One P2 finding: the new companion's outer registry mutation proof can report a setup failure as PROVEN. Correct that result boundary before composition.** The accepted saved run itself is valid behavioral evidence: clean baseline passed, the exact registration mutant failed recognized assertions in both modes, and clean recovery passed. This finding does not reclassify that successful run as an infrastructure failure.

## Reviewed identity and scope

Reviewed `/private/tmp/st-c28-r3-entity-artifact-gate-work/successor` against the reviewed plan and frozen base `89058c7adf0bf680c3d8ef4778ff31d295ccc40d1911a31ac254484fa24a5c84`. Read PLAN.md, CASES.md, actual implementation/registry/peer fixture, raw accepted and negative evidence, final REPORT.md and IDENTITY.json, plus repository review/build contracts.

Independently verified supplied MANIFEST.json SHA-256 `26193d775b3e3f9c0ecc859de029dc20a1a591638730846ac0413bc1e89b6c1e` and all 3,122 listed files. Candidate HEAD is baseline commit `782ab986da58a47003e7606174eefcbdfb9c08d6`; the five tooling paths are staged changes, not a new committed runtime identity. Two existing paths changed (registry/README); three were added (tool/peer manifest/peer lock). Runtime, shared cases and consumer/bundler programs match the frozen base. This is not a review of composition with the diagnostic candidate.

## F1 — P2: setup failure becomes a successful outer mutation proof

**Location:** successor `tools/verify-gates.mjs:1495–1504` adds the companion mutation using the ordinary command/result path; the existing runner at `1906–1916` calls it and labels *any* nonzero result `proven`. The new tool's `command()` at `302–306` throws on setup failure; its top-level catch at `620–623` returns exit 1 for that failure, just as it does for intended classifier blindness.

**Concrete trigger:** invoke the registry's selected `--self-test` with canonical artifacts/build available but an empty npm cache and unavailable registry/offline setup. The classifier mutation changes only behavioralFailures; it has no effect on the preceding baseline npm ci. That setup fails before any baseline runtime or mutant executes. The tool correctly records failure, but the registry still prints “caught it … PROVEN”; the normal entry is also counted indirectly through provenBy. A later registry outage after a separately successful normal run has the same issue. This is not cured by the accepted successful run having good network/cache conditions.

**Evidence:** the saved empty-cache tool result at `.../st-entity-artifact-0ubW4B/result.json` has `passed:false`, no arms, no mutation, and `baseline-ci failed during setup/control`. The tool maps this to process.exitCode=1. Independently executed the *exact parsed registry IfStatement* against that result code in an isolated VM: it adds state `proven`. See CHECKS.json / check.cjs. No whole registry, install or network campaign was run for this reproduction.

**Violated contract:** the reviewed plan explicitly says dependency/setup/timeout failures can never count as a semantic mutation kill, and warns that the registry's generic nonzero rule cannot make that distinction. The direct tool honors that rule internally; the newly wired outer proof does not. The generic registry behavior predates this patch, but the new entry relies on it for the new setup-sensitive proof.

**Required outcome:** recognize the specific classifier-blindness failure only after clean baseline and mutant setup/control success; propagate setup, timeout, integrity and unexpected failure as an error/non-proof at the registry level. A distinct exit code alone is insufficient while the registry accepts every nonzero code. Keep the correction bounded to this proof contract; do not invert ordinary setup failures into successful selftests or weaken fixture assertions.

**Cheapest completion falsifiers:** registry proof path must (a) reject a baseline-ci/setup failure as error/non-proof, and (b) accept the intended blindness outcome after a populated passing baseline. The isolated exact-branch counterexample ran; the full registry negative with classifier mutation did not. Main/worker should verify the corrected boundary without a broad campaign.

## What the accepted evidence does establish

- Re-ran the tool's extracted parser selfchecks and reclassified all 18 saved suite executions across baseline/mutant/recovery and installed/production. Results exactly match accepted `evidence/registration-mutation.json`.
- Normal success requires all exact ordered 8/6/6 names, boolean pass flags, matching totals and exit zero. Missing/duplicate/extra/wrong-name/partial output does not pass. Receipt mutant output is a recognized failing prefix: only its first case executes before the unchanged runner throws. It is not six mutant receipt failures.
- Actual mutant results are five recognized original-case failures, four lifecycle failures and one receipt assertion failure in each mode. Syntax/resolution/timeouts, unrecognized failures and setup/control errors fail the direct tool rather than becoming its semantic proof. A graph failure alone cannot produce a successful direct selftest.
- Independently compared packed trees: the only clean→mutant file delta is `kernel/dist/lib/link.js`, with exactly one registration statement replaced by `void 0;`. All five packages are repacked; clean inputs are not overwritten.
- Verified tarball SRI and complete packed/installed file hashes for all three arms (187 packed files per arm), peer lock closure, saved bundle hashes and metafile input isolation/contributions. Baseline and recovery pass all 20 cases in both modes. Mutant no-Link control/graph remain passing in the recorded run. Source/input hashes in the accepted record match this final manifest.
- Accepted classifier-blindness evidence has a passing populated baseline, then specifically fails `registration mutant survived behavioral detection`; it is not the cold-cache failure. The mutated tool hash differs exactly where expected, and current tool bytes match the final manifest after registry restoration.

## Build, isolation and dependency interpretation

Registry needsBuild/provenBy/slow wiring matches the plan. Normal gate remains in fast selection; the expensive companion is slow. Explicit selection must include both entries; provenBy is not recursive execution. The registry uses its existing canonical Nx build path, which may use Nx cache; do not claim a forced uncached rebuild. The direct tool correctly labels itself prebuilt/artifact-only. Seal mode skips rebuilding and verifies artifact identity, not independent source freshness.

Current canonical seal independently recomputes to `sha256-47d2cda5e7664deefabbb1f514ff8d6d3b74900b35d877def46f55bb6809199f`, matching the accepted records. Pack/install is fresh per run, reads canonical dist, and does not repair declarations/manifests. Public roots and facade kernel resolution, package file equality, input realpaths and output contributions are checked. NODE_PATH/NODE_OPTIONS are removed for children. No runtime/source alias or private activation was added.

Peer fixture contains eight pinned direct peers and 32 HTTPS registry records with integrity, with no SignalTree records. Independently checked cold-a and cold-b final external lock graphs against the reviewed peer lock; both match. Clean/mutant/recovery use the same closure. The observed setup failures are correctly labeled by the direct tool. Fresh consumers and copied mutant package stages isolate the accepted run; actual temporary paths are outside the checkout.

Remaining bounded qualifications, not additional demonstrated blockers:

- Only npm 11.12.1 is identified in the accepted receipts/qualification report. The plan requested qualification with CI-bundled and publish-job npm; no distinct second-version evidence was established here. Do not claim broader npm-version coverage.
- The tool trusts os.tmpdir/TMPDIR to locate consumers outside workspaces; it canonicalizes the path but does not explicitly reject an in-workspace TMPDIR. Reviewed executions used external paths. Preserve that constraint in composition/CI.
- Input/seal checks cover the declared input set and canonical artifacts. The direct gate does not detect arbitrary stale dist relative to changed source, nor does it establish complete release or facade behavior coverage.

## Preserved failures and review limits

The first macOS path-canonicalization failure, truncated piped-stderr failure and overlapping-format/input-hash failure remain rejected evidence. File-backed descriptors preserve the later actual receipt assertion without weakening its witness requirement. The accepted run's input hashes match final source, so the overlapping-format run is not being reused as acceptance.

Ran only read/hash comparisons, tarball/installed/lock/graph checks and isolated execution of existing parser/registry decision code against saved output. Did not edit worker source/root, build, install dependencies, run a fresh behavior campaign or compose patches. Source specs, spec-types, seal negatives and full registry runs were inspected as saved receipts rather than independently rerun. Fix F1, retain these limits, then bind the focused composed-gate result to Main's chosen source/artifact identity.
