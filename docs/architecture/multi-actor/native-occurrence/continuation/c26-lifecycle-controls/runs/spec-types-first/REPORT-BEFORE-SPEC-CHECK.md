# Independent finite scalar lifecycle controls

Five new public-operation cases passed unchanged on both C25 and C26. First invocation on each exited 0; no retries, oracle changes, runtime edits or broad suites. No C26 runtime implementation was read while writing the assertions. Tests use the actual neutral kernel native-publication path; they do not claim Angular/Vue/Solid/React timing coverage.

| Comparator | Frozen manifest SHA-256 | Result |
|---|---|---|
| C25 | 9f3622a1231437c7f9cb732a1d2b3d0aa501ba45feee0c7a051f1e282b458f02 | 5 passed, exit 0 |
| C26 | 8055911bdd78c9df536bc8a7e1ea8bf3e74427c64675fbc8d0a566c0d91aa38f | 5 passed, exit 0 |

All 3,083 manifest files per source were verified while constructing isolated copies. Each run's after-check found zero source-file changes and the exact test overlay unchanged. Source identities/manifests, commands, versions, exits and raw first logs are preserved. Dependencies were symlinked to the working root node_modules; root/frozen input runtime was not executed or edited. Both runs verified Node v24.15.0 and pnpm 10.17.0. No offline dependency/provenance guarantee is inferred from the symlink.

Command, in each isolated copy:

`corepack pnpm nx test kernel scalar-horizon-lifecycle-controls --skip-nx-cache --maxWorkers=1`

The passed assertions cover p/q hold and exact terminal delivery after setter completion within an open declaration, no source recipient during repeated derived invocations followed by useful late enrollment, source replacement with a saved snapshot consumed through a real holder updater, Link disposal inside the horizon without dropping source obligations, and nested installed work plus exact outer error identity and subsequent fresh declaration progress. All fixtures destroy their owned trees and dispose Links; terminal paths assert settlement and duplicate suppression.

No explicit retention/listener introspection is included. An inside-callback empty-send assertion alone cannot distinguish a readiness barrier from ordinary queued transport; later failure/owner/settlement assertions provide behavioral counterweights, not direct phase-state measurement. Because C25 also passes, this is a semantic preservation packet, not a discriminator proving C26 normalization works. It does not close component/getter ancestry, idle-source cleanup, all-root bounds, finish-before-activation reachability, or implementation review. PLAN.md separately specifies those observations without injecting internal proofs or inventing a public scheduling path.

No source/spec type check was run in this bounded lifecycle-only execution; Vitest transpilation is not a type gate. Promotion still needs independent test/source review and applicable type checks. The frozen C25 derived-growth diagnostic and first log remain separately preserved under C25-preserved; their diagnostic pass is not misreported as a bound qualification.

Artifacts: TESTS.patch, packet/packages/kernel/src/lib/scalar-horizon-lifecycle-controls.spec.ts, SOURCE-IDENTITY.json, C25-MANIFEST.json, C26-MANIFEST.json, runs/{C25,C26}/{COMMAND.json,PROCESS.json,RESULT.json,first.log}, and SNAPSHOT.json. No automatic composition or runtime acceptance is implied.
