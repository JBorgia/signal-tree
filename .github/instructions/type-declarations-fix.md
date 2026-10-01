# Declaration contract

Kernel Rollup configuration emits runtime modules and a single shared declaration
graph for `index`, `adapter` and `internals`. The graph preserves nominal types
across entries. Private shared declaration chunks must ship with the public entry
files through the manifest's `dist/**/*.d.ts` pattern.

- Keep Nx per-source declaration and dts-bundle plugins out of the kernel runtime
  configuration. Runtime transpilation and declaration generation have distinct jobs.
- Use the checked-in `packages/kernel/rollup.custom.mjs` as configuration authority.
  Do not split nominal identities into independent per-entry bundles or export
  private brands to repair them.
- Do not rewrite, prune or copy declarations after generation.
- Verify actual packed consumers with `node tools/verify-consumer-typecheck.mjs`:
  both bundler and node16 resolution, `skipLibCheck: false`, facade identity,
  hydration and negative Link-admission fixtures.
- Run affected artifact gates from `tools/verify-gates.mjs`, including declaration
  documentation. Tarball resolution alone is not type correctness.

The absence of an `engines` field remains deliberate for these browser libraries.
Repository tooling versions belong to `.nvmrc` and `packageManager`; framework
consumer requirements belong to declared peer support. Do not add Node runtime
constraints just to mirror the build machine.
