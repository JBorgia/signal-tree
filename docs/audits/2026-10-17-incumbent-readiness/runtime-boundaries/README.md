# Separate runtime blockers after typing integration

Typing-only commit `52e2b494` does not repair or qualify these runtime boundaries.
The probes used unchanged runtime from `16f85b6d2b46ac1404ef6b089a1e6a459c28cdc3`;
individual input hashes and original results are preserved in the archives.
No production runtime edits or release acceptance are recorded here.

## Link: rejected order reaches the endpoint

The [trace](LINK-TRACE.md) establishes that rollback installs `[a,b]` and refreshes
native collection projections, but publishes no reverse collection-order capture.
Link receives the rollback row notifications before sending, yet its eligible
order remains `[b,a]`. This is a missing publication fact, not merely a late flush.
The unchanged public reproduction and instrumentation are in `link-evidence.tar.xz`.
Prior independent-progress cases remain unqualified; this finding does not replace
the original ten violated / two unsupported results.

## Compound restoration: physical success does not restore history continuity

The [public regression](compound-compensation-retry-readiness.spec.ts) has one
ordinary passing control and one ordinary failure, with zero expected failures.
Two pending removals are inspectable; initial undo refuses atomically; rollback
restores both values and original held references. Repeated rollback is a no-op,
and opposite confirmation preserves its established terminal refusal. The desired
history retry then fails with ST1034 frontier mismatch. Later undo/redo assertions
remain unchanged and are not reached. Strict isolated typecheck passes.

The one-removal hook is rejected as general compensation support. Compound target
installation bypasses that hook, and mixed remove/add compensation cannot infer
complete-turn continuity from an individual operation. A future repair needs
complete compensation-unit evidence without weakening unrelated-drift guards.
No such repair is accepted here.

First fixture mistakes (inspection address, opposite terminal expectation and
TypeScript narrowing) are preserved separately from the runtime failure. They
were corrected against existing contracts; the desired retry assertion was not
weakened. The standalone failing regression is archived outside normal suite
selection so it cannot be confused with the passing typing checks.

## Replay and provenance

Use Node 24.15.0 and pnpm 10.17.0. Extract each archive in a disposable directory:
`tar -xJf link-evidence.tar.xz` or `tar -xJf restoration-evidence.tar.xz`.
The adjacent manifests hash the exact uncompressed files. Original scripts retain
the executed absolute checkout paths; relocate those explicitly when replaying
elsewhere. Run `node link-entity-baseline.mjs` for the unchanged public Link cases,
and `node link-order-trace.mjs` for instrumentation. Generated bundles are rebuilt
from source, not archived as substitutes for source identity.

For restoration, copy the archived final spec to
`packages/kernel/src/enhancers/restoration/compound-compensation-retry-readiness.spec.ts`
in a disposable checkout of the recorded source, then run:

```sh
NX_DAEMON=false pnpm nx test kernel --testFile=src/enhancers/restoration/compound-compensation-retry-readiness.spec.ts --skip-nx-cache
```

Expected recorded outcome: one ordinary pass and one ordinary failure. This is a
reproduction command, not a green qualification gate. The archive contains the
exact final logs, original failures, typed fixture and input manifest.
