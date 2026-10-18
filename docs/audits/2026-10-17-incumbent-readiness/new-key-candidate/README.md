# Authorized new keys: rejected implementation checkpoint

Owner authorized newly supplied keys in ordinary whole-value branch writes on
October 17, 2026, including closed objects because runtime cannot distinguish
those from TypeScript Records. Internal inspection replay retains its unknown-key
policy. Never-present descendant handles remain a separate unresolved contract.
The authorization is retained; this experimental implementation is **not accepted**.
B stays closed. Stable v15 is untouched.

## Decisive ordinary-input counterexample

The unchanged permanent assertion is in
`packages/kernel/src/lib/whole-value-new-keys.spec.ts`, named
`application equality failure retains no uninstalled prepared payloads`.
A typed object has an existing opaque array and an optional Uint8Array member.
A whole write supplies an array whose element getter throws during equality,
and a new 100,000-byte payload. Five failed writes leave the visible snapshot
unchanged but increase retained scalar slots from 1 to 2, 3, 4, 5, 6.
The identical source replay against incumbent
`8d220643e0d4e34cbdbc6e55e6ef692b25d5e023` stays at 1 throughout.
This is ordinary input, not injected allocation failure or process OOM.

`prepareOrdinaryMembers` constructs canonical children before applying existing
values. `ordinaryConstructionValue` snapshots plain-object inputs but deliberately
preserves opaque array identity. Application equality can still invoke user code
and throw after canonical allocation and before membership installation. The
uninstalled payload remains retained with no recovery obligation. Moving getter
validation earlier fixed an initial preparation-getter leak, but did not resolve
this same lifetime mechanism during application. Stop here rather than add another
local guard. A future implementation needs preparation without retained canonical
allocation, or a complete disposition for every uninstalled allocation; neither
mechanism is accepted or implemented by this checkpoint.

## Evidence and interpretation

Independent reviewer `readiness_contract_review` found the preparation leak and
then the typed array-equality recurrence. The primary independently ran the final
candidate and exact-baseline replay: candidate exit 1, baseline exit 0. Raw probes,
full logs and checksums are in `evidence.tar.xz` and `evidence-manifest.json`.

First failures are preserved, including harness failures. Initial six controls
reported four failures and two passes; after harness correction the same count
remained. Expanded controls exposed nested preparation and dependent rollback
failures. Review then exposed function-metadata key discovery and reentrant
canonical-identity replacement. The identity defect was real; a newly written
expectation that an updater's inner value 9 must survive was incorrect: an exact
8d control finishes at outer value 1 while preserving identity. That assertion
correction is a test-contract mismatch, not permission to alter callback ordering.

The first full kernel run reported 5,753 ordinary passes, 12 failures, 11 expected
failures and 12 skips. Six failures were authorized old discard expectations;
six were an overbroad dependency guard. The guard was narrowed to newly created
membership, and existing restoration assertions were preserved. Old discard
assertions remain in baseline Git and first-red logs; their deliberate replacement
with positive new-key assertions follows the owner's authorization.

An intermediate candidate passed all five Nx projects:

| Project | Ordinary passes | Expected failures | Skips |
| --- | ---: | ---: | ---: |
| Kernel | 5,768 | 11 | 12 |
| Angular | 75 | 0 | 0 |
| React | 238 | 0 | 3 |
| Vue | 105 | 0 | 0 |
| Solid | 173 | 0 | 0 |

Intermediate typecheck, spec-types, five-project lint and package build completed.
The build emitted existing TS4111 diagnostics; supported spec-types retained its
existing debt ratchet. A standalone Angular tsc invocation failed on existing
configuration/diagnostics and is not a passed gate. The first Vue control had an
index-signature access diagnostic, corrected before its passing Nx replay.
These runs preceded the final preparation revision and failing regression: they
are historical candidate results, **not final-source qualification**. Intermediate
sources were dirty and were not individually frozen; logs cannot supply missing
exact source identities. The final committed checkpoint supplies that identity.

Final focused Nx result: **18 ordinary passes, 1 failure**, exit 1. The failing
assertion remains an ordinary test, not an expected failure. No final broad rerun,
demo build, packed-artifact qualification or cost campaign followed this blocker.
No ceilings changed. Existing exact-8d evidence does not transfer to this runtime.

## Replay

Use Node 24.15.0 and pinned pnpm 10.17.0. From this checkout:

```sh
export PATH=/private/tmp/st-b-qualification-20261016/bin:/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:$PATH
NX_DAEMON=false pnpm nx test kernel --testFile=src/lib/whole-value-new-keys.spec.ts --skip-nx-cache
node --import ./node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/loader.mjs docs/audits/2026-10-17-incumbent-readiness/new-key-candidate/replay.mts
node --import ./node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/loader.mjs docs/audits/2026-10-17-incumbent-readiness/new-key-candidate/replay.mts /private/tmp/st-sparse-integration-baseline-8d220643
```

The checkout used a dependency symlink to that baseline's node_modules, not a
fresh install. The two earlier bare `--import tsx` replays failed module resolution
before execution; their logs are preserved separately from runtime results.
The final `replay-*-2` records (filenames end `candidate2` / `baseline2`) are the
executed comparison. The baseline checkout's unrelated untracked specs were not
changed. The slot metric uses a private diagnostic; the triggering operation is
public and the permanent spec uses a legal explicit TypeScript shape.

## Status and cleanup limitation

The incumbent remains 8d; no repaired runtime is frozen for acceptance. K2 unseen
handles, composed restoration, Link and matrix dispositions remain open in the
parent inventory. This checkpoint preserves a rejected implementation, not a
release candidate or an architecture direction change.

Formatting introduced substantial unrelated textual churn in three runtime files.
Automatic approval review rejected reconstruction from HEAD because it might lose
candidate changes. The rejected command did not execute; the files were left
intact and no bypass was attempted. This churn is another reason this checkpoint
is evidence only, not an integration diff.
