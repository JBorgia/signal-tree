# Independent final artifact interpretation

**No blocker demonstrated to the diagnostic-reduction interpretation.** The saved matched graphs establish removal of the production diagnostic helper/allocations/table lookup while preserving development diagnostics. The reported gzip reductions reproduce from those exact files. All four absolute bundle ceilings still fail. This is a bounded artifact review, not a release/freeze approval; packed proof, lint/self-test and final freeze remain Main's work.

## Identity and matched measurement

Candidate: `/private/tmp/st-c28-r3-diagnostic-reduction/candidate`; base manifest `89058c7adf0bf680c3d8ef4778ff31d295ccc40d1911a31ac254484fa24a5c84`. The five source hashes in IMPLEMENTATION.md remain unchanged. Build, folding-successor and budget SOURCE.json records match the reviewed package-source hashes. Build receipt/log reports five projects successful with Nx cache skipped. I inspected those receipts; I did not rebuild.

Read `measure.mjs`, all eight raw JS graphs and relevant metafile records. Verified every graph SHA-256 and raw byte count against MEASUREMENTS.json; independently reproduced all eight gzip counts using Node 24.15.0 gzipSync level 9. Baseline graph hashes also match the graphs independently inspected in the premise review. Current graph, entry, metafile, generator, parity-fixture and relevant dist-module hashes are recorded in `artifact-evidence-hashes.json`.

Generator command is `node /private/tmp/st-c28-r3-diagnostic-reduction/measure.mjs`. It imports the workspace esbuild and feeds both arms through the same browser ESM bundler options: bundle/minify/tree-shaking, no legal comments, explicit ngDevMode=false only for production, and external Angular peers/rxjs/tslib. Both use the same candidate nodePaths fallback. Inputs are the existing baseline budget entry files, with only the candidate dist-root substitution. I verified the matched workload text: bare constructs/updates scalar/nested leaves; entities constructs/adds/updates a row and reads all(). These are neutral kernel consumer graphs, not all application/facade workloads. Their sink expressions preserve consumption; the measurement generator itself does not assert runtime results.

| Workload | Baseline gzip bytes | Candidate gzip bytes | Difference |
| --- | ---: | ---: | ---: |
| bare production | 18,344 | 18,267 | -77 |
| entities production | 44,764 | 43,953 | -811 |
| bare development | 20,745 | 20,648 | -97 |
| entities development | 47,756 | 47,629 | -127 |

These are exact compression results for identified artifacts, not timing, startup or memory results, and not universal savings across consumers. No claim of absolute budget compliance follows. The budget executable is byte-identical to baseline; the inspected budget run exits 1 with all four ceilings exceeded. No threshold relaxation was used.

## Raw emitted behavior

- **Candidate production entities:** no ST2026 literal, no `size>200` diagnostic body, no wrong-method hint table string, and no emitted predicate-churn-warning module contribution. The entity proxy reduces to `get:(i,a)=>typeof a=="string"&&!isNaN(Number(a))?ee.byId(Number(a)):i[a]`. There is no diagnostic table lookup or warning Set allocation on this path. An uninitialized `let Yc` remains immediately before the proxy and occurs only once. Thus “no allocated diagnostic state/helper/table” is supported; “every diagnostic-related declaration is gone” is too strong. This residual binding does not recreate a Map, Set or callable warning helper.
- **Candidate development entities:** metafile includes predicate-churn-warning.js. The raw factory is `function Pi(){let t=new Map,e=new Set,r=12,n=2e3;return function(c,s){...}}`. Both where and find call the same lazy collection variable `(xi??=Pi())` inside the original development guard. The wrong-method table remains; the proxy uses a collection-local lazy `(ao??=new Set)` and ST2002 warning. Source inspection in IMPLEMENTATION.md establishes the ownership scope; the graph confirms the factory and guarded calls survived compilation.
- **Bare graphs:** entity diagnostics are absent in both modes as expected for this entry shape, not evidence that development diagnostics were globally stripped.
- **All four candidate graphs:** the constants module's NODE_ENV selection is gone; all four baseline graphs contain it. Required readable errors remain covered by the separate consumer gate rather than being classified as warning text.

Inspected folding-successor log reports successful built-dist guard probes for kernel/angular/react/vue/solid and the neutral no-process runtime: development advisory present, explicitly defined production quiet, readable errors retained. Baseline-folding log preserves the ST2026 failure. These logs qualify explicit-define folding, not NODE_ENV-only automatic removal. I did not rerun the full gate or all facade consumers.

## Message parity and first-failure interpretation

Read both parity fixture versions, their diff, the first failure log and MESSAGE-PARITY.json. Independently replayed both fixtures in this review packet, changing only their output destinations so Main's evidence was not overwritten.

Corrected replay passes and exactly reproduces the saved JSON: 18 value/freeze contexts = two arms × three ngDevMode states × three process-environment states. That is nine paired configurations, not eighteen independent environment combinations per arm. Both expose the same three exact messages and frozen object.

Four additional accessor observations are deliberately **not** parity assertions: process and ngDevMode getters on baseline are observed and throw the sentinel; candidate reads neither and does not throw. Recorded baseline read count is three in this Node VM fixture; it is not a cross-engine contract or a source-level promised number of accesses.

The first fixture installed a host-side getter on the sandbox object before contextification. Its replay again fails with expected sentinel versus actual undefined on the baseline process case. The corrected fixture first creates the VM context and then installs a getter on that context's actual globalThis. It preserves the same strict baseline sentinel and candidate no-read assertions. This is a justified fixture-boundary correction, not a weakened assertion or a runtime source fix. It supports the intended removal of incidental import-time environment reads; it does not imply observational equivalence for arbitrary host/contextification behavior.

Reproduction artifacts: `artifact-message-parity.cjs`, `ARTIFACT-message-parity.json`, `artifact-message-parity-first.cjs`, `artifact-first-replay.log`. First replay exit 1 is expected evidence of the original fixture failure; corrected replay succeeds.

## Bounded handoff

Independent cheap checks ran: graph hashes/counts, gzip reproduction, entry equivalence, raw helper/proxy/table inspection, reviewed-source stability, budget-tool equality, and both parity-fixture replays. No candidate edits, builds, performance runs, package installs or release actions were performed. This confirms the narrow artifact interpretation for the identified files. Main must bind final packed/type/lint/self-test results and artifact hashes to its eventual freeze; this review does not preapprove later changes.
