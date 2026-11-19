# Installed peer matrix — preparation only

Prepared for Helmholtz/main, 2026-10-29. No candidate qualification has run.
No root dependencies, candidate sources, production sources, or browser evidence changed.
No addressable Helmholtz agent messaging tool was available; this file is a handoff, not a claim of delivery.

## Freeze handoff required

Provide final kernel, Angular and Vue package tarball paths, SHA-256 hashes, and source manifest/hash for `/private/tmp/st-current-read-capability-proof`. Identify final public control sources. Mutable `dist/` and an older SOURCE-IDENTITY.json are not sufficient proof of frozen artifacts. Install precisely those tarballs in all three prepared directories; record lock integrity and installed package real paths. Do not rebuild or repack independently and silently call that the same artifact.

## Available matrix

- angular20: @angular/core/common/compiler/compiler-cli/platform-browser exactly 20.0.0; TypeScript 5.8.2, RxJS 7.8.2, tslib 2.8.1.
- angular21: corresponding Angular packages exactly 21.0.0; TypeScript 5.9.3, RxJS 7.8.2, tslib 2.8.1.
- vue350: Vue exactly 3.5.0, TypeScript 5.9.3, tslib 2.8.1.

All three npm installs exited 0. Exact lock hashes and direct resolved versions: PREPARATION-IDENTITY.json. Initial sandbox registry failure ENOTFOUND preserved in registry-angular20.log; network-authorized retry succeeded. Metadata proves Angular20 compiler-cli requires TS >=5.8 <5.9 and Angular21 >=5.9 <6.0. Each install used --ignore-scripts --no-audit --no-fund, cache under this directory, no overrides/legacy-peer-deps/force. Angular22 and Vue3.5.42 were already available elsewhere but do not prove these versions.

Generating install command (replace NAME with angular20, angular21, vue350):

    npm install --prefix /private/tmp/st-current-reader-peer-matrix/NAME --cache /private/tmp/st-current-reader-peer-matrix/npm-cache --ignore-scripts --no-audit --no-fund --fetch-retries=0 --fetch-timeout=30000

## Bounded installed controls after freeze

1. Strict consumer compilation with both Bundler and Node16 resolution, skipLibCheck false. The prepared tsconfig files intentionally have no consumer yet and have NOT been reported passing. Import only installed @signal-tree/angular or @signal-tree/vue and framework public exports. Assert native read-only carrier types and write shape without any, ambient package shims, source paths, or type suppression. If testing adapter authoring use the exported kernel/adapter SDK explicitly and separately from ordinary facade claims.
2. Retained public activeId/all/activeEntity query references across rollback tap callback; direct reads see restored A, then callback selection C and updated field. Keep native computed warm before the callback to check its native publication timing separately from direct freshness. Require final observer delivery; do not equate callback direct freshness with immediate observer publication.
3. Public rows.where throwing sentinel: identity of propagated error, counted evaluations, recovery after condition changes; fresh dependency errors must propagate, never return cached success. Use public native computed dependencies. Preserve exact first failure, including which peer and artifact. Do not import candidate adapter internals to claim public consumer coverage.
4. Held callback A→C→A/ABA with a newly created native computed: direct intermediate reads fresh, warmed observer remains correctly scheduled, newly born consumer eventually reflects final truth. Use real public transaction/tap boundaries, not injected private epoch controls. Freeze assertions before execution. Each case must prove callback/observer actually ran.
5. Angular AOT compilation via that matrix directory's compiler-cli/ngc if a component is included. No runtime compiler/JIT bootstrap workaround. Runtime public query probes can run without a component; distinguish these from DOM/AOT coverage. Existing tools/verify-angular-aot-consumer.mjs derives Angular and TS from the root manifest, so unchanged invocation would silently test Angular22. Reuse its artifact-integrity checks, not its peer selection. Vue synchronous and default scheduled watchers need distinct timing assertions.

Inspection copies of selected-callback-facade.spec.ts (both frameworks) are pinned under inspection-snapshot with hashes, solely to prepare these assertions. Private adapter tests are not public evidence. Freeze may supersede these snapshots; preserve both identities rather than overwrite.

Report per peer: unavailable install / strict type failure / runtime failure / pass. Keep package/compiler/runner failures separate from semantic failures. This is minimum-peer coverage, not exhaustive supported-range qualification, release approval, or proof of superiority.
