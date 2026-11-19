# Bounded C22 bundle cost attribution

Disposition: the four C22 budget failures remain. This comparison supports a product cost decision, not a budget increase, optimizer change, API activation or release acceptance. No additional build is needed for this attribution.

## Identity and execution

Production source: `87f6831fa60cafe87508f0ace84b7638698ca3b0`, freshly extracted by `git archive` into this packet's `candidate`. C22 source manifest: `9ed147cfe0b48c0287c38a20a86a84a825b41741d1e5ea5daa2b917af3633d5d`, existing successfully built candidate at `../c22-full-build-diagnostic/candidate`. Root HEAD was inspected at `628d302dadb082a48c58528651c9088234d0a777`; unrelated root edits were untouched. `SOURCE-DELTA.json` identifies the actual baseline/C22 kernel source differences, not a root-HEAD proxy.

Both use `/Users/jonathanborgia/code/signaltree/node_modules` through the same root linkage, Node24.15.0 and pinned pnpm10.17.0; esbuild0.25.12. Baseline `.nvmrc` and packageManager match. Baseline command, exactly once: pinned corepack `pnpm nx build kernel --skip-nx-cache --outputStyle=stream`. Own cache/data/tmp/output; original diagnostic preload behavior retained with its output destination relocated, excluded-data Node report flags retained. `run/COMMAND.json`, `run/node-ready.jsonl`, `run/first.log`, `PREPARED.json`, `BASE-MANIFEST.json` preserve details.

Important execution limitation: the original supervisor failed on sandbox-denied `ps` immediately after launching PID26908. Its first failure is preserved in `SUPERVISOR-FIRST-FAILURE.txt`. Escalated inspection verified Nx26913 parent26908 and Rollup26999 parent26913 with a separate Rollup group and attested scratch cwd. The adoption attempt found launcher already exited; it did not launch a replacement. Nx logs report successful kernel build; subsequent `ps -p 26908,26913,26999 -o pid=,ppid=,pgid=,lstart=,command=` returned no rows. This is one completed build with success receipt, not a captured waitpid exit code or uninterrupted deadline supervision. No report, forced exit, config edit, retry or stop was used. Historical missing audit-tsconfig warnings remain raw. This tooling limitation does not make the emitted bytes another source, but is not normal-exit process qualification equivalent to the earlier C22 full-chain receipt.

Existing C22 artifacts were not rebuilt. `ARTIFACTS-BEFORE.json` / `ARTIFACTS-AFTER.json`, `VERIFIED.json`, and `SOURCE-VERIFIED.json` record identities and checks. C22 kernel bytes match the earlier full-chain `run/ARTIFACT-IDENTITY.json`. Source files remain unchanged. First whitespace-only identity-report mistake is retained separately; corrected verification compares file hashes.

## Measurements

| Gate fixture | Production baseline gzip bytes (KiB) | C22 gzip bytes (KiB) | Increase bytes (KiB) | Existing ceiling KiB |
|---|---:|---:|---:|---:|
| bare prod | 12660 (12.3633) | 17951 (17.5303) | 5291 (5.1670) | 12.41 |
| bare dev | 15094 (14.7402) | 20355 (19.8779) | 5261 (5.1377) | 14.79 |
| entities prod | 26898 (26.2676) | 44366 (43.3262) | 17468 (17.0586) | 26.16 |
| entities dev | 29750 (29.0527) | 47372 (46.2617) | 17622 (17.2090) | 28.98 |

Fresh production already exceeds the two entity ceilings (about0.108/0.073KiB); ceilings are not baseline measurements. That does not account for or excuse C22's much larger increase. Prod/dev differences are baseline2434/2852 bytes versus candidate2404/3006 bytes for bare/entities. The major increase survives production defines; these numbers alone do not prove every diagnostic folds correctly.

`tools/check-bundle-budget.mjs` is byte-identical in both arms: SHA256 `df55eac6244aa92a4972358fda41b8cbe809caf3c97745a814e9aa8aa8c7215a`. Its original source remains untouched. Diagnostic copies retain exact snippets, measurement function, minification, ESM/browser, treeShaking, legalComments:none, external Angular/rxjs/tslib, gzip level9, and prod `ngDevMode:false` / dev empty defines. The capture wrapper adds only `metafile:true` and records output/options; CORE and nodePaths point to the identified arm. `*-graphs/HARNESS.diff` exposes every harness change. Commands are in each `COMMAND.json`; execute pinned `node <arm>-graphs/gate.mjs` from this packet. One successful measurement per arm, four bundles each. The first relocation attempt failed resolution before any output and is preserved in `baseline/` and `C22/`; corrected diagnostic directories are separate. No package rebuild followed. C22 reproduces Main's previous gate output. Eight emitted fixture bodies were imported and their sinks checked: bare `[1,"b"]`, entity `[{id:1,name:"b"}]` (`FIXTURE-RESULTS.json`). These are useful fixture checks, not full runtime qualification.

## Retained graph versus optional API

All four C22 graphs parse `experimental-publication/{lifecycle,recipient-occurrence,projection,private}.js`, but assign none any output bytes. `lib/link.js` also contributes zero. These inputs appear in the dependency graph through index/link imports, not in emitted code. `experimentalRetained: []` is evidence that those particular modules are eliminated in these exact fixtures and flags; it is NOT absence of publication-related cost, absence of runtime work, or universal dead-code proof for every consumer. Neither fixture imports/uses Link. No extra Link fixture was run.

The graph and source distinguish two boundaries:

* Optional publication implementation: `link.ts:2,11` imports experimental entity/private machinery; `private.ts:123,138` registers snapshot/native publication factories when that module is included. The parsed Link/private edges do not survive these gate bundles. `link.ts:1166–1180` still constructs the experimental `declare` member when Link itself is used. That public-surface decision remains separately gated; its presence is not the cause demonstrated for these two no-Link bundle overages.
* Ordinary construction/write support: `signal-tree.ts:3,1957` imports and calls `registerNativeOccurrenceRoot` on construction. `native-occurrence.ts:6–23` creates weak identity registries and records registry→root identity. `materialize-markers.ts:35,809–819` references native occurrence preparation behind the membership preparer condition. `intrinsic-mutation.ts:48–51,231–241` keeps native-factory hooks on ordinary source registration; the factory is optional but the registration/dispatch plumbing is retained. `entity-signal.ts:11,1866–1867` constructs `EntityPublicationSource` and wires disposal; its normal entity paths carry packet, physical/ordinary and placement support. These are real source-owned initialization and write-path edges in these no-Link artifacts, even though experimental-module labels disappear.

Source paths above are relative to the frozen C22 candidate's `packages/kernel/src/lib`. `GRAPH-EDGES.json` and raw metafiles retain exact resolved artifact paths, imports, and output contributions. Static import edges alone do not prove a function executes for this fixture; output contribution proves bytes retained, while the unconditional source construction sites identify execution obligations. Conditional preparation branches must not be described as always executed.

## Shared and entity-specific retained costs

Production minified totals: bare37464→53782 (+16318), entity88763→147808 (+59045). These are uncompressed emitted bytes, not additive gzip assignments. Selected module contributions/deltas:

| Module | Bare baseline→C22 (delta) | Entity baseline→C22 (delta) |
|---|---:|---:|
| member-membership | 3212→6416 (+3204) | 3229→6484 (+3255) |
| native-occurrence | 0→2105 (+2105) | 0→2115 (+2115) |
| intrinsic-mutation | 1011→2858 (+1847) | 1011→2862 (+1851) |
| tree-scalar-slot-runtime | 2863→4330 (+1467) | 2863→4410 (+1547) |
| materialize-markers | 2124→3270 (+1146) | 2621→3782 (+1161) |
| location-runtime | 3617→4697 (+1080) | 4228→5505 (+1277) |
| signal-tree | 8939→10005 (+1066) | 9006→10085 (+1079) |
| tree-scalar-leaf-runtime | 1537→2357 (+820) | 1539→2359 (+820) |
| entity-publication | 0→227 (+227) | 0→5950 (+5950) |
| entity-signal | eliminated | 35877→59009 (+23132) |
| entity-mutation-frame | eliminated | 2578→5322 (+2744) |
| entity-value-store | eliminated | 480→2561 (+2081) |

Additional bare contributions include construction-allocation650, plain-branch-membership519, snapshot-authority604→1122 (+518), mutation-capture-runtime745→1249 (+504), publication-preparation411 and snapshot-installation253. Entity-specific new placement contributions include entity-placement-stage1982, entity-ordinary-topology1820, prepared-placement-visibility1498, order-restores-for-placement935 and ordinary-restoration-placement743. Complete per-arm/module data is in `ATTRIBUTION.json`; generated temporary entry paths appear as different keys and must not be mistaken for source growth.

These shared deltas show the overage is not only an EntityMap or optional API issue. Conversely, module labels cannot distinguish all correctness/read-freshness/atomicity work from experimental support inside the same module. No source ablation was run, so assigning the entire delta to publication policy would be unsupported.

## Interpretation and limits

Decisive: no-Link users of these exact fixtures pay retained native occurrence, registration, snapshot and entity publication/placement support. The optional experimental implementation modules themselves are eliminated. Thus a claim that merely tree-shaking `declare` fixes the measured overage is contradicted by these graphs.

Not decided: whether that eager support is unnecessary for an application that never uses Link, or can safely be deferred while preserving later enrollment, exact source/recipient evidence, readiness, reentry, current reads and physical/lifetime identity. Some hooks are dormant absent registration, while source facts are deliberately captured with installation rather than reconstructed from delivery (`entity-publication.ts:6`; `native-occurrence.ts:5`). This is evidence of the current eager design, not a proof that all bytes are semantically inseparable. A safe deferred-registration or split-authority design is a hypothesis needing its own concrete semantic proof; no optimization is proposed or implemented here. Equally, eliminating eager evidence without those controls is not justified by the no-Link fixture alone.

Run falsifiers: one fresh exact production kernel build; identical-tool check; exact-flags emitted graphs for both arms; eight useful sink assertions; source/artifact identity checks; C22 original-build identity match. Not run: extra builds, repeated sampling, timings, optional-Link consumer graph, ablation, optimizer changes, diagnostic-foldability suite, broad tests, release/package acceptance. Host pressure was reported during work (32GiB physical,23271.5MB swap used, compressor830947×16KiB); no causal resource or performance conclusion follows. Main's concurrent consumer verification is separate.

Recommendation: retain the four C22 cost failures and separate public API gate. Present the measured +5.167KiB bare/+17.059KiB entity production cost to the owner, together with the genuine baseline entity overage. Any cost acceptance or scope redesign needs an explicit product decision; this review neither hides the method nor raises ceilings nor authorizes production activation.
