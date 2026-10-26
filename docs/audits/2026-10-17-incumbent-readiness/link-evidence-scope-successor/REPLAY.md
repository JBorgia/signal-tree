# Exact replay and provenance

Use Node24.15.0 and Corepack-pinned pnpm10.17.0. The preserved isolated checkout is
`/private/tmp/link-evidence-scope-successor`, clean at
`2dacae7b9e9137018d05c4e00382ac9287bc76d4`. Dependencies were linked from the preserved
predecessor experiment. No dependency version was changed. Nx caching was disabled.

```sh
cd /private/tmp/link-evidence-scope-successor
git rev-parse HEAD
git status --short
node --version
COREPACK_ENABLE_NETWORK=0 corepack pnpm --version
COREPACK_ENABLE_NETWORK=0 NX_DAEMON=false NX_ISOLATE_PLUGINS=false corepack pnpm exec nx test kernel --testFile=packages/kernel/src/lib/publication-independent-isolated-omission-input.spec.ts --testFile=packages/kernel/src/lib/link-native-address.spec.ts --skip-nx-cache
```

Expected reproduced result:10 pass/2 fail. The omission sends0 with declared basis
while p is pending; default entity copy sends7 before source confirmation.

The useful corrected enrollment/native/membership subset was included in SECOND;
this smaller combined command is a convenient replay, not an additional historical
run or a new qualification result:

```sh
COREPACK_ENABLE_NETWORK=0 NX_DAEMON=false NX_ISOLATE_PLUGINS=false corepack pnpm exec nx test kernel --testFile=packages/kernel/src/lib/publication-native-provenance.spec.ts --testFile=packages/kernel/src/lib/publication-enrollment-adjudicated.spec.ts --testFile=packages/kernel/src/lib/publication-evidence-scope-controls.spec.ts --testFile=packages/kernel/src/lib/publication-membership-provenance.spec.ts --skip-nx-cache
```

Fresh exact predecessor default control (already executed,9pass/1fail):

```sh
cd /private/tmp/link-evidence-scope-successor-control
git rev-parse HEAD
COREPACK_ENABLE_NETWORK=0 NX_DAEMON=false NX_ISOLATE_PLUGINS=false corepack pnpm exec nx test kernel --testFile=packages/kernel/src/lib/link-native-address.spec.ts --skip-nx-cache
```

Expected HEAD8212736242e1f85f7e3288dbb0ebda99a575e3b2. This control preserves the
no-send assertion then fails post-confirmation progress. New test-only files in
the control do not modify runtime or the selected original spec.

Final source and spec checks (already executed):

```sh
cd /private/tmp/link-evidence-scope-successor
COREPACK_ENABLE_NETWORK=0 corepack pnpm exec tsc --noEmit -p tsconfig.typecheck-all.json
node tools/check-spec-types.mjs
git diff --check
```

## Archive reconstruction

successor.bundle is incremental, requiring
2d71d73305fea23173b3b681c2a897ef1a7dffba. In an existing repository containing that
base, `git bundle verify <absolute-path>/successor.bundle` verifies prerequisites;
`git fetch <absolute-path>/successor.bundle refs/heads/codex/link-evidence-scope-successor`
recovers the candidate without changing a working tree. Do not merge or activate
it. successor.patch.gz is the exact10-file diff from821 to2dacae. FROZEN-IDENTITY.json
lists the final714 observed file hashes. SHA256SUMS covers every archive payload
except itself. Verify with `shasum -a 256 -c SHA256SUMS` from this directory.

raw-evidence.tar.gz contains untouched full logs, original and corrected fixtures,
four paired run snapshots, first type failures, reviewer first tests and root
verification. Its raw logs include the exact Nx file lists for FIRST, SECOND,
composition and baseline. These runs overlap; no summed test total is valid.
The raw FIRST/SECOND snapshots describe their earlier sources. Only the final
frozen identity matches composition/review/root replay; there is no claim that
all earlier outputs were freshly generated at the final commit.
