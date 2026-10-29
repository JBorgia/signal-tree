# Exact replay

Preserved environment: Node24.15.0, Corepack pnpm10.17.0, dependencies already installed. Do not substitute system pnpm11. No network install is required in the existing worktrees.

## Decisive candidate tests

```sh
cd /private/tmp/link-collection-proof-successor
git rev-parse HEAD
# Must be 87ddcfdedcb5d91e700d812bd6cbee2f77038510; no runtime dirty files.
export PATH=/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:/private/tmp/link-membership-pinned-bin:$PATH
export COREPACK_ENABLE_NETWORK=0 NX_DAEMON=false NX_ISOLATE_PLUGINS=false
corepack pnpm nx test kernel --skip-nx-cache -- --testFile=src/lib/core-independent-review.spec.ts
corepack pnpm nx test kernel --skip-nx-cache -- --testFile=src/lib/collection-contributor-core.spec.ts
```

Recorded outcomes: independent2fail; core9pass/2fail. The commands intentionally reproduce a rejected candidate. Do not weaken assertions. Intermediate vectors and their original source/log identities are in evidence/CORE-HANDOFF.md. The early9pass/31pass are not claims that the final candidate passed those exact vectors again.

## Terminal helper scope

```sh
corepack pnpm nx test kernel --skip-nx-cache -- src/lib/publication-terminal-consumer-independent.spec.ts src/lib/publication-proof-retirement.spec.ts src/lib/publication-uncertainty-provenance.spec.ts src/lib/publication-terminal-obligation.spec.ts src/lib/publication-terminal-horizon-independent.spec.ts
```

Recorded27/27 at evidence/terminal-independent/BEFORE.json and AFTER.json. All helper/consumer hashes match the committed versions; entity-signal and core-test changed later. Replaying this on the final SHA would be a new run, not retroactive qualification.

## Public framework failures

Test bytes are evidence/selection-capability/ANGULAR-PUBLIC-EXECUTED.spec.ts and VUE-PUBLIC-EXECUTED.spec.ts. They remain copied as packages/<framework>/src/lib/selected-active-id-preparation.spec.ts in both control worktrees. In each checkout, with the same environment:

```sh
# /private/tmp/link-authored-removal-successor at75416029
# /private/tmp/slice5-production-control at87f6831f
corepack pnpm nx test angular --skip-nx-cache -- src/lib/selected-active-id-preparation.spec.ts -t 'public callback discriminator'
corepack pnpm nx test vue --skip-nx-cache -- src/lib/selected-active-id-preparation.spec.ts -t 'public callback discriminator'
```

Each recorded one public failure and skipped its separate private capability case. See PUBLIC-RESULT.md for the different causal verdicts. No production runtime edit is part of replay.

## HTTP-only fixture

```sh
cd /private/tmp/v16-company-workflow-preparation
/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node --test endpoint.test.mjs
```

Recorded2/2 with loopback permitted. This does not run SignalTree's installed consumer. Original scratch files remain; archived copies and SHA256 manifest permit independent byte verification.
