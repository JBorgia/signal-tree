# Final bounded identity and artifact review

**No new blocker demonstrated for this diagnostic reduction. Final source/artifact identity and the stated packed agreement are verified. Release readiness is not established: all four library bundle ceilings and the production demo budget remain failed.** This closes the requested bounded review, not the repository's release controller or broader incumbent qualification.

## Final identity

Packet: `/private/tmp/st-c28-r3-diagnostic-reduction`.

Independently recomputed MANIFEST.json SHA-256: `b4d66da31a7927e0d255add68c424b50a99b8ece3a21a594f6ef2ecb57c982e6`. All **3,121 listed files** match their hashes; no missing files or mismatches. The five implementation hashes recorded in IMPLEMENTATION.md remain identical. The earlier raw graphs, measurement generator, parity fixtures and relevant dist modules all still match `artifact-evidence-hashes.json`; the prior semantic and artifact conclusions therefore apply to this final source identity.

Independently verified all **192 entries** in ARTIFACT-HASHES.json against candidate/dist/packages, and all **five tarball hashes** against TARBALL-HASHES.json. Evidence checked in this final pass is identified in `final-evidence-hashes.json`. This establishes the listed file sets, not an exhaustive inventory of every ignored/cache file. The mutable top-level REPORT.md is outside the source manifest and is not frozen by this review. No FREEZE.json or FINAL-IDENTITY.json existed at initial inspection; the supplied manifest and verified artifacts are the identity authority used here.

## Packed and declaration claims

Read the tarballs without extracting or modifying them. All **188 regular packed files** match installed bytes under consumer/node_modules/@signal-tree; they also match their corresponding final dist files. Independently compared all **25 shipped .d.ts files** with the frozen predecessor dist: all byte-identical. These checks substantiate ARTIFACT-AGREEMENT.json rather than relying only on its boolean claims.

Inspected the saved commands, logs and exit receipts for installed and explicitly production-bundled consumers. Both routes report the same **20 named logical cases**: original8 + lifecycle6 + receipts6. I parsed their case records, verified each pass flag and compared case names across routes. This is 20 cases exercised via two routes, not 40 unique scenarios. Separate no-Link and facade-identity controls remain supplementary evidence. PACKED-RESULT.json reports successful checks and unchanged artifacts; current bytes independently agree with the artifact receipts.

No installed or bundled consumer was rerun in this pass. This is inspected execution evidence plus independent byte identity, not a new runtime campaign. The publisher-runner setup failure before MANIFEST.json existed remains documented in PACK-RUNNER-FIRST-FAILURE.md; it is not counted as a product failure or mutation detection.

## Remaining gates and first failures

Read the candidate RELEASE-CURRENT.md: it requires broader final verification and explicitly withholds release readiness. This packet does not override that boundary.

The graph-backed affected lint receipt exits 0 with **zero errors and seven warnings**; the folding self-test receipt exits 0 and its log records detection of retained advisories, missing controls/process dependence, and non-folding fixtures. Spec-types also exits 0. Their saved package-source records match final manifest entries. These are inspected receipts, not independently repeated test runs. The temporary lint orchestration remains outside candidate as documented.

The demo's first failure is preserved in runs/demo and DEMO-FIRST-CRASH.json: native SIGABRT/allocator cleanup, pid 56375. The later runs/demo-unsandboxed attempt uses identical argv and cwd; environment differences are the run-specific cache/data/temp/trace paths. Both SOURCE.json records agree with the final manifest for their recorded files and both results report sourceUnchanged=true.

The retry completed bundle generation but exits 1 on **initial bundle 682.62 kB > 570 kB**, exceeding the error ceiling by 112.62 kB. This is a demo budget failure, not a successful demo build and not evidence of a new TypeScript error. The native crash remains a first-failure observation; the later compiler/bundler progress does not prove a general causal explanation for that crash. Neither attempt is converted to a pass.

The four unchanged absolute library ceilings also remain failed as recorded in ARTIFACTS.md. The measured reductions remain valid for the matched saved graphs, but do not waive any ceiling or establish full runtime/performance/release qualification.

## Review boundary

Ran only cheap identity/byte comparisons and log/record inspection in this pass: source manifest, dist hashes, tarball hashes/content, installed agreement, declaration parity, prior-evidence stability and matching passing consumer case records. No source edits, builds, package executions, broad tests or release actions. Main may update REPORT.md to replace pending independent-review wording with this bounded outcome; final release/freeze claims must retain the explicit failed gates and unexecuted broader scope.
