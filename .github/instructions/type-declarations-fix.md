# Type Declaration Publishing

Kernel runtime JavaScript and public declarations are emitted by one Rollup
invocation. Runtime modules remain preserved under `dist/**/*.js`; declaration
bundles are emitted directly as `dist/index.d.ts` and `dist/adapter.d.ts`.

## Required Configuration

- Remove Nx's `typescript` and `dts-bundle` plugins from the kernel runtime
  configuration.
- Add `@rollup/plugin-typescript` for runtime transpilation with declarations
  disabled.
- Add one `rollup-plugin-dts` configuration per public TypeScript entry point.
- Emit declarations directly into the final package layout.
- Point `types`, `exports.*.types`, and `files` at `dist/**/*.d.ts`.
- Do not copy, rewrite, or prune declarations after Rollup completes.

Framework package production builds resolve kernel types from the built kernel
declaration entries. Their Nx targets depend on the kernel build, so the
artifact is available before Angular or React compiles.

## Validation

```bash
pnpm nx build kernel --skip-nx-cache
node tools/verify-consumer-typecheck.mjs
npm run validate:types
bash scripts/verify-dist.sh
node scripts/verify-package-hygiene.js
node tools/check-declaration-docs.mjs
```

The consumer verifier packs the package and compiles with
`skipLibCheck: false` under both `bundler` and `node16` module resolution.
