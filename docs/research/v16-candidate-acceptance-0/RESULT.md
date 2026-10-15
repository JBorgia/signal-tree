# V16 candidate verification and cost disposition

The scoped verification is complete. **Keep the reviewed capture/publication
candidate as the v16 integration candidate, with its measured runtime costs
explicit.** The listed scoped correctness and artifact checks pass. This is not a performance-
neutral result, completion of the entire ownership architecture, or publication
authority. No runtime-cost threshold was preregistered, so the measurements are
not converted into an invented performance pass/fail.

Verified source: `8d220643e0d4e34cbdbc6e55e6ef692b25d5e023`.
Runtime sources last changed at `4742ecbcf8af8e225a618ce6555d04dc35b216f4`;
subsequent commits repaired verification/docs/budget policy only.
Cost baseline: `19a5bd034d5ebef262f637c397bb41fe50a6a1e3`.
Recorded locally October 14, 2026; measurement timestamps are October 15 UTC.

## Verification

All commands used Node 24.15.0/pnpm 10.17.0 and the isolated frozen install.
Committed and installed lock SHA-256 both equal
`5e1ccb86b533ff4241d8a6ae5ac32ee9a56c6e10a416a8d1be3322d0ba531239`.
The install originated at `e4672b9e`, with the same lock and dependency root;
receipts do not pretend it happened at the later source commit.

| Check | Result |
| --- | --- |
| Complete registry, `node tools/verify-gates.mjs --release` | 84/84, exit 0; zero failed/known-red |
| Complete mutation proofs, `--self-test --release` | 84/84, exit 0; 12 indirect; zero unproven/vacuous/blind/errored |
| Source restoration | Clean, exact SHA unchanged |
| Post-mutation destruction of generated dist and five-package serial rebuild | Exit 0; all five versions individually asserted `16.0.0-dev` |
| Packed consumer resolution | Exit 0 |
| Strict installed consumer typing | Exit 0; bundler and node16 module-resolution modes, not a Node16 runtime claim |
| Packed production Angular AOT/browser/injector teardown | Exit 0; no runtime compiler |
| Production demo build | Exit 0; initial 563.16 kB, error ceiling 570 kB; 525 kB warning retained |
| Served browser suite | 136/136, exit 0 |
| Version claims, release state, changelog | Exit 0 |
| Final artifact budget check | Bare 11.64/13.99 KiB; entities 25.46/28.22 KiB, production/development; within approved ceilings |

Fresh package graphs from the final build exactly match the previous c171
post-mutation build. Every final receipt records its actual command, source,
start/finish, exit, source cleanliness and log hash. Evidence-only commits after
this record do not retroactively become the tested source SHA.

## Failures preserved and repaired

- `ecf04878`: first registry 75/84, nine failures. Sandbox access and four
  verification/documentation defects were diagnosed separately.
- `e4672b9e`: shared installation 84/84, then a discovered five-resolution Babel
  mismatch prevented a frozen-dependency claim. An isolated frozen install and
  new complete run passed 84/84; original evidence remains.
- Its full mutation run failed 82/84: stale raw-signal anchor and ineffective
  root-declaration stripping. Repairs preserve runtime behavior, assertions and
  the documentation floor. Actual clean/mutated/restored controls return 0/1/0.
- A spaced `--only raw-signals` invocation unexpectedly selected the complete
  registry; its 83/84 result remains recorded. Correct selection uses `--only=`.
- `c1714eae`: complete registry and proofs both 84/84, then browser 135/136.
  A legacy main-file 525,000-byte proxy failed at 537,472 despite total initial
  fitting the approved 570 kB policy. History and independent review supported
  aligning that secondary proxy with the configured initial error ceiling.
  The build still enforces aggregate initial size; forbidden-runtime assertions
  and the warning are unchanged. Oversized-main mutation failed, exact restored
  artifact passed. Final 8d verification reran the entire sequence.

No first red is replaced by a later green. The declaration checker proves its
aggregate documentation contract, not preservation of every individual symbol's
comments. The browser main-file bound does not itself prove total initial size.

## Complete-candidate cost

The preregistered R5 run completed 204/204 fresh-process measurements plus eight
expected-failure controls, exit 0. All control failures matched their intended
assertions, including deliberately retained terminal handles and a no-op cycle.
Source/build/package/harness identities were unchanged afterward. Final input
seal SHA-256:
`fc921e38091bdcb0555e44d9b38425da82d4b3e29a66625cf516b32521624c6f`.

Baseline and candidate were rebuilt using the same frozen dependency root.
Environment: Apple M4, darwin/arm64, Node24.15.0, V8 13.6.233.17-node.48,
production runtime flags. Host snapshots showed Defender using roughly one core
and browser activity. This was not a quiet-host certification. There were no
favorable retries or dropped samples.

Timing uses six rounds of baseline-A/candidate/baseline-B. Primary ratios are
candidate divided by the arithmetic mean of that round's baselines. Work
includes checked synchronous writes, reads and incidental GC; it excludes
setup, warmup, explicit GC, teardown and later deferred publication. It does not
measure framework render latency or primitive setter cost alone.

| Workload | Baseline median | Candidate median | Median paired wall ratio | Median CPU ratio |
| --- | ---: | ---: | ---: | ---: |
| Scalar, 16 leaves | 59.9 ns | 59.8 ns | 1.003 | 0.974 |
| Scalar, 128 leaves | 59.5 ns | 60.7 ns | 1.022 | 0.990 |
| Demanded derived | 226.7 ns | 231.2 ns | 1.010 | 1.040 |
| Existing entity update | 325.0 ns | 334.1 ns | 1.028 | 1.015 |
| Mixed transaction confirm | 18.24 µs | 23.15 µs | 1.252 | 1.202 |
| Mixed transaction rollback | 27.87 µs | 34.55 µs | 1.248 | 1.212 |

Absolute baseline medians use same-round baseline means; ratios are medians of
paired ratios, not ratios of those displayed medians. Every transaction pair
was slower than both baseline replicates in wall and CPU measurements. The
approximately 25% wall / 20–21% CPU cost is material within this workload.
Ordinary-write shifts are small relative to observed A/A scatter; this neither
proves neutrality nor establishes a portable speedup/regression percentage.

Three-pair whole-process heap measurements show about 8.3–8.4 kB additional
idle heap across 32 bare scalar trees. With transactions enabled, idle fixtures
increase about 0.30 MB (16 trees/16 leaves), 0.97 MB (64/16), and 1.78 MB
(16/128): roughly 11–21%. Enhanced fixtures include entities, so subtracting
bare from enhanced does not isolate enhancer ownership. Pending, settled,
repeated-cycle and destruction checkpoints are all retained separately in the
full tables. Watched handles/trees collected in the exercised finite controls;
this is not universal leak freedom or proof of every internal object's lifetime.

Construction is measured, but 47/48 blocks are below 100 ms. Observed median
wall ratios are 1.104/1.012 for bare16/128 leaves and 1.096/1.107 with
transactions; CPU ratios are 1.025/1.313 and 1.047/1.032. Do not hide the bare128
CPU result, the 1.90x enhanced128 wall outlier, or collapse wall and CPU into one
claim. There is no construction A/A control and no robust neutrality claim.
No add/remove, broad reorder/restoration, large entity initialization or full
application render cost is established by this bounded matrix.

## Semantic boundary and decision

The supplemental matrix was run against exact `19a5bd03` and `ecf04878`; its
runtime and frozen matrix inputs remain unchanged through 8d. The result remains
188 held / 68 violated / 168 unsupported, zero execution errors. No verdict
changed. The 48 changed structural traces concern diagnostic rekey path labels,
not state or settlement outcomes. The original thirteen-case report separately
has nine held, one violated, three unsupported. Green execution tests do not
turn these reports into all-held semantics. Frozen harness/source hashes and
comparison receipts remain in the evidence.

The benefits are the already reviewed responsibility capture, settlement
refusal/authority behavior, coherent publication and callback-write preservation
within tested boundaries. They justify retaining the implementation rather than
reverting the reviewed fixes solely for smaller/faster numbers.
The measured transaction/heap cost remains an explicit integration tradeoff;
passing size budgets does not approve runtime cost by implication.

Recommendation: advance this as the verified bounded v16 candidate, preserving
the broader semantic limitations and cost tables. Do not advertise it as the
complete ownership model or a performance-equivalent rewrite. Further precision
work, if warranted for a concrete application workload, needs its own preserved
protocol; do not rerun this schedule until a favorable result appears.
No merge, push, tag or publication was performed. V14 and new architecture are
outside this verification.

## Evidence and replay

The adjacent `acceptance-evidence.tar.xz` contains first failures, final command
receipts/logs, semantic comparisons, both full kernel packages, fixed schedule,
raw stdout/stderr and independently reviewed measurement harness. The adjacent
`evidence-receipt.json` seals that archive. `COST-TABLES.md` includes all memory
checkpoints and timing ranges; reviewers' reports accompany this record.

Extract into a new directory. Inspect `final-verification-index.json` and
`cost-final-8d/finished.json`; a summary alone is not completion evidence.
Recreate source verification from exact 8d with its frozen lock and commands in
the receipts. Absolute paths in historical receipts identify the original run,
not portable new locations. The sealed driver deliberately rejects mismatched
source/build identities; prepare fresh receipts/seals for a new full run.

Individual archived-package probes can be replayed from the extracted
`cost-final-8d` directory, using Node24.15.0, for example:

```sh
NODE_ENV=production node --expose-gc child.mjs baseline tx-rollback 12000 16 1
NODE_ENV=production node --expose-gc child.mjs optimized tx-rollback 12000 16 1
NODE_ENV=production node --expose-gc construction-child.mjs optimized construct-bare 128 16 32
```

`optimized` is the child's retained slot name for the complete candidate, not
a third arm. New results are new runs, not reproduction of identical timings.
Generate the complete extracted tables with
`python3 render-cost-tables.py <extracted-evidence-directory>`.
