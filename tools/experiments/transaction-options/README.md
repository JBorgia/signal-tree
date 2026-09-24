# Executable transaction architecture comparison

Read [RESULTS.md](RESULTS.md) for executed outcomes, candidate tradeoffs and the
remaining failures. Preserved evidence is indexed in `evidence/manifest.json`.

Research only; not shipped, not a release gate, not a replacement for the frozen
SEMANTICS-2 suite. Source baseline: `7ade0e3e`.

The experiment separates shared live speculation from isolated draft review.
Recorded assignment operations do not claim to capture arbitrary callback reads,
async context, native reactivity, business dependencies or side effects.

Tests were written before candidate implementations. `PROTOCOL.md` records the
comparison semantics. `runner-selftest.mjs` proves assertion failure, constructor
failure, cleanup failure and unsupported capability cannot silently pass.

Run from repository root:

```sh
node tools/experiments/transaction-options/runner-selftest.mjs
node tools/experiments/transaction-options/runner.mjs tools/experiments/transaction-options/current.mjs --out=/tmp/current-options.json
```

Runner exit 0 requires no assertion failures, execution errors or unsupported
cases among selected profile cases. Expected red baselines still exit nonzero;
the report must preserve them rather than treating evidence collection as a pass.
Profile mismatches are shown separately and never counted as passed.

`mutations.mjs` contains deliberate semantic boundary faults. Mutation kills prove
assertion sensitivity, NOT that equivalent mutations in production subsystems are
detected. In particular a mutated `stats()` count is instrumentation sensitivity,
not a measured heap leak. Full production mutation proofs remain required before
selection or release. Candidate adapters must not synthesize missing behavior.

Model composition tests emulate eligible publication, deferral and undo. They
cannot substitute for actual SignalTree `link`, coalescing, restoration, EntityMap
and four-framework integration. Those are separately reported capabilities.

No existing laws, predictions, production files, package exports or release
configuration are modified by this experiment.
