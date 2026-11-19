# Late first Link loading — source/artifact reachability premise

**No supported-public-path defect demonstrated. A late first registration path remains plausible under code splitting, but the existing controls do not establish that path.** Inspected retained8f9 source and its actual dist/exports, not an assumed monolithic artifact. No API changes, build, runtime experiment or release sign-off.

## Concrete artifact facts

The retained `dist/packages/kernel/package.json` exposes root, adapter, internals and package.json; it declares sideEffects:false. Root resolves to dist/index.js. That file statically re-exports Link from `./lib/link.js`, alongside tree/markers/enhancers. Emitted lib/link.js has a top-level `registerEntityPublicationFactory(createEntityPublicationParticipant)` call. Source link.ts:63–65 expressly puts registration at module initialization. `tools/build/create-rollup-config.mjs:103` sets preserveModules:true; this artifact is not monolithic FESM. The source package manifests and preserved module layout agree.

`internals/entity-publication.ts:130–133` holds the factory in module-local state and rejects a second registration. `nativeParticipant()` at line198 lazily calls that factory. Thus “first link() call” and “first evaluation of Link's module” are materially different events. Existing writes-before-link controls whose root dependency graph already evaluates Link do not qualify first-module lateness.

For ordinary unbundled ESM imports of the package root, even an import using only signalTree evaluates the root's static dependency graph, including Link, before importer application code runs. A later dynamic import of that same resolved root reuses the already evaluated module; it is not late first registration. Static framework-root re-exports/imports likewise cannot alone establish late first evaluation.

## What current consumer evidence establishes

The retained gate `tools/verify-entity-registration-artifacts.mjs:368–399` reads production metafiles and requires positive contributed bytes for Link plus experimental-publication/entity on Link consumers, and absence of both on the no-Link consumer. It also checks installed facade imports share Link/error identities. These are valuable selective-retention/single-runtime controls. They are not a code-split initial-versus-lazy reachability proof.

A bundler may eliminate unused root re-exports from the initial chunk yet retain Link for a later dynamic entry. A different bundler or graph may hoist registration into an initial/shared dependency instead. A dynamic namespace is not by itself proof of late evaluation. Two independently bundled copies can instead create different module-local factories and private symbols; that is a duplicate-runtime experiment, not evidence that late registration reaches an existing collection in the same runtime.

The adapter subpath is a supported realization SDK, explicitly not ordinary application API (`src/adapter.ts`). A private source deep import or runtime reset bypassing package exports does not prove application reachability. Nor does SDK construction alone prove the full EntityMap/pending-transaction setup is obtainable before root evaluation: every prerequisite import must be traced. No need to invent an export or require unused Link in no-Link applications.

## Smallest remaining discriminator, if pursued

First qualify a public-root consumer graph using one installed8f9 package identity and a supported bundler's splitting mode: initial tree/entity/transaction imports, a real pending operation, then a lazy module importing Link through the same public root/facade. Inspect emitted graph before interpreting behavior. Require that the initial evaluation closure excludes registration, the lazy closure includes it, and both refer to the same entity-publication and ownership runtime modules. If registration was already initial, record that the fixture did not reach the requested path. If separate runtime copies appear, reject that fixture as the wrong discriminator.

Only after those graph obligations hold is a behavior test useful: pre-lazy pending state, actual late Link enrollment, no premature output, then meaningful settlement output/state. Preserve the first outcome. This is a proposed narrow reachability falsifier, not a requested or executed new campaign. Existing no-Link control must remain selective; forcing Link into it would erase the question.

Until such a graph exists, classify TODO's late-first item as an unqualified loading-model question, not a demonstrated public release blocker or completed late-enrollment guarantee. The inspected local retained artifact does not independently establish the layout of any separately published npm version.
