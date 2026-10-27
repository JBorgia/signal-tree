# Exact replay

Use the test-only checkout `/private/tmp/link-evidence-combination-review` with
Node24.15.0 and pnpm10.17.0. Its runtime is rejected scalarb9eef50d, with one new
test file and no entity draft. The archived test-only bundle records its final SHA.

```sh
cd /private/tmp/link-evidence-combination-review
mkdir -p /private/tmp/link-membership-pinned-bin
cat > /private/tmp/link-membership-pinned-bin/pnpm <<'SH'
#!/bin/sh
exec corepack pnpm "$@"
SH
chmod +x /private/tmp/link-membership-pinned-bin/pnpm
PATH=/private/tmp/link-membership-pinned-bin:$PATH \
COREPACK_ENABLE_NETWORK=0 NX_DAEMON=false NX_ISOLATE_PLUGINS=false \
corepack pnpm nx test kernel --skip-nx-cache -- \
  src/lib/publication-obligation-combination.spec.ts

PATH=/private/tmp/link-membership-pinned-bin:$PATH COREPACK_ENABLE_NETWORK=0 \
node tools/check-spec-types.mjs
```

FIRST.log used the initial12-case file (PREREG.spec.ts) and records6pass/6fail.
The final file appends2 review-added cases; the above full-file command on that
version is a combined replay command, not a claimed combined execution.
The actual second command was the same Nx invocation with
`--testNamePattern="inherited possible-p"`; SECOND.log records2pass/12filteredskip.
First12 emitted JavaScript is unchanged. Both spec-types runs pass the unchanged
ratchet. No repeated sampling or runtime repair was performed. The wrapper keeps
the runner's child pnpm on the repository pin.
