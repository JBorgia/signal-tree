# Evidence seal

Baseline: `1d5f8934cb07a5a8824ab9d5ccac3ebf620038f5`.
Node: 24.15.0, executable `/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node`.
Final combined root execution: 18 tests, 13 ordinary passes, 5 ordinary failures,
zero skips. Two failures cover the same omitted-member validation defect.

Raw evidence: `/private/tmp/st-ordering-model/`.
Independent originals: `/private/tmp/st-ordering-review/` (also copied into archive).
Archive: `/private/tmp/st-ordering-model.tar.gz`.
SHA256: `a87d9b6fd0bc5cebf3dad4c38a33693a5c1793886dbf76194c262ffdb2327ee5`.

The archive includes first model/test source, first execution logs, pre-execution
expectation seal, final worker measurements, independent first/final review,
root independent replay, unchanged-admission output and preserved-falsifier seals.
The final model source equals the first executed model byte-for-byte. Expected
outcomes equal their pre-first-execution seal. Tests gained cost observations;
failing assertions were not weakened. Production packages have no diff from the
baseline. The old terminal-order test, quadratic counter and dependency audit
assertions match their recorded baseline hashes.

```json
{
  "EXPECTED.md": "7aa83bb9c45b30d7e0cf9bcc00f79162b6cc65a895a2d657c8de1f19819836a9",
  "model.mjs": "ab6bf7f6897d239ee3bfba2e5825bf42112735892819fc67c7a712f2497dc1f9",
  "model.test.mjs": "02341c7a6d1addf5169fa2e31f16623e13b9f236526576301e820d8c51df06f8",
  "review.test.mjs": "ec22e9c8c7d654dd9daf792bfffc3610ba330aabb0cae883a1b657665c379460"
}
```

Replay commands and interpretation limits are in README.md. These are local
research artifacts, not a release qualification or published archive.
