# Matched successful-subset cost evidence

Baseline source:8d220643e0d4e34cbdbc6e55e6ef692b25d5e023. Candidate source:
f4d6a7ac plus the qualification's three preparation-time non-null cleanup edits;
final source-seal and full emitted-file manifests identify exact inputs. Candidate
behavioral failures remain blockers. These measurements do not establish equal
whole-product capability or a production winner.

## Method and activation

Node24.15.0, pnpm10.17.0, arm64 host,10 logical CPUs. Fresh uncached Nx production
package builds precede tests of built runtime files. Every measured child is a
fresh process, arms alternate order, and baseline A/A controls are retained.
Three samples per arm/workload; all raw outputs, host load samples and command
inputs are archived. No quiet-host certificate, calibrated-device claim or
confidence interval. No concurrent qualification builds/tests ran during sampling;
unrelated host activity is not controlled.

The production optimizer removes the unexported test selector. The measurement
harness therefore calls the built B installer through an enhancer carrying the
unchanged transactions() metadata. It does not execute the incumbent enhancer;
peekInternalTransactionRuntime is asserted absent for B and present for control.
Missing metadata in the first harness attempt broke retired-lifetime construction
policy, so that attempt is preserved as a harness failure, not a B defect.
The initial erased-selector attempt is likewise preserved. No dist rewriting,
source aliasing, production activation or public export was added.

Each timed iteration checks tentative and settled public values, pending authority,
inspection contribution count and repeated settlement where applicable. Ordinary
write samples check every write. Construction includes creating the tree,
populating32 rows, checking count and destroying it. Refusal/recovery removes a
row speculatively, creates a replacement independently, verifies atomic rollback
refusal, confirms the pending removal, checks replacement/held references and
cleans up. This is real key-occupancy refusal; no B-only injected fault is timed.
There are no active application observers, restoration history or inspection-only
writes in these workload fixtures. Their missing semantics cannot be priced as
if they were implemented.

The first90-sample campaign measured synchronous work only. A separately preserved
second90-sample campaign adds a final capture/maintenance drain per batch before
stopping the additional CPU/wall timers. This answers the deferred-work question;
it is not a favorable retry, and the campaigns are not pooled. Both have zero
failed matched samples. Explicit GC occurs only outside timers. Wall time includes
scheduling; process CPU includes runtime threads. Assertion cost is included.

## CPU through capture/maintenance drain

Ratios are the median of three paired B/baseline ratios, not a ratio of medians.
Values below1 favor B for this checked workload only. Initial synchronous results
remain in measurements/summary.json; the table uses measurements-drained/summary.json.

| Workload | Iterations/sample | Rows | B/baseline median | B range | A/A range |
| --- | ---: | ---: | ---: | --- | --- |
| Ordinary scalar writes | 2000 | 32 | 0.833 | 0.819–0.853 | 0.939–1.009 |
| Ordinary entity field writes | 1000 | 32 | 0.940 | 0.892–1.019 | 0.882–1.042 |
| Mixed successful rollback | 500 | 32 | 0.609 | 0.592–0.615 | 1.015–1.088 |
| Mixed successful rollback | 500 | 1024 | 0.548 | 0.540–0.594 | 0.938–0.995 |
| Mixed confirmation | 500 | 32 | 0.775 | 0.749–0.822 | 0.943–1.000 |
| Refusal then useful confirmation recovery | 200 | 32 | 0.919 | 0.725–0.944 | 0.908–1.039 |
| Ordinary entity add/remove churn | 500 | 32 | 1.520 | 1.436–1.709 | 0.995–1.108 |
| Construction/population/destruction | 200 | 32 | 2.464 | 2.338–2.652 | 0.927–1.059 |

The tested rollback advantage survives both collection sizes, but two sizes do
not prove asymptotic bounds. Ordinary entity variation overlaps A/A; no reliable
speedup is established there. Churn and construction regress substantially in
these workloads. Faster partial settlement does not offset incorrect settlement.

The separate overlap probe succeeds for B and refuses for incumbent. Its failure
is outside the90 matched samples and is recorded with exact exit/stdout/stderr.
No unequal-capability throughput ratio is reported.

## Post-drain heap and reclamation

Each process constructs one live tree with8 initial rows, performs pending
add/rollback churn, retains every old row reference, drains capture and explicitly
runs GC three times. Both must keep old references detached. The following are
median **whole-process heapUsed deltas** from the pre-tree baseline, not dominator
retained bytes or per-record allocation sizes.

| Retired held references | Baseline bytes | B bytes | Baseline reclamation candidates | B candidates |
| --- | ---: | ---: | ---: | ---: |
| 100 | 2,707,280 | 2,036,896 | 100 | 0 |
| 1000 | 13,018,096 | 11,480,776 | 1000 | 0 |

These counters measure the native candidate inventory; R2's separate tests inspect
actual backing resources. Held references, runtime/JIT storage and the live graph
contribute to heap. Lower observed heap is not universal leak freedom or a bounded
retention proof. Reclamation is explicitly post-capture-drain, never synchronous.
After-destroy heap observations are archived but not treated as proof of complete
collection because runtime caches and GC noise remain.

## Fresh artifacts

Budget fixture own-code gzip uses the unchanged gate's browser ESM/minification,
ngDevMode:false and Angular/RxJS/tslib external settings. Fresh independent
consumer bundles execute the same writes and checked settlement and save esbuild
metafiles; exact-byte figures below use those fixtures.

| Fixture | Baseline gzip bytes | Candidate gzip bytes | Increase |
| --- | ---: | ---: | ---: |
| Bare | 11,919 | 12,129 | 210 /1.8% |
| Entities | 26,074 | 28,134 | 2060 /7.9% |
| Matched transaction consumer | 60,154 | 68,508 | 8354 /13.9% |

The candidate is still optional: the transaction artifact retains both selectable
implementation graphs, although only B runs in its fixture. This is its actual
current artifact cost, not an optimized replacement-size prediction. Do not infer
that two contribution authorities are running, or claim hypothetical tree-shaking
savings by removing an unaccepted fallback.

Metafile output-byte deltas attribute bare growth chiefly to scalar slot
preparation(+219), shared terminal-plan interpretation(+207), member admission
(+158) and native preparation hook(+101). B's entity driver is not retained by
the bare fixture. Entity growth chiefly includes the ownership delta installer
(+4416), entity-signal plumbing(+1815), and mutation frame(+894). Transaction
fixture additions include B entity ownership(+6796), driver(+4953), delta
installer(+4416) and public adapter(+3727). These are minified output bytes;
gzip attribution is not additive. Metafiles and complete module tables are archived.

Fresh unchanged budgets: baseline bare11.64/13.99KiB and entities25.46/28.22KiB
(prod/dev) pass. Candidate bare11.84/14.18KiB and entities27.47/30.27KiB fail both
prod and dev ceilings. No ceiling was raised.

Fresh production demo: baseline563.16kB, candidate572.69kB, increase9.53kB (~1.7%).
Both exceed the525kB warning threshold; only candidate exceeds the570kB error
threshold, by2.69kB. Candidate demo build exits1 after emitting size diagnostics;
this is a failed build, not a successful artifact gate. Package builds succeed.

## Replay

Use Node24.15.0 and pnpm10.17.0, including subprocess PATH. From each exact checkout:

```sh
NX_DAEMON=false pnpm nx run-many -t build -p kernel angular react vue solid --configuration=production --parallel=1 --skip-nx-cache
NX_DAEMON=false pnpm nx build demo --configuration=production --base-href=/ --skip-nx-cache
node tools/check-bundle-budget.mjs
```

Then from candidate root, with BASELINE pointing to a freshly built exact8d checkout:

```sh
python3 docs/research/b-native-integration/qualification/measure/run.py "$BASELINE" /private/tmp/b-cost-replay node
python3 docs/research/b-native-integration/qualification/measure/summarize.py /private/tmp/b-cost-replay
node docs/research/b-native-integration/qualification/measure/bundles.mjs "$BASELINE" "$PWD" /private/tmp/b-bundle-replay
```

Use fresh output directories; scripts preserve each result rather than selecting
successful retries. Full dependency hashes, commands and first harness failures
are in evidence.tar.xz. Independent measurement review corroborates the bounded
comparison; source/semantic rejection remains independent of these costs.
