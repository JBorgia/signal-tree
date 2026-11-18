# v16 provisional release: portable GC qualification

The owner authorized provisional v16 publication while stable v15 remains
available. Candidate rc.0 at `adf3937459f88260c276c1486357d94ab886cd07` passed
its recorded local preparation and hosted preview checks, but
[Linux run 44350587086](https://github.com/JBorgia/signal-tree/actions/runs/44350587086)
failed `test:all` before publication. No rc.0 npm publication was dispatched.
The signed tag and original local, CI and hosted evidence are retained.
[Receipt index](RECEIPTS.json) binds the raw failure logs, focused controls,
commands and artifact hashes. Logs are losslessly gzipped with stored and
decompressed hashes; these working-tree receipts do not claim successor tag CI.

## Concrete cause and selected correction

The confirmed-record destruction test bundles the runtime in one subprocess,
then starts a fresh GC-enabled Node process. It passed the complete bundle as
one `node -e` argument. The Linux failure tail shows a very large argument,
`pid: 0`, `status: null` and no child output: the GC process never started.
The preserved gate log truncates the useful error header. The separately
dispatched [original-tag package diagnostic](https://github.com/JBorgia/signal-tree/actions/runs/44355090251)
confirms `spawnSync ... E2BIG`, errno -7, for all five cases.

Independent source review identifies the platform's single-argument size limit
as the concrete portability defect. The correction follows an existing repository
pattern: send the bundle through stdin with `--input-type=module`. Both fresh
subprocesses remain. The five destroyed/live/external/raw-snapshot/reader-snapshot
cases, GC turns, timeout, retained-value assertions, confirmed counts and reader
refusal checks are unchanged. No runtime ownership change is selected.

That diagnostic also exposes two failing `afterAll` hooks in the whole-write
qualification/getter suites: concatenating an unset `process.env.TMPDIR` produces
`undefined/whole-*.json`. The behavior assertions run, but diagnostic recording
fails. Use `join(tmpdir(), filename)` so explicitly configured temporary paths
still work and an unset variable has the platform fallback. Preserve both
diagnostic files and all assertions. Local runs with `TMPDIR` removed reproduce
each original failure before the correction.

The gate wrapper also discarded the first part of a large failure and called
`process.exit()` before piped output drained. A synthetic 200,000-character child
failure through the actual wrapper reproduces both losses: only 65,667 stdout
bytes arrive, without the diagnostic start, end or verdict summary. Keep the
complete captured failure (the existing capture bound remains) and set
`process.exitCode` at normal completion so the pipe drains. The same control then
receives 200,447 bytes including all three markers, still exits 1, and the real
clean source-controls gate still exits 0. This changes diagnostic delivery, not
gate selection, thresholds or failure policy.

## Successor qualification

Use 16.0.0-rc.1 on `codex/v16-16.0.0-rc.1-release`; do not move the rc.0 tag.
Update current installation guidance and generated demo version labels. Keep the
existing numerical budgets and verify all shipped runtime/declaration payloads
against the preserved qualified archives.

The original five-case launcher passes locally on macOS. Its passing local run
does not establish Linux portability. The corrected five cases and related
batching GC control pass locally. Fresh uncached package builds, unchanged
numerical budgets, installed export resolution, strict bundler/node16 types and
Angular AOT/browser consumers pass. All 168 shipped JavaScript/declaration
payloads are identical to the integrity-verified rc.0 archives. Versioned
manifests and guidance are checked separately.

The production demo builds and all 160 browser checks pass with retries disabled.
Demo unit tests pass 190 cases; four existing opt-in timing cases remain skipped.
Five documentation/workflow gates pass. These are working-tree successor checks,
not a claim that the full normal/mutation gate set was rerun locally on rc.1.
Both corrected diagnostic writers pass with `TMPDIR` deliberately unset; the
spec-types and lint-budget gates pass afterward. The extra diagnostic-delivery
control above runs after that lint/spec gate receipt and is recorded separately.
Exact signed-source Linux normal/mutation qualification and the canonical
publisher remain mandatory before registry publication. Final registry archives,
channels, cryptographic signatures/provenance, fresh consumers and hosted version
checks retain separate evidence identities. Historical measurements are not new
rc.1 performance results.

Independent preparation closure verified all 38 receipts against their originals,
the before/after source hashes, all 168 shipped runtime/declaration payloads and
the exact facade/kernel dependency versions. It found no demonstrated blocker
to freezing the successor, with no runtime, API or numerical-threshold change.
The reviewer performed read-only source/integrity checks, not additional tests;
exact-tag qualification and registry publication remained pending at this point.
