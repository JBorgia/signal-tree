# Native publication error recovery — bounded v16 repair

Base: `458137a1a2bcf941735f1a5373219bf16019bea3`.
Branch: `codex/v16-runtime-recovery`. This is an isolated implementation port,
not release qualification or integration of the ownership research model.

## Contract and cause

A saved authored-body or publisher exception must be reported after the
observation wrapper has completed its bookkeeping. Keep the wrapper: it is
required for native batching. Preserve the original thrown value, including
`undefined`, and do not turn an adapter-flush exception into success.

Commit `639006342` put the saved-error throw inside the observation callback.
Controlled failures after actual Solid invalidation demonstrated interrupted
native delivery. The repair moves failure storage outside that callback and
reports after the wrapper returns; an existing body failure remains primary
if the adapter also fails while finishing the group.

The shared epoch publisher introduced by `be03665d` has a separate failure
boundary: it clears a set of queued handles, then stops on the first exception.
A later handle is consequently never attempted. Per-handle catching restores
the same attempt-all behavior as the surrounding publisher drain. It reports
the first failure after attempting the captured set. No failed handle is
silently replayed, and no semantic settlement is reversed by this repair.
Explicit reentrant requests remain new requests, not a global exactly-once
promise.

## Evidence

Tests were added before runtime changes. The original focused kernel run had
6 failures and 6 passes. The original full Solid run had 3 failures and 80
passes. The phase-only repair left exactly the epoch-drain failure in each:
kernel 11 passes/1 failure, Solid 82 passes/1 failure.

The tests keep thrown-value identity, actual fault hits, unchanged public
EntityMap lifetimes, observer snapshots taken before reads can refresh caches,
subsequent writes, batching, ordering and no-replay assertions. Solid runs
through its browser/development test conditions, with a live-observer control.
The adapter injections are robustness tests; they do not claim a naturally
occurring nonthrowing publisher fault.

Generating commands (Node24.15.0, pinned pnpm10.17.0):

```sh
pnpm nx test kernel --testFile=native-
pnpm nx test solid
pnpm nx run-many -t test -p react vue angular
pnpm run typecheck
```

The first attempted comma-separated kernel filter selected no files; the
corrected run above supplies the semantic baseline. A later run-many passed
the kernel-specific `--testFile` option to Solid, which rejected that option;
the supported full Solid target was then run. Neither invocation error counts
as a semantic result.

Final combined-runtime verification:

- Full kernel: 4,929 passed, 53 expected failures, 13 skipped; Nx exit 0.
  Existing expected failures are not proofs of systemic completion.
- Expanded native regression subset after adding edge/flush tests: 48/48,
  Nx exit 0. These additional tests did not change runtime source.
- Solid: 83/83; Angular: 218 passed and 3 skipped; React: 55/55;
  Vue: 113/113. All actual Nx targets exit 0 on the combined repair.
- Source typecheck and ordinary spec-types gate pass. A first lint run found
  nine errors in new fixtures; explicit no-op rationale and const bindings
  corrected them. Checked capabilities replaced Solid non-null assertions.
  Final affected-package lint passes without suppressions or budget changes.
- All five packages build. Fresh artifacts were rebuilt after the paired
  baseline comparison restored the exact candidate source.
- Seven copied-source mutants are killed by the phase/flush tests. Four
  (swallowed flush, overwritten body failure, truthy body precedence, lost
  undefined flush) passed the initial five tests and fail the added twelve.
  Epoch continuation additionally rejects a truthy-error sentinel mutant.

Size verification remains **red**, including on unchanged HEAD:

| Check                                    | Unchanged base | Combined repair | Existing ceiling |
| ---------------------------------------- | -------------: | --------------: | ---------------: |
| Demo initial, reported kB                |         554.70 |          554.79 |              550 |
| Bare consumer production, reported KB    |          11.21 |           11.21 |            10.25 |
| Bare consumer development, reported KB   |          13.54 |           13.54 |            12.45 |
| Entity consumer production, reported KB  |          25.29 |           25.29 |            22.60 |
| Entity consumer development, reported KB |          28.07 |           28.07 |            25.25 |

Package figures match only at the checker's displayed precision, not a claim
of byte identity. The comparison temporarily restored the original runtime,
built packages and demo, then restored candidate source in `finally` and
rebuilt packages. Both budget commands exit 1; no threshold changed. The
production demo compiles but fails its size gate. This bounds the new delta;
it does not waive the pre-existing excess or qualify a release.

Raw commands/exits and first failures are preserved under
`/private/tmp/st-runtime-port-*`, and in the parent research evidence archive.
Candidate runtime SHA-256:
`7a148240fe9a0f307c4a2a61d1a5839ec3fed66fdd27d4a14ff12c0c05d65a7c`.

## Limits and requirements validity

This repair does not guarantee that arbitrary unhandled application errors
leave a framework graph recoverable in place. Controlled Solid unowned-error
research cases still leave subscriptions stale. ErrorBoundary disposal and
remount are different from recovery of a live subscription. A clean retry
return alone must not be treated as proof that every interrupted native
subscription recovered.

Coherent publication, native recovery and remote delivery are separate
obligations. An envelope-only endpoint can apply committed facts without
reading native caches; a native-reading endpoint can have an additional
readiness dependency. The research comparison does not choose a new public
ordering contract or per-recipient API. Existing native-gated attachments
still owe their promised ordering. No L1–L18 law is weakened by this repair.

No new public export, error aggregation API, framework timing policy,
publication authorization or v15 compatibility change is introduced.
