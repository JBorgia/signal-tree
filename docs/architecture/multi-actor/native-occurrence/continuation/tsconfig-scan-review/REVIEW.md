# Independent C20 resolver-scan review

**No blocking defect or meaningful missing alias found for the current importing projects.** The two-file configuration patch is supported for bounded composition review. This is not ordinary dependency-build or release sign-off. Review is source/raw-evidence only: no duplicate tests, graph generation, build, server startup, root changes or candidate edits.

Exact reviewed successor manifest:11c093b513c2b75d82f9c4ef3c2c71970ebb66aaba722419fe351a046c3c7b88. Patch:76ab5435fe551ec17a44911a6840d6c06c25a6b326cabe5308cfd0ad66e73a19. Independently verified all3066 manifest paths, and the only differences from the base manifest are packages/react/vitest.config.ts and apps/react-reference/vite.config.mts. Verification and evidence hashes accompany this report.

## Resolver scope and errors

Installed vite-tsconfig-paths5.1.4 dist/index.js:78–95 selects explicit projects instead of tsconfck.findAll; absolute fileURLToPath/new URL paths remain absolute when resolved against projectRoot. This genuinely bounds discovery under both Nx config loading and direct Vite invocation. It does not rely on cwd or an archive-directory ignore.

Plugin lines117–160 parse selected configs, add their referenced configs and register those before the solution parent. Installed tsconfck3.1.6 src/parse.js:151–165 parses those direct references and their extends chains; the live references here are one-level lib/spec and app/spec, so the mechanism covers the actual shape. Do not generalize this proof to arbitrary future transitive-reference trees. Empty solution include/files means the parent resolver is skipped (plugin231–236), while referenced lib/app/spec include/exclude rules govern their importer domains. The inheritable root paths are parsed through extends; separately scanning the root config is unnecessary for these current importers.

For React tests, the React project covers lib/spec files. For the app, both app and React projects are selected, so a source import crossing into the facade has the facade's resolver available. Existing explicit kernel/adapter-before-kernel aliases remain unchanged and select runtime source rather than the facade lib config's declaration-output mappings. App @signal-tree/react inherits the root source mapping. Importer directory traversal, extension restrictions and include/exclude checks remain installed-plugin behavior, not widened by the patch.

There is no ignoreConfigErrors, logger override or catch added. Parsing failures in selected live configs/references/extends still reach the existing config.logger.error path (plugin123–138). Be precise: this plugin already logs then returns null for failed config parsing; the patch does NOT create a new fail-fast guarantee. Archived configs are intentionally no longer queried by these two resolver invocations; their broken extends errors are neither fixed nor claimed absent under independent archive tooling. That is scoped selection, not suppression of errors in the selected live projects.

## Imports, projects and evidence

An independent TypeScript AST import/export/dynamic-import inventory of React source/tests, app source/tests, and kernel non-spec source found only these internal bare imports: @signal-tree/kernel, @signal-tree/kernel/adapter, @signal-tree/react. Other bare imports are installed react/react-dom, @testing-library/react and vitest. No currently needed alias was dropped. Kernel runtime source has no additional internal bare-alias dependency requiring its own resolver config in these routes. IMPORTS.json and the inventory script preserve exact evidence. This is a current-import result: importing another workspace project's source later may require adding that importing project; a root paths entry alone does not grant resolver coverage to every other project's files.

The seven recorded resolveId assertions use actual Vite plugin containers and exact expected paths. Six chiefly exercise preserved explicit kernel aliases; the app-to-React assertion exercises inherited paths resolution. They support the stated routes, not all possible aliases. Source inspection supplies the reference/importer-domain reasoning. Existing harness HMR/socket-denial warnings remain limitations of server startup, despite successful resolution assertions; no clean dev-server startup is inferred.

Independently compared complete graph nodes (not only names) and dependency edges after normalizing only /private/tmp/st-*/candidate checkout prefixes: equal. All ten projects remain: held-continuation-probe, react-reference, angular, kernel, react, solid, demo-e2e, vue, demo and @signaltree/source. Counted1574 test-ci-- target occurrences, unchanged, including root archival targets. This is discovery metadata, not1574 executed tests. No .nxignore, test-discovery or unrelated project-config change is present.

Raw debug graph evidence loads React lib/spec/parent and app app/spec/parent paths, with no archived-tsconfig parse. Original warning evidence points to an archived unknown-dynamic-access config extending a nonexistent /private/tmp source. The five reports are repeated error reports, not proof of five distinct bad live configs.

I checked raw results: React94 tests/17files; reference26 tests/2files; direct reference build exit0. These are the author's preserved executions, not independently repeated runs. They meaningfully cover current test/bundle paths. No broad build/test repeats were needed for this review.

## React dependency build is a separate unresolved limit

The ordinary build log shows kernel runtime/declarations completed, then react:build ran `rollup -c rollup.config.cjs`, emitted React files and was subsequently terminated; final Nx failure identifies react:build, exit130. File emission does not mean task completion. The log alone does not prove idle CPU state or baseline causation.

React's unchanged Rollup config selects tsconfig.lib.prod.json and the unchanged tools/build/create-rollup-config.mjs pipeline; it does not consume either changed Vite/Vitest config or vite-tsconfig-paths. Nx config-loading/discovery does evaluate the changed configs, but its resulting complete targets/dependencies are identical. Thus the direct dependency task's implementation is distinct from the changed resolver path. This supports separating the build incident from config qualification; it does NOT establish the incident is inherited, unrelated under every resource interaction, or fixed.

The direct `--excludeTaskDependencies` app build passes and exercises the modified app Vite config. It cannot substitute for a successful ordinary dependency build. Keep that ordinary build incomplete/unqualified and preserve its raw first log. No semantic/runtime changes, alias addition, error-suppression workaround or broad validation request is indicated by this bounded review.
