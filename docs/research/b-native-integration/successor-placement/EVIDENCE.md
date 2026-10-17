# Evidence seal

Baseline: `cfe5884d7e82dd8b95c0d32f460b244144595610`.
Node 24.15.0; Corepack-pinned pnpm 10.17.0. Actual invocation PATH:

```sh
export PATH=/private/tmp/st-b-qualification-20261016/bin:/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:$PATH
```

Local evidence: `/private/tmp/st-successor-placement/`.
Archive: `/private/tmp/st-successor-placement.tar.gz`.
Archive SHA256: `d257c6e970136a196329eb82f425e46ecef79a8d8dbd057e89efd99ffbeabdd2`.

First source and first.log preserve 18 passes/2 failures. focused.log preserves
52 passes/2 failures in the final three-file run. spec-types.log preserves the
unchanged-ratchet pass and existing diagnostic qualifications. No expected-failure
markers or skips. SPEC.md still matches its pre-first-execution seal.

Runtime and prior tests/research have no tracked changes from baseline. This
checkpoint adds only the new test and successor-placement record. No production
artifacts were generated. Replay commands are in RESULTS.md.

```json
{
  "docs/research/b-native-integration/successor-placement/SPEC.md": "3431ca317fe85fffa001eb5add91e67438e2faff7f0ca40e6a64c7ad8f518b18",
  "packages/kernel/src/lib/successor-placement-policy.spec.ts": "99e784202a2c1f011f0037b1e53df7d8168a44bf3e9ad250e8b0af7facab615f"
}
```
