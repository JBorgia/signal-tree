# Fixture-only type repair

Frozen input: /private/tmp/st-occurrence-successor.
Scratch: /private/tmp/st-fixture-types-aj63tgdb/candidate.
Only source difference: packages/kernel/src/lib/core-independent-review.spec.ts.
Patch: fixture-only.patch (apply to a future scratch candidate, not the frozen one).

The initial literal supplies branch.rows before the test omits the branch. The
fixture narrows that initial reference with its concrete TreeNode construction
shape. The Link call supplies the exact snapshot-reader generic explicitly for
this internal runtime regression. Collection-containing roots remain excluded by
ordinary public Link inference; this test does not qualify public admission of
that shape. Existing Experimental declaration casting is unchanged. No any,
ignore directive, new never-cast, public type change or ratchet change was added.

All existing assertions and runtime actions remain unchanged. TypeScript 6.0.3
and esbuild 0.25.12 emit byte-identical JavaScript before/after (emit-results.json).
No runtime guards were necessary; no runtime code changed.

## Commands and outcomes

Use PATH=/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:$PATH,
NX_DAEMON=false NX_ISOLATE_PLUGINS=false; cwd is scratch candidate unless noted.

- `node tools/check-spec-types.mjs`: exit 0. No ratchet update. This is the existing
  repository gate, not a claim that all inherited spec debt is zero.
- `node node_modules/typescript/bin/tsc --noEmit -p ../tsconfig.fixture.json`:
  exit 0, empty diagnostics. Focused real compile includes this fixture and its
  imported source graph, with inherited strict spec configuration.
- `pnpm nx test kernel --skip-nx-cache --testFile=core-independent-review.spec.ts`:
  exit 0; two original tests pass.
- `pnpm nx test kernel --skip-nx-cache occurrence-successor.spec.ts native-certificate-successor.spec.ts core-independent-review.spec.ts collection-contributor-core.spec.ts publication-terminal-consumer-independent.spec.ts`:
  exit 1; 31 pass, one fails. Unchanged known failure is
  native-certificate-successor.spec.ts:61, “omission then restored retained
  collection selects matching payload and support”. Not waived or counted green.
- `node ../emit-check.cjs`: TypeScript and esbuild emissions identical.

The first focused config invocation outside the checkout could not resolve node
and vitest/globals type libraries. Its diagnostics are retained in
focused-compile-first-config-failure.log. A node_modules tooling symlink beside
that external config fixed resolution; no compiler option or type was weakened.
Frozen 010-spec-types-final.log is retained as frozen-spec-first-failure.log.

Integrity: all 2,918 frozen manifest files match their original hashes. Scratch
manifest differs only in the one fixture. spec-type-baseline.json is unchanged.
See identity.json and integrity.json for fixture/patch hashes. No root repository,
frozen candidate, public API, runtime or native acceptance state was changed.
This patch removes the two fixture errors; it does not qualify the native candidate.
