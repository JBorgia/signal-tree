# Independent lifecycle/projection review

Reviewed the frozen private integration, not production acceptance. I authored the separate entity-adoption experiment, not these lifecycle/projection modules. No implementation files changed in this review.

## Identities

- private.ts: `6a70903f6694ab08298c1325a283d6297ed71b9c7f3fabd033812fad5e8488cc`
- lifecycle.ts: `bc2db1207a2110694770d8669a4a30dccd1c2ce645f527a1afaa49b577e34840`
- projection.ts: `719e40672cde3d674bd45a3fcc5b07d52ce08687ed7622e6d45ceabc4b482442`
- loader.mjs: `bab2b27547ed1e13586ec6e7407d774be49db45d6a6bfadb41b12d24a0d40ad0`

All are in `/private/tmp/link-repair-lifecycle`; hashes independently verified.

## Result

No additional concrete blocker found in this bounded lifecycle review. This does not qualify the complete candidate: the independently reproduced entity setAll adoption chronology failure remains blocking, and broader entity payload retention is not established by scalar collection controls.

The implementation makes terminal receipt transitions monotonic (`state`, lifecycle.ts:55); `started` removes the pending operation while preserving the detached readable receipt. Thus started means I/O began, not successful delivery. Disposal clears unstarted connection operations and projection bindings; it does not rewrite a started receipt. Authentic transaction handles resolve through a weak identity map to immutable-identity owner cells, whose terminal outcomes cannot revert. Source teardown does not manufacture confirmation for unresolved foreign obligations. Enclosing validation remains attached through a horizon after inner callbacks return; closure compacts proof only when every relevant enclosing scope has completed.

Projection bookkeeping consumes the native projected payload instead of adopting arbitrary notifier payloads. Field source matching includes subject identity and field identity; scalar declaration support does not imply aggregate declaration support. The stored latest/completed payload is released when its binding is disposed. These are source findings, not universal retention proof.

## Independent execution

Node `/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node` executed each saved frozen bundle once using `--input-type=module`, importing `run()` and writing its JSON result. GC additionally used `--expose-gc`.

Raw evidence in `/private/tmp/link-lifecycle-review-probes/`:

- `unit-replay.json`: six checks pass: started monotonicity, enclosing failure conservative result, exact primary thrown identity, one secondary report, retained authentic terminal owner identity, and cleanup.
- `native-replay.json`: queued disposal suppresses delivery; in-flight disposal releases settled waiter and preserves started receipt; foreign confirmation releases payload7. Do not count the old fourth retention assertion as evidence: its records/completed field test was vacuous against renamed diagnostics.
- `retention-replay.json`: corrected eight-cycle native cross-tree dependent declaration/confirmation/drain/disposal experiment passes. Every recorded store counter returns to zero; final comparison uses actual diagnostic keys. This is bookkeeping evidence, not a heap proof.
- `gc-replay.json`: one scalar native probe collects tree, connection and transaction handle while a detached started receipt remains held. A live tree remains reachable and has live registration counts. Post-drain counters all zero. This establishes only this sampled scalar lifecycle; parent-reported entity payload noncollection must remain separate and unresolved.

Replay command pattern:

```sh
/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node --input-type=module -e 'const {run}=await import("/private/tmp/link-repair-lifecycle/retention-counts-bundle.mjs");console.log(JSON.stringify(await run(),null,2))'
/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node --expose-gc --input-type=module -e 'const {run}=await import("/private/tmp/link-repair-lifecycle/native-gc-bundle.mjs");console.log(JSON.stringify(await run(),null,2))'
```

## Error/retry limits

Source review confirms the native endpoint invocation still reports rejected/throwing sends through `link:set`, does not set knownY until success, and keeps its serialized queue usable after failure (saved link.ts.original:743–756,823–850). The experiment marks the declaration started immediately before invoking the endpoint; this remains truthful if the endpoint throws. The native delivery error engine is retained rather than replaced by receipt cleanup. I did not execute a new end-to-end failed-send/subsequent-write control in this review; that claim requires existing frozen delivery evidence or a focused replay before acceptance. No automatic retry policy is inferred.

No Nx, installed-artifact, full framework, benchmark or release qualification was run by this review. Source-loader and module probes are bounded evidence only.
