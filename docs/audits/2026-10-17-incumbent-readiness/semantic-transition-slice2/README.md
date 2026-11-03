# Slice2 rejected: ordinary destination responsibility omitted

The combined structural candidate is rejected. Runtime work stopped at the plan's repeated-information-loss boundary; no local rekey guard or later slice was attempted. Production stays87f6831fa60cafe87508f0ace84b7638698ca3b0. Slice1 checkpoint91058393308faadbd8f5cdd2e0a3271c4e56ee22 remains preserved and closed within its existing-lifetime scope. Starting prerequisite record80e6095ec3b2b2706bc5d837b9c1226efaa76982 remains unchanged.

## Decisive counterexample

1. Ordinary collection contains A7 and B8; hold both entity references.
2. Inspection removes A from physical display, without changing ordinary truth.
3. A transaction rekeys B into physically vacant A.
4. Transaction inspection succeeds; rollback reports success.
5. Actual IDs are only B; old A remains absent. Required ordinary topology within the authored key footprint includes old A and old B.

The error is not storage-key/payload-ID mismatch. It is missing prior ordinary occupancy/lifetime. Independent review reproduced it; root ran the same frozen executable and added an asserting Nx regression, which fails unchanged on `ids=[b]` versus `[a,b]`. Ordinary membership operations and transaction settlement are used; inspection is established with the existing internal `withWriteContext({participation:'inspection'})` harness, as repository inspection tests do. This is not fault injection or malformed effect data, but no browser/devtools end-to-end reproduction is claimed.

The implementation explicitly migrated transfer-key in `prepareOrdinaryTopology`, but destination displacement lookup is performed only for add/ordinary-absent adoption. Rekey records its source movement without admitting removal of displaced ordinary A. Inversion therefore knows only to move B back. The complete-target guard cannot reconstruct an ordinary fact that admission omitted. Independent interpretation review confirms that W5 explicit key occupancy and the owner-approved ordinary-topology rule determine the expected result; no new payload or nested-parent decision is needed.

This is a gap in an already implemented structural writer and the proposed shared admission mechanism, not a failure in untouched later restoration work. The plan expressly stops a supposedly shared correction that repeats missing facts in another mapped writer. Do not patch it by retroactively discovering old A during compensation or adding caller-specific rekey cleanup.

## What was implemented and retained

- Sparse native ordinary presence/key/lifetime divergence and vacancy indexing.
- Paired preparation of physical instructions and ordered ordinary changes.
- Plural ordinary evidence and explicit empty ordinary evidence through the existing notification protocol, consistently selected by transaction/restoration capture.
- Original admitted transaction reversal edits carried alongside the existing complete target, retaining the same-key handoff guard. General restoration target semantics remain unmigrated.
- Separately identifiable prepend installation before onAdd callback delivery, with preserved first failures.

No second settlement engine, public API export or production activation was introduced. These are experimental mechanisms, not accepted integration. Physical and ordinary facts remain separate in the design, but the implementation fails to admit every required ordinary occupancy.

## Results by source/run

Node24.15.0 and pinned pnpm10.17.0; exact command lines are in the archived Nx logs.

| Evidence | Result | Meaning |
| --- | --- | --- |
| Original C1–C3 on starting source |3 failed | Preserved unmigrated structural baselines |
| Initial composition |5 passed/1 failed; expanded5 passed/5 failed | Approved completed-prepend callback order unmet |
| Separate W4 correction |10/10 new and35/35 existing | Callback/selection/order controls; not all native observer timing qualified |
| First combined structural source |20/20 | C1–C3, composition, interceptor faults and structural inverse controls |
| Prior successor/affected entity checks |73/73 | Slice1 and selected native compatibility survived this source |
| Source typecheck |Pass | Initial three wiring diagnostics preserved before correction |
| Independent topology probes |3 passed/1 refused | Useful confirmation/lifetime cases; separate active-subject inverse refusal |
| Independent W5 rekey probe + root asserting Nx |Failure reproduced | Successful rollback omits old ordinary A; blocks gate |

Counts overlap and must not be summed into a unique total. Full kernel/framework suites, semantic matrix, installed artifacts, production demo, heap/collectibility, budgets and runtime costs were **not executed** because slice2 did not survive focused review. Passing earlier evidence does not qualify this later source. No performance/retention superiority claim follows.

A separate first fault harness demanded propagation of a getter exception through deepClone; three assertions fail before later state checks. Independent review found those fault-boundary/error-precedence premises unsupported by the existing clone fallback. The exact spec and red log remain archived unchanged. Separate interceptor controls (4/4 on frozen control and combined candidate) test actual throwing preparation/reentry. No getter semantics or original assertions were weakened. One wrong-working-directory invocation executed no tests and is preserved separately.

## Other findings and limits

The independent topology probe inspection-rekeys old A to B, creates fresh A transactionally, and rejects. It refuses with `Subject 1 is already active`; this is unavailable compensation, not the primary silent omission. Its original assertions and frozen executable remain preserved.

Obligation-free topology cleanup concerns are source findings only: inspection roundtrips may retain records and the new topology clear operation has no complete teardown qualification. No GC or retained-record count was measured. Existing live ordinary divergence legitimately retains restoration facts. Entity collectibility remains unresolved, not a demonstrated receipt leak.

W4 native delivery and prepared append-stage responsibility versus rewritten prepend descriptor require further qualification; the onAdd controls alone do not prove them. Nested missing-parent semantics remain conditional and unselected. B remains closed.

## Disposition and options

Retain production and the accepted isolated slice1 checkpoint; reject this slice2 candidate and leave slices3–5 blocked. A successor would first need a reviewed complete occupancy-transition mechanism across creation, adoption, rekey and removal, including physically active displaced lifetimes—not a special case for the failing rekey. Alternatively the owner may reconsider declared-Link product scope; no such scope change is made here. Neither option is implementation approval. The current evidence supports rejection, not another automatic incremental patch.

## Replay and identities

`IDENTITY.json` inside the archive records base f80645c8e73e3a958b43b4214ffb6b6333ea332d, production source and the complete package-TypeScript manifest. Reconstruct source by applying candidate-overlay to that base at `/private/tmp/semantic-transition-slice2/candidate` and supplying pinned dependencies; experimental imports refer to that path. The standalone bundle needs no dependencies.

```sh
mkdir -p /private/tmp/slice2-evidence-replay
tar -xzf docs/audits/2026-10-17-incumbent-readiness/semantic-transition-slice2/evidence.tar.gz -C /private/tmp/slice2-evidence-replay
node --input-type=module -e 'const m=await import("/private/tmp/slice2-evidence-replay/review/rekey-vacancy.mjs"); const r=await m.run(); console.log(JSON.stringify({...r,heldAIsUndefined:r.heldA===undefined}));'
cd /private/tmp/semantic-transition-slice2/candidate
NX_DAEMON=false NX_ISOLATE_PLUGINS=false corepack pnpm nx test kernel --testFile=entity-semantic-rekey-vacancy-recurrence.spec.ts --skip-nx-cache
```

Bundle prints ids[b] and heldAIsUndefined:true; asserting Nx exits nonzero. The original C1–C3 and slice1 recurrence remain byte-identical to their preserved checkpoints.

### Source-freeze correction

The parent-generated interim manifest69de6f8d was captured while an untested cleanup edit was briefly present, immediately before that edit was reverted. It is retained as an interim source record, not the executed combined candidate identity. Final entity-signal.ts SHA25623e90e9494309c06e9665ed5e02eec2e4d0653ed342f17719f11cdb647bd20a4 exactly matches the preserved structural-first-source copy used for the20/73 runs. The final manifest also adds the root asserting recurrence spec. Review reports that quote69de6f8d were given that interim hash; their independently frozen executable bundle hashes remain the exact execution identities. Root's final Nx failure runs on the archived final source. No result is attributed to the transient cleanup edit.
