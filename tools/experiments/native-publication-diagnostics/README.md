# Native publication paired-recording archive

These two diagnostic harnesses were moved from kernel ordinary discovery after
C11 replay produced 28 unique observations with an explicit ST_OBSERVATIONS sink.
They assert initial conditions and record later values, proofs, packets and
caught errors. A successful replay is not a verdict on those later outcomes.
Both observe=false and observe=true arms remain executable; no assertion changed.

Run with the repository's pinned Node and pnpm:

```sh
pnpm nx run kernel:diagnostic-replay --skip-nx-cache
```

The uncached runner prints a fresh directory under
`artifacts/native-publication-diagnostics/`, supplies the required JSONL sink,
and records commands, source hashes, raw output and completeness status.
It requires exactly seven modes × two routes × two observation settings.
The explicit config selects only the two `.replay.ts` files; both remain in
`tsconfig.typecheck-specs.json`. No ordinary regression assertion is skipped.

Provenance: frozen C11 manifest SHA-256
`dc21671bf92e2a74bd5798bfccfbc0b02d13e58dff4fe328758fd604d9f70148`.
Original paths were `packages/kernel/src/lib/native-netzero-diagnostic.spec.ts`
and `packages/kernel/src/lib/native-equal-inverse-diagnostic.spec.ts`.
The interrupted C10 full-run inventory reported 12 and 16 failures respectively
without the required recording sink. Those first files/logs are preserved in
`/private/tmp/st-test-routing-successor/preserved/`; the original inventory is
`/private/tmp/st-native-combined-c10-promoted/runs/kernel-full/REPORTED-FAILURE-GROUPS.json`.
C11 recording evidence is in
`/private/tmp/st-native-combined-c11/runs/native-diagnostic-harness/` (including
EXTRA-ENV.json; COMMAND.json alone omits the external sink setting).
These references identify this migration's evidence, not portable replay inputs.

Original source hashes:

- `native-equal-inverse-diagnostic.spec.ts`: `3774b2e3bcb983b3b7f85d8280c3907b8fbeb732b8aab9a8cec7b1ec1b157ae9`
- `native-netzero-diagnostic.spec.ts`: `243e224b7fbf95deaeaf9d42c721c78f0d94449da1ef3c877c7ef2a370138c63`

The forwarding GC probe remains an unchanged asserting spec, routed separately:
`node tools/verify-gates.mjs --only=forwarding-retention-gc` runs all nine original
modes; `retention-gc` retains its original three files. Neither route changes GC
sampling or performance budgets. The remaining interrupted-run failure groups
are not cleared by this routing change.
