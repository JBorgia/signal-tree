# Independent commands

Node24.15.0 on PATH; pinned pnpm10.17.0; NX_DAEMON=false NX_ISOLATE_PLUGINS=false; Vitest4.1.9. Cwd recipient unless noted. Logs contain startup tsconfig warnings but selected suites executed.

```sh
corepack pnpm nx test kernel --skip-nx-cache recipient-window-independent.spec.ts publication-enrollment-invariance.spec.ts aggregate-independent-input.spec.ts aggregate-installed-publication.spec.ts a1-installed-publication.spec.ts publication-validation-window-audit.spec.ts publication-terminal-horizon-independent.spec.ts publication-terminal-consumer-independent.spec.ts publication-terminal-obligation.spec.ts declaration-extensibility-e5-fork.spec.ts a1-independent-review.spec.ts intrinsic-mutation-pay-for-use.spec.ts a1-publication-installation.spec.ts publication-membership-provenance.spec.ts publication-native-provenance.spec.ts publication-evidence-scope-controls.spec.ts publication-proof-retirement.spec.ts collection-contributor-core.spec.ts aggregate-native-input-independent.spec.ts --maxWorkers=1
corepack pnpm nx test kernel --skip-nx-cache recipient-window-review.spec.ts --maxWorkers=1
corepack pnpm nx test kernel --skip-nx-cache recipient-window-review.spec.ts --testNamePattern='membership omission' --maxWorkers=1
node tools/check-spec-types.mjs
```

Cwd known-input:

```sh
corepack pnpm nx test kernel --skip-nx-cache known-input-contract-review.spec.ts aggregate-native-input-independent.spec.ts --maxWorkers=1
```

Authority retrieved read-only with git show from root at commits247cfec70c87c591e69e87dc3ee514840dad3f61 and75c645eb71e4a03e5c84491ce8078debfe797e19. Extracted source text lives under authority/. Main retains central document ownership.
