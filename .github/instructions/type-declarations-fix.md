# Declaration contract

This v15 worktree emits runtime modules separately from one shared declaration
graph with `index`, `adapter` and `internals` entries. Private declaration chunks
preserve nominal identity across the entries; the manifest includes them through
`dist/**/*.d.ts`. The October 1 packed Studio/observer checks exposed missing
root type exports and duplicated brands in the former separate bundles. The
shared graph replaces their identity-rewriting plugins without exporting private
brands. See the [takeover record](../../docs/audits/2026-10-01-performance-takeover.md).

- Keep Nx per-source declaration and dts-bundle plugins out of the kernel runtime
  configuration. Runtime transpilation and declaration generation have distinct jobs.
- Use the checked-in `packages/kernel/rollup.custom.mjs` as configuration authority.
  Do not introduce new nominal-identity splits or export private brands as an
  ad hoc repair. Do not split the declaration graph into independent bundles
  without proving cross-entry nominal identity in actual packed consumers.
- Do not add post-build declaration copying, pruning or unverified rewrites.
- Verify actual packed consumers with `node tools/verify-consumer-typecheck.mjs`:
  both bundler and node16 resolution, `skipLibCheck: false`, and the current
  facade/marker identity fixtures and tooling readers applied to a tree with
  opaque object leaves. Inspect the verifier's SAMPLE and negative cases before
  claiming coverage; passing source typechecks cannot prove packaged identity.
- Run affected artifact gates from `tools/verify-gates.mjs`, including declaration
  documentation. Tarball resolution alone is not type correctness.

The absence of an `engines` field remains deliberate for these browser libraries.
Repository tooling versions belong to `.nvmrc` and `packageManager`; framework
consumer requirements belong to declared peer support. Do not add Node runtime
constraints just to mirror the build machine.
