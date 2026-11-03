# Independent C13 retention composition qualification

Bounded PASS for the requested two retention gates and their actual mutations on exact C13. Readiness fixture source review: bounded ACCEPT. No runtime or frozen-input changes. This is composition qualification, not a C11 rerun, ordinary-suite clearance or release acceptance.

## Identity and archived reviews

Input `/private/tmp/st-native-combined-c13/SNAPSHOT-C13.json`: SHA256 `0efc2a195ab9cc2a49ba72da60c9c3b95b67f181861fb0b059f54340f66e3fcb`,3057 files. Every source file was verified against that manifest before copying into this own scratch checkout. `BASE-SNAPSHOT.json` is the exact input manifest, `IDENTITY.json` records tool/dependency identity, and `FINAL-SOURCE-VERIFICATION.json` verifies both own source and frozen C13 after execution. C12→C13 manifest comparison (`C12-C13-DELTA.json`) shows no package runtime changes.

- `ROUTING-INDEPENDENT-REVIEW.md` archives the previously delivered independent routing verdict, evidence inspected and explicit run/not-run limits. It is not a claim that C11 was replayed again.
- `READINESS-INDEPENDENT-REVIEW.md` reviews the two-hunk readiness fixture patch against earlier private activation findings and actual scalar/entity/membership completion paths. The two activation calls complete the same missing lifecycle; the added not-ready assertion preserves the open declaration horizon. Positive composite invalidation and released-listener cancellation assertions remain. No readiness test rerun is claimed.

## Requested sequential execution

All four commands ran in this packet's `candidate/`, sequentially via `qualify.py` and `gate.py`. Each run retains COMMAND.json, first.log, RESULT.json and full SOURCE-BEFORE.json plus verified SOURCE-AFTER.json. All four source-after checks report3057 unchanged manifest files.

Pinned executable: `/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node`. Manifest pins pnpm10.17.0; lock hash `5e1ccb86b533ff4241d8a6ae5ac32ee9a56c6e10a416a8d1be3322d0ba531239`. Installed dependency tree is the prior isolated own copy, not root node_modules. No packages fetched.

```text
node tools/verify-gates.mjs --only=forwarding-retention-gc
node tools/verify-gates.mjs --only=retention-gc
node tools/verify-gates.mjs --self-test --only=forwarding-retention-gc
node tools/verify-gates.mjs --self-test --only=retention-gc
```

| Run | Actual child result | Registry result |
| --- | --- | --- |
| forwarding-retention | All9 original modes pass, each in a fresh process | exit0 |
| existing-retention | All10 tests in the original3 files pass | exit0 |
| forwarding-mutant | All9 modes fail the unchanged `tree: expected true to be false` assertion | mutated gate exit1; self-test exit0 |
| existing-mutant | `disposed: payload is collectible` fails with retained Date; other9 tests pass | mutated gate exit1; self-test exit0 |

Forwarding mode matrix is hold-proceed/drop-proceed/hold-value × success/skip/caught. Every child reports Node v24.15.0 and retains its12 held/12 released sampling rows. No filters, partial matrix, skips, timeout increases or changed assertions. The retained-tree mutant is a real holder edge, not an unconditional failure. The existing mutant removes actual connection disposal. `MUTATION-RESTORATION.json` records both exact restored target hashes against C13. `FORWARDING-RAW-VERIFICATION.json` additionally checks mutant SOURCE.json against the reconstructed registered mutation and unchanged runtime hashes.

The existing retention gate's npx request is resolved by the evidence-only `bin/npx` shim to installed Vitest and pinned Node. Requested/resolved commands and complete child output are retained as runs/existing-{retention,mutant}/child.COMMAND.json and child.log. The shim is outside candidate and does not modify tests or gate source. Both original and mutant use the same resolver.

## Raw artifacts

- Good forwarding matrix: `candidate/artifacts/forwarding-retention/run-TCrY5I/`.
- Mutated forwarding matrix: `candidate/artifacts/forwarding-retention/run-M9BnZU/`.
- Existing retention good/mutant raw child output: `runs/existing-retention/child.log`, `runs/existing-mutant/child.log`.
- Registry summaries and exact top-level commands: `runs/*/first.log`, `runs/*/COMMAND.json`.
- All generated forwarding command/source/sample/log/result files: `ARTIFACT-INDEX.json`.
- Archived exact readiness/runtime/gate sources supporting this review: `reviewed-source/`.

All first outputs preserved; only the intentional mutants failed, at their intended properties. Final own and frozen source hashes match C13. No permanent runtime/test edit was made; registered mutations occurred only in the isolated own copy and restored exact bytes. No broad suite, source/spec-type rerun, readiness runtime replay, cost/retention-generalization or publicsurface approval follows. These results qualify only the requested C13 composition gates.
