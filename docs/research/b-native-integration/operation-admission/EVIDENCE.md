# Evidence and replay

Baseline: `624f0154ce4456e6ca768b053f0909442c68f3f1`.
Final source seals below identify the experimental candidate independent of its
later record-only commit hash. Node 24.15.0; Corepack-pinned pnpm 10.17.0.

Final root Nx run: **31 ordinary passes / 2 ordinary failures**, no skips or
expected-failure markers. Failures: unchanged unresolved payload premise and new
terminal-order defect. Original minimal replay: **4 ordinary passes**.
Five existing assertion-file SHA256 seals were verified unchanged.

Raw evidence: `/private/tmp/st-b-authorship/`.
Archive: `/private/tmp/st-b-authorship.tar.gz`.
SHA256: `d236e7682708e3fd1c43540646bc0f69408d4fb35ba9db194c514d6fa6033ced`.
Archive contains first baseline failures, first candidate sources/results,
subsequent results, reviewer results, instrumentation, proposals and final sources.
This local archive is not a published artifact.

Replay from the repository root:

```sh
export PATH=/private/tmp/st-b-qualification-20261016/bin:/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:$PATH
bash docs/research/b-native-integration/operation-admission/replay.sh
```

The temporary first PATH entry supplies the pinned pnpm shim; on another machine
use the manifest-pinned pnpm through Corepack and Node from `.nvmrc`.
The replay script records each exit status and intentionally returns the focused
failure. It does not suppress failing assertions.

```json
{
  "packages/kernel/src/lib/internals/native-entity-ownership-experiment.ts": "d53ebb9ee386578b12f4bc8526bec4818fac649952a0fd89ee5f3adfcf58f858",
  "packages/kernel/src/lib/internals/native-order-admission-experiment.ts": "a93f5a1744408b4972ae9b308cf290529e5ae8cfba02de1eab5249dfd779e6bd",
  "packages/kernel/src/lib/b-operation-admission.spec.ts": "1158a9c3d82b19b5b682ac1559a0924d58fb75a75032aae74b382b1490cb3145",
  "packages/kernel/src/lib/b-operation-admission-review.spec.ts": "00da3542729f3af1c573354fece46fee8c16f937422fefbef5afbc8690a7fffa",
  "packages/kernel/src/lib/b-operation-admission-terminal.spec.ts": "48acd64cb9dcd283b8828e98e13d8d0f42404d3430069a99311abbfb70b7e43c"
}
```
