# Adjudication evidence

Baseline: `9f4135fa72d0dbf4849511c6da0ec79456e3f615`.
Runtime: Node 24.15.0; Corepack-pinned pnpm 10.17.0 via:

```sh
export PATH=/private/tmp/st-b-qualification-20261016/bin:/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:$PATH
```

Raw evidence: `/private/tmp/st-ordering-adjudication/`.
Archive: `/private/tmp/st-ordering-adjudication.tar.gz`.
SHA256: `db60dd05debebe10d7bf4df4ff5c0ef89584044e0ebc3717acf277655d6942ca`.

`public.log` is the initial diagnostic run whose console output was suppressed.
`public-json.log` is the rerun with explicit JSON sinks; each reports two setup
checks passing. `public-incumbent.json` and `public-B.json` contain observed
outcomes, not expected-result assertions. Neither first rollback refused.
`model-trace.json` contains the unchanged model's scratch replay, pending/state
snapshots, ordinary churn reachability and existing cleanup diagnostic.

No new conformance result is claimed from diagnostic pass counts. No broad suites
or old model suite reruns. `bash -n` validates the saved replay script syntax.
Source checks confirm packages, old model/expectations and previous admission
research unchanged from the baseline. The temporary Nx fixture is absent.

Unchanged source SHA256:

```json
{
  "docs/research/b-native-integration/ordering-model/EXPECTED.md": "7aa83bb9c45b30d7e0cf9bcc00f79162b6cc65a895a2d657c8de1f19819836a9",
  "docs/research/b-native-integration/ordering-model/model.mjs": "ab6bf7f6897d239ee3bfba2e5825bf42112735892819fc67c7a712f2497dc1f9",
  "docs/research/b-native-integration/ordering-model/model.test.mjs": "02341c7a6d1addf5169fa2e31f16623e13b9f236526576301e820d8c51df06f8",
  "packages/kernel/src/lib/b-operation-admission-terminal.spec.ts": "48acd64cb9dcd283b8828e98e13d8d0f42404d3430069a99311abbfb70b7e43c",
  "docs/research/b-native-integration/operation-admission/count-admission.mjs": "98d9d4eed87336fb7ea7f4121322c537b20513ba688e256beeb1d82b33e0b6dd"
}
```

The archive is local evidence, not a published artifact. The diagnostic scripts
and substantive conclusions are preserved alongside this file in Git.
