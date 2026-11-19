# Fresh frozen R3 versus composed artifact costs

Both arms freshly reconstructed from verified manifests and freshly built through identical pinned canonical Nx five-package run-many targets, parallel1/skip-cache/stream, no prior dist reuse. Composed input2a020da77e263693fbee66973bfba7072cb489a7cbde53bcda4336d686f820cd; R3 inpute0b64de42df330abff455d2ee1b981c99abee187a77269cd064f52f3b08505f3. Both builds exit0 and retain source hashes.14 runtime source files differ (COMPOSITION-RUNTIME-DELTA.json).

The unchanged tools/check-bundle-budget.mjs is byte-identical across arms. Both canonical gates exit1/all four ceilings fail. Exact bytes below are from the separately preserved output-only metadata diagnostic of that tool: same workloads/options/ceilings, adds metafile and writes bundles/metadata; canonical rounded results agree. Instrumentation patches and provenance, complete emitted JS/metafiles, commands/results and artifact identities are retained for both arms.

| Workload | R3 gzip bytes | Composed gzip bytes | Composition delta | Frozen ceiling KiB |
| --- | ---: | ---: | ---: | ---: |
| Bare production |18081|18337|+256|12.41|
| Bare development |20480|20745|+265|14.79|
| Entities production |44508|44756|+248|26.16|
| Entities development |47498|47747|+249|28.98|

Thus composed17.91/20.26KiB bare and43.71/46.63KiB entities compare with freshR3 17.66/20.00 and43.46/46.38. Most of the cumulative overage exists before this composition. No ceiling change or claim that the whole gap is repair cost.

The largest bare minified module increases are scalar-responsibility-attachment319bytes, intrinsic-mutation202, scalar-admission-metadata129, owned-mutation121, tree-scalar-leaf-runtime98, owned-metadata68, tree-scalar-slot-runtime57. Entity attribution is similar (attachment321, intrinsic202, metadata129, owned-mutation121). These are esbuild bytesInOutput, NOT additive gzip attribution; global naming/compression affects total size. MATCHED-COSTS.json retains every module delta, not only the largest.

No emitted inputs from Link, experimental-publication, transactions or restoration implementation appear in these no-Link/no-enhancer workloads. The shared attachment/metadata paths do remain emitted through scalar/owned mutation imports. This proves measured reachability, not universal optional isolation or semantic necessity/irreducibility. No module deletion experiment, CPU claim, optimization proposal or new architecture inference.
