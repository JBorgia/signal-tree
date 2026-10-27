# Replay and identity

Node24.15.0; Corepack pnpm10.17.0. Use the isolated checkout or recover the
archived branch from `rejected-successor.bundle` in a disposable checkout which
already contains prerequisite `2dacae7b9e9137018d05c4e00382ac9287bc76d4`.

```sh
cd /private/tmp/link-membership-native-successor
git rev-parse HEAD
# 616892867796a1f0a185416b6be01331aaa7e9de
git status --short
# clean
node --version
corepack pnpm --version
mkdir -p /private/tmp/link-membership-pinned-bin
cat > /private/tmp/link-membership-pinned-bin/pnpm <<'SH'
#!/bin/sh
exec corepack pnpm "$@"
SH
chmod +x /private/tmp/link-membership-pinned-bin/pnpm
PATH=/private/tmp/link-membership-pinned-bin:$PATH \
COREPACK_ENABLE_NETWORK=0 NX_DAEMON=false NX_ISOLATE_PLUGINS=false \
corepack pnpm nx test kernel --skip-nx-cache -- \
  src/lib/native-window-preparation-audit.spec.ts
```

Expected preserved result:3 pass/1 fail. The failure is premature `[7]` after
target p confirms, before foreign q settles. No additional test was executed on
the frozen commit solely to restate that result:010 tested the identical source
before commits. `010-source.sha256` and `FINAL-SOURCE.json` identify the source.

The wrapper is necessary for the Nx child runner's bare `pnpm` invocation; the
host's default pnpm11 does not match the repository pin. Run through Nx, not a
root bare Vitest command. All numbered logs retain the expanded Nx command and
ordinary pass/failure/skip counts.003 matched no tests because positional paths
were repository-relative; use `src/lib` paths as above.

For the prior78-case vector use the same command with four files:

```sh
PATH=/private/tmp/link-membership-pinned-bin:$PATH \
COREPACK_ENABLE_NETWORK=0 NX_DAEMON=false NX_ISOLATE_PLUGINS=false \
corepack pnpm nx test kernel --skip-nx-cache -- \
  src/lib/membership-input-contract.spec.ts \
  src/lib/possible-owner-window-contract.spec.ts \
  src/lib/publication-independent-isolated-omission-input.spec.ts \
  src/lib/ordinary-member-publication-facts.spec.ts
```

This command documents reproduction; it is not an additional final run.006 is
the saved run. Do not turn a passing subset into qualification of the rejected
implementation. Entity, work/retention, framework and broad gates remain undone.
