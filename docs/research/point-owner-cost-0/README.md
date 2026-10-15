# Transaction cost profile and point-owner lookup experiment

This experiment is based on G1 `4b37f3fca9194cadb393d108ad6194e4418a12bc`. Its reviewed point-owner change is now carried on the dedicated local `codex/capture-point-owner` branch; the original research branch remains unchanged. Exact identities, patches, raw output and executable protocols are preserved in the adjacent evidence archives. This is not release acceptance.

## Attribution

Six fresh Node 24.15.0 CPU profiles run the same checked mixed scalar/entity workload: 30,000 operations after 3,000 warmup operations, eight entity rows, 16 scalar leaves. Profiles include startup, GC, warmup and destruction; inclusive samples overlap and are not additive throughput measurements.

G1 rollback spends 338 ms of sampled time under `indexStructuralOwnerPaths`, out of 892 ms under rollback. Baseline indexes during initialization but not on the measured rollback route. Original candidate shows the same scan hotspot (365 ms). G1 confirmation spends 39.5 ms under disposition validation out of 121 ms under confirm; the experiment preserves that correctness check.

## Restricted prototype

For nonstructural, non-membership point realization only, resolve distinct entity owners through registered structured addresses. Require visible enumerable own data properties, the incumbent depth/key restrictions, matching position identity and owner metadata. Unsupported lookups use the existing complete index. Structural and membership planning remain unchanged. No persistent cache or new public API.

Independent premise review found hidden collections would invalidate a naive address lookup. The visibility checks address that concern. Independent candidate review exercised stale owners, hidden ancestors/collections, preparation reentry, stale installation, rekey and reused keys. Its scope and limitations are in `point-owner-candidate-review.md`.

## First failures and verification

The first new test invocation failed on my nonexistent `.add()` fixture method. That is a harness error, not a runtime finding; its log is preserved. After correcting to the installed API (`addOne`) and removing fixture casts, unchanged G1 passed the fallback control and failed three no-scan assertions. The prototype passed all four. Twelve focused files passed 288 tests; independent review added seven adversarial passes and ran 118 existing checks (overlapping with the focused set; do not add these totals). Source types and spec-types pass. All five full suites pass: kernel 5,739 ordinary + 12 expected failures + 12 skips, Angular 237 + 3 skips, React 74, Vue 172, Solid 104. Total 6,326 ordinary passes, 12 expected failures, 15 skips. The 11 extra kernel passes are the four owner-lookup tests and seven independent adversarial tests.

## Fresh-process comparison

Four shuffled rounds, 48 processes, 30,000 checked operations per process, all exit 0. Byte hashes of all artifact JavaScript are pinned in `comparison/protocol.json` and unchanged afterward. All samples retained. Timing covers synchronous operations and assertions, not subsequent deferred stabilization. Incidental GC is included. Host is not certified quiet; four samples per arm do not establish statistical equivalence.

| Operation / scalar leaves | Baseline median µs | G1 median µs | Prototype median µs |
|---|---:|---:|---:|
| Confirm / 16 | 13.88 | 17.84 | 17.66 |
| Confirm / 128 | 13.91 | 17.92 | 17.64 |
| Rollback / 16 | 21.91 | 43.25 | 28.38 |
| Rollback / 128 | 21.93 | 83.87 | 28.60 |

Paired median prototype/G1 wall-time ratios: rollback 0.663 (16 leaves), 0.343 (128 leaves); every observed paired ratio improves. Confirmation ratios around 0.99 do not establish an improvement. Prototype remains approximately 28–31% slower than baseline in these fixtures. Do not pool with the earlier cost run or reinterpret this as framework-wide performance.

## Remaining boundaries

Fresh kernel build succeeds. Bundle budget still fails at bare 11.65/14.00 KB and entities 26.79/29.58 KB production/development, unchanged at reported precision from G1. Production demo builds also exit 1: both unchanged G1 and the prototype measure 565.08 kB initial against the unchanged 550 kB error ceiling. The first two prototype runs emitted no useful diagnostic; preserved streamed CI-mode runs exposed the budget error in both arms. No budget adjustment or acceptance follows from performance savings. Disposition-validation cost, enhanced-tree memory cost, wider semantic obligations and existing expected failures remain. No merge, push, tag or publication.

## Reproduce

Apply `point-owner-experiment.patch` to a clean copy of G1; copy both adjacent spec files into `packages/kernel/src/lib/`. Use the pinned Node/pnpm and Nx. `profile.py` retains the original six-profile commands. `analyze.py` regenerates aggregate attribution. `comparison/run.py` records and executes the complete shuffled performance schedule; package paths must be reconstructed as specified in its protocol. The executed runner is preserved as `run.executed.py`; the replay runner now refuses to overwrite existing evidence. Copy scripts and package graphs into a fresh directory to run it. Run sequentially on an otherwise idle test host. The raw child scope string misleadingly says GC is excluded: only explicit preloop GC is excluded; incidental GC is included. `comparison/summarize.py` verifies all 48 receipts and regenerates ratios from raw results. Existing archived package graphs are retained in the adjacent qualified-cost artifact archive; prototype package graph is retained with this experiment.


## Follow-up disposition

The separate disposition-validator allocation experiment did not earn adoption: six paired rounds showed median confirmation wall ratio 0.997 and rollback 0.989, with comparisons crossing parity. Its changes were restored; only the point-owner lookup is retained on this candidate branch. The rejected experiment and interrupted-build history are in the adjacent disposition archive.

Owner declined the proposed ceiling increases and directed further reduction/obsolescence auditing. All existing budgets remain unchanged. This branch is a retained runtime candidate, not acceptance into main or a release. The archived claims of no integration describe the original temporary experiment.
