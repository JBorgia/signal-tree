# Corrected parent-freshness counterpart oracle

Disposition: no runtime correction is required for normal-return nested b omission. The previous preservation expectation was too strong. This report supersedes that recommendation in ../REVIEW.md; it does not overwrite any original fixture, first failure, source identity or log.

The exact candidate kernel README:268 documents that an enclosing whole value applies omissions after its writes. A callback's ordinary nested write may therefore be omitted when the enclosing value resumes. Direct writes through retained dormant locations have a specific reactivation exception. Existing absent-collection.spec.ts controls distinguish the cases; three unchanged controls pass on both exact C10 INITIAL and C8 (six selected passes). The creation/updater control at whole-value-new-keys.spec.ts:198 also explicitly distinguishes nested updater execution from settlement delivery. See ../public-adjudication/ADJUDICATION.md for source references, exact manifests, public reachability and limits.

Public tap onAdd and supported tooling membership-reader callbacks reproduce the outer omission on C10. Thus reachability is established; it does not establish a contract violation. Exact C8 has the same final omission plus independently stale completion/tap snapshots. A narrow ordinary Link control preserves a+b; no universal negative claim. No custom private marker or uncalled onChange emitter was used to manufacture a public route.

## Separate corrected fixtures

Only these expectations/actions differ from the original three counterpart specs:

- Immediate completion snapshot remains old+a; immediate nested snapshot remains old+a+b when reentry occurs.
- Final normal-return snapshot is old+a because the outer whole value resumes its omission pass.
- Final throwing-completion snapshot remains old+a+b, with exact original sentinel identity, because the throw bypasses the remaining outer omission.
- Later b update is executed only when b survives the throwing path. Every scenario still independently writes existing old and newly installed a and requires native observer activity; same-value a writes still preserve root/branch/native identity and observer count.

No freshness, callback-count, retained-a identity, sibling identity, cached native timing or delivery checks were removed. Vue computed/watchEffect, Solid memo/computed and actual mounted React useSignalTree rendering remain real native consumers. React checks the final DOM. Each fixture retains three bounded scenarios, not a callback matrix. The explicit internal completion observer remains clearly identified as private instrumentation.

`ORACLE-CORRECTION.patch` shows the exact delta from preserved original fixtures. `TESTS.patch` is the complete three-file addition against unchanged SNAPSHOT-PROOF. `SNAPSHOT-CORRECTED.json` seals all baseline files plus corrected specs. `IDENTITY.json` verifies unchanged proof runtime/baseline, exact C8 comparison runtime, original private fixture hashes, byte-identical corrected specs in both copies, and patch/manifest hashes.

Base proof manifest SHA256: 5cb0b3d5616b3f9d002625270ee4b6793f8ba0388f5d6327ba52fa213d789b7b.
C8 comparison manifest SHA256: 3ad1adb2de2936e52baf2ca06d630babc858d4186c2c4fed48818639056b388a.

## Executed result

| Runtime | Vue | Solid | React |
| --- | --- | --- | --- |
| Exact unchanged proof | 3 pass | 3 pass | 3 pass |
| Exact C8, identical corrected specs | 3 fail | 3 fail | 3 fail |

Proof: 9/9 pass. C8: 9/9 fail beginning at stale immediate completion snapshots, so the corrected oracle retains a decisive negative control. Source types and spec-type ratchet pass; framework spec compilation passes, including React TSX. No runtime correction required for the adjudicated omission.

## Commands and evidence

All run from these separate owned copies under Node24.15.0 / corepack pnpm10.17.0, with NX_DAEMON=false, NX_ISOLATE_PLUGINS=false, NX_NO_CLOUD=true, CI=true. Reused working dependency copy via node_modules symlink is recorded in the preceding review; no frozen/shared source directory was edited.

```
corepack pnpm nx test vue --skip-nx-cache parent-freshness-counterparts --maxWorkers=1
corepack pnpm nx test solid --skip-nx-cache parent-freshness-counterparts --maxWorkers=1
corepack pnpm nx test react --skip-nx-cache parent-freshness-counterparts --maxWorkers=1
corepack pnpm run typecheck:source
corepack pnpm exec node tools/check-spec-types.mjs
```

Each framework Nx target first typechecks its full spec project, including React TSX. Raw commands, environment, logs and exit codes are adjacent `*-command.json`, `*.log`, `*-exit.json`. Inherited archived tsconfig missing-path and npm config warnings remain preserved. No baseline ratchet updates. Final measured result table is in RESULTS.json.

Not run: broad suites, builds, performance/budgets, release gates, marker callback matrix, or corrected counterparts on C10. The counterparts run against exact unchanged parent-freshness proof and exact C8 as requested; public adjudication/unchanged contract controls separately run on C10 and C8.
