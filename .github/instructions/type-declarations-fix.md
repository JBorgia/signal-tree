# Declaration contract

This v15 release worktree emits runtime modules and three declaration bundles:
`index`, `adapter` and `internals`. Its adapter identity plugin redirects marker
types to the root declarations; its tooling resolver reuses the root tree types.
These are deliberate nominal-identity fixes, not removable formatting work.
The manifest ships declarations through `dist/**/*.d.ts`.

The separate development branch has a single shared declaration graph. That
implementation and its extra fixtures have not been forward-ported here. Do not
describe this worktree as though they had.

- Keep Nx per-source declaration and dts-bundle plugins out of the kernel runtime
  configuration. Runtime transpilation and declaration generation have distinct jobs.
- Use the checked-in `packages/kernel/rollup.custom.mjs` as configuration authority.
  Do not introduce new nominal-identity splits or export private brands as an
  ad hoc repair. Preserve the existing identity plugins until a replacement is
  demonstrated by the packed consumers.
- Do not add post-build declaration copying, pruning or unverified rewrites.
- Verify actual packed consumers with `node tools/verify-consumer-typecheck.mjs`:
  both bundler and node16 resolution, `skipLibCheck: false`, and the current
  facade/marker identity fixtures. Do not claim fixtures present only on another
  branch; inspect the verifier's SAMPLE and negative cases.
- Run affected artifact gates from `tools/verify-gates.mjs`, including declaration
  documentation. Tarball resolution alone is not type correctness.

The absence of an `engines` field remains deliberate for these browser libraries.
Repository tooling versions belong to `.nvmrc` and `packageManager`; framework
consumer requirements belong to declared peer support. Do not add Node runtime
constraints just to mirror the build machine.
