# Public sibling pair on frozen R2

**First Nx run: 1 pass / 1 fail. Unchanged spec-types gate: pass.** No fixture corrections, runtime changes, observation seam, or retries. Both runs completed without timeout. All3093 frozen manifest files and the new fixture hash remained unchanged before/after both commands.

## Exact cases and evidence

Both use only public kernel operations: transaction p owns pair.x7; historical root updater under dependent[p,a] consumes q1; a confirms. Two fresh q handles author q2/q3 and confirm before two fresh whole/root updater admissions under dependent[p,q]. Each callback runs once. Both preserve a saved pair7 snapshot and the frozen earlier receipt read value. No private proof, comparator, framecommit or inspection ingress.

Collapse case keeps both pair fields equal at n1/n2. Per approved semantics both fresh receipts must be no-write and historical receipt must remain the eventual sender. Observed n1 no-write; n2 conservative/unknown, historical receipt superseded. After p confirmation n2 started/surviving and delivered exactly `{x:7,y:0}` once. First failure at `public-sibling-current-obligation.spec.ts:73`: second receipt expected no-write, got conservative/unknown. The exact final useful payload, no premature sends, callback counts, unchanged p inspection, snapshot/old read-value stability, settled and disposal cutoff assertions ran and passed before that failure. Later receipt assertions are blocked; their observed values are preserved in JSONL, not claimed executed. This reproduces the approved no-write attribution failure without the original private graph probes.

Meaningful case shares n1, then public whole update at n2 writes changed x9 and equal y0. It holds until p confirms because the new admission explicitly depends on p; it does not assume old location ownership of7 must hold an independently replaced9. It then sends exactly `{x:9,y:0}` once, settles, and no post-disposal send occurs. All assertions pass. p inspection differs after meaningful replacement, as permitted; the fixture does not impose unchanged ownership there. Callback counts are one each; x notices equal one meaningful change plus one post-disposal local99, versus only local99 in collapse.

No exact private preparation/traversal order was instrumented or asserted. Source layout and public result write x before equal y, but this qualification claims whole-updater meaningful-versus-collapse behavior, not independently proven internal record ordering. No opposite-order arm. Saved object value and historical frozen receipt-read object are checked, not internal certificate identity or all-root retention.

## Reproduction and preservation

Base `/private/tmp/st-c28-r2-cutoff/candidate`, manifest SHA256 `597eaf690450a74cc128b8e90b7032aa7d5ef842deae48a4358ade9ed4b9952c`. Isolated `r2-copy`, root dependency symlink, Node24.15.0/pnpm10.17.0, separate per-run Nx cache/workspace/temp and JSONL sink.

```sh
corepack pnpm nx test kernel public-sibling-current-obligation --skip-nx-cache --maxWorkers=1
node tools/check-spec-types.mjs
```

`runs/probes-first/{COMMAND.json,PROCESS.json,RESULT.json,first.log,observations.jsonl}` preserves first test invocation/failure and all outcome rows. `runs/spec-types-first` preserves exact unchanged gate exit0. Gate lists three inherited baseline improvements; no --update or allowlist change. Archived tsconfig-resolution diagnostic noise was retained, not suppressed. No separate source-type or broad suite run.

Original repeated fixture preserved byte-for-byte at `originals/repeated-no-write-roots.spec.ts` from the n2 trace's unchanged original; original source hash rechecked after work. It was not rewritten or inserted into the executable copy because it requires separate private diagnostic exports. Original four-iteration/root-accounting qualification remains separate; this smaller two-iteration public counterexample does not replace it or claim it passes.

`IDENTITY.json` records original and overlay hashes. `TESTS.patch` adds only the two-test public fixture. No observation/runtime/config patch. `SNAPSHOT.json` hashes reports, fixture, commands/results/logs, patch and preserved original. No edits to author/root/frozen candidates. This packet can distinguish the failing no-write arm from the already-useful meaningful arm on a future successor without changing either oracle.
