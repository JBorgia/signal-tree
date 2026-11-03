# P3 experimental result: incomplete owned-projection publication

Baseline `19a5bd034d5ebef262f637c397bb41fe50a6a1e3`; starting evidence checkpoint
`447013c034078f80f656cdd4b91d43b571f2930a`. Owner authorized an optional freshness
SDK experiment, explicitly withholding final API acceptance. The exact semantics
were written in [P3-CONTRACT.md](P3-CONTRACT.md) before implementation and reviewed
independently. This candidate is not accepted or integrated into runtime source.

## Implementation and surviving controls

[P3.patch](P3.patch) adds the optional `isCurrent` parameter, forwards it through
native location realization, supplies it from the existing versioned collection
cache, and confines Vue's fallback computation to stale owned projections during
native invalidation delivery. Omission takes the old native computed path. A
nested grouped callback suppresses the predicate; retained successful values
prevent the earlier cache backslide. No application workaround was introduced.

The frozen candidate passed:

- Unchanged Vue shared `4c` settlement regression and ten owned-publication
  controls (11 total), including allocation identity and duplicate-getter tests.
- Both prior P/P2 killer probes unchanged, plus the retained v2 reentry probe.
  The original P reentry probe now completes even its nested rollback.
- Same shared `4c` on Angular, React, and Solid, without adapter changes there.
- Nine new Vue predicate timing/memoization/reentry/error controls, first run.
- Three new kernel neutral/fake/legacy-adapter tests, first run. One-argument
  adapter implementations remain assignable and callable; the fake realization
  requires no framework and the real neutral runtime publishes coherent reads.
- Ordinary spec-types gate: exit 0, no new errors or baseline edits. Vue's Nx
  runs also passed their spec typecheck. The invocation supplied `--help`, but
  this script has no help branch and ran its normal gate; the result is recorded
  explicitly rather than misreported as a different command.
- All thirteen unchanged D2 capture/creation/inspection/refusal/retry/confirmation,
  repeated-write/preparation/reentry and failed-settlement controls on DP3.

The instrumented `timing-p3.mjs` changes only the adapter wrapper to forward
additional arguments; its assertions are unchanged. That same wrapper fails on
exact baseline and D2, passes on P3 and DP3. The original timing source and its
first results remain untouched. The shared Nx regression also remains unchanged.

## Independent counterexamples and verification

Independent implementation review supplied two ordinary-input probes. The
reviewer ran the current P3 source; its temporary runner used the confusing name
`base`. Those manifests and hashes are preserved, but they are not historical
baseline runs. The primary agent then reproduced both with the portable runner. Final audit
found the first P3-labelled runs accidentally included D2 as well. After fixing
the lane mapping and allocating a fresh overlay directory per invocation, both
were replayed on P3 alone and DP3 against exact baseline Git objects:

| Probe | Observer during rollback | Result |
| --- | --- | --- |
| `review-empty.mjs` | scalar 0, all [], count 0, **empty false** | fails |
| `review-active.mjs` | scalar 0, direct row 0, all [0], **active entity 1** | fails |

Later callbacks become coherent. Neither probe injects capture or publication
faults. Both failed assertions are retained without changes. These are owned
SignalTree projections, not application-owned native computed values.

Source confirms the gap: `empty` and `activeEntity` use plain
`locations.createDerived`, so they never receive the new predicate. P3 repairs
versioned projections but not all owned projections. `activeEntity` deliberately
depends on the selected row; its existing comment and implementation require
preserving that behavior. Invalidating it on every collection write would not
be justified merely to pass this test. No such change was made.

This falsifies P3's completeness, not the optional port in principle and not
atomic responsibility capture. No weakening, blanket refusal, native computed
timing change, or final SDK acceptance follows from the passing controls.
D2's patches and reviewed evidence remain unchanged; capture and publication
correctness are separate claims.

## Disposition and replay

P3 remains a research patch, with its new tests in `P3-tests.patch`. Runtime and
new experimental test files were restored after evidence capture. Existing
baseline-failing publication regressions from `447013c0` remain checked in.
Full suites, source typecheck, lint, package/demo builds and size gates were not
run because independent focused review rejected this candidate. No ceilings,
v15, push, merge, tag, or publication changes.

With repository Node/pnpm dependencies available:

```sh
node docs/research/settlement-publication-boundary-0/run.mjs P3 timing-p3.mjs suite replay
node docs/research/settlement-publication-boundary-0/run.mjs P3 owned-read-controls.mjs reentry replay
node docs/research/settlement-publication-boundary-0/run.mjs P3 review-readonly-memo.mjs suite replay
node docs/research/settlement-publication-boundary-0/run.mjs P3 review-empty.mjs suite replay
node docs/research/settlement-publication-boundary-0/run.mjs P3 review-active.mjs suite replay
node docs/research/settlement-publication-boundary-0/run.mjs DP3 review-empty.mjs suite replay
node docs/research/settlement-publication-boundary-0/run.mjs DP3 review-active.mjs suite replay
```

Expected exits: **0,0,0,1,1,1,1**. Use a fresh label for every repeated invocation.
The runner reconstructs the exact baseline and patch chain in temporary files;
it does not install candidates into the checkout. `p3-replay-results.json`
contains all thirteen exact DP3 control commands and their successful exits.
`p3-first-results.json` preserves raw outputs and manifests; `inputRecords`
indexes `p3-source-inputs.json`. Log line endings are normalized; original logs
and full bundles remain in the recorded temporary directories.

To rerun the new Nx tests in a clean, isolated checkout of this evidence commit,
apply `P3.patch` and `P3-tests.patch`, then run:

```sh
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test vue --testNamePattern='Vue owned collection publication|4c coherent value settlement|projection freshness'
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test kernel --testFile=packages/kernel/src/lib/projection-freshness.spec.ts
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx run-many -t test --projects=angular,react,solid --testNamePattern='4c coherent value settlement'
node tools/check-spec-types.mjs
```

The two counterexamples above remain separate required falsifiers; passing the
Nx controls is not an acceptance claim.

## Replay isolation correction

The first runner edit mistakenly included `P3` in the D2 patch-chain selector.
Thus the earlier P3-labelled portable manifests represent DP3, not P3 alone.
They remain preserved with this qualification. DP3 runs and all thirteen capture
controls were correctly composed. Direct Nx runs and independent reviewer
current-source probes used P3 alone. `p3-corrected-isolation.json` records the
corrected portable P3-alone and DP3 replays. The runner now allocates a fresh
source overlay for each invocation to prevent leftover lane files from masking
a mapping correction. This is a harness correction; no assertion changed.

Independent final review verified the corrected manifests: P3 transaction
probes load the exact baseline transaction hash (the memo probe imports no
transactions); DP3 loads the distinct capture overlay. The eight corrected
exits are 0,0,0,0,1,1,1,1. This supersedes the original portable P3 lane identity,
without changing the rejected disposition. Clean restoration and patch-apply
checks passed; D2 evidence and package runtime source are unchanged.
