# A2 delivery boundary: independent source map

Reviewed checkout: `/private/tmp/link-a1-installed-operations`, clean HEAD `d0e7d1659900b18c9a63d280f409c0448a0c1d80`; `git diff d0e7d165 --stat` empty. Reviewed A0 SHA-256 `942c14563096ca29ba90a8a27a5bab65b139fba068cfd10ec96b68aab1365e42`, repository review and contributor contracts. This is a source/design analysis, not implementation approval. No runtime edits or test runs. Root retains successor-design authority.

## Disposition

The smallest coherent candidate is **prepare and admit the complete installed operation's exact ordinary deltas before any callback delivery, while retaining existing public path, tap and native-effect timing**. Installation sequence, not the later sequence of public notifications, must order the internal eligible projection. An existing private source/observation seam can carry this; merely looping over `notify` before taps cannot.

This is a concrete implementation gap against A0's installation/composition clauses 3, 5–7 and completion state machine. It does not require declaring a tap-authored write part of the older reversal, changing ordinary participation, adding rollback authority, or granting permission from current physical state. It remains a proposed design to verify natively. Existing primitives supply useful pieces, but none currently provides the whole delivery boundary.

## Established failure and source interval

The archived combined native Nx run `heterogeneous/reentry-permanent/FIRST.log` fails the final outbound assertion, after the physical-state assertion passes. After mixed undo, native rows are `a:777,b:12`; the last outbound rows are `a:11,b:12`. `FIRST.spec.ts` uses ordinary operations, a default collection Link and a synchronous `onUpdate` callback. It has no declaration, inspection, missing-parent case or injected fault. `SOURCE-CHECK.json` reports no before/after source changes. I inspected this evidence; I did not rerun it.

At `internals/causal-runtime/tree-realization-adapter.ts:1435–1463`, the frame installs its scalar, removal, placement, rekey, live-point and ordinary plans before delivery. It then invalidates (1464–1470) and publishes (1471–1534). `entity-signal.ts:511–590` prepares immutable row transitions, installs every row, then publishes each captured row through `notify`, immediately followed by that row's tap. Therefore an early row's callback may install a newer value for a later row before the later row's old captured payload reaches Link. All physical installation before callbacks is already true; it is insufficient when internal reduction still follows late public events.

`link.ts:565–773` still advances collection/entity eligible values from `subscribeProjection` notifications. `experimental-publication/projection.ts:10` currently forwards that subscription to ordinary `notifier.subscribe('**', ...)`. The exact captured old payload is legitimate evidence of the older operation; it is its late application as newer eligible truth that is wrong. The delayed public payload need not itself be suppressed or rewritten.

Do not confuse this with scalar admission: `experimental-publication/private.ts:92–124` already prepares installed scalar units, tracks completion and drains ordered pending work. Its notifier `annotate` and `complete` functions at 129–131 are now no-ops. The fallback `project` at 160–167 creates unknown support for an unmigrated projection. Thus this proposal replaces the remaining notification-driven **eligible reduction**, not a nonexistent active scalar notifier-authority mechanism. Conservative unknown support does not make a stale outbound value correct.

## Existing machinery and its limits

All source paths below are relative to `packages/kernel/src/lib`.

| Machinery | What it actually guarantees | What it cannot substitute for |
| --- | --- | --- |
| `tree-realization-adapter.ts:1435–1548`; existing `__preparePointValues` in `entity-signal.ts:511–590` | A prepared native inverse domain; all installed P/O changes precede its explicit invalidate/publish phases. | Publication currently walks separate row callbacks after installation; no whole-domain eligible-admission phase. |
| `path-notifier.ts:314–341` | Owner-scoped `observeEnqueue` observers receive immutable metadata/identity snapshots synchronously, before queue coalescing. Errors are contained/reported. | These are arbitrary callbacks, including possible reentry through error reporting. They run even with normal batching enabled. They cannot be used as callback-free admission. |
| `path-notifier.ts:344–408,502–580,631–705` | Computes footprints, handles batching, membership barriers, same-identity coalescing, deferred flush, and synchronous `flushSync`. | Batching false runs subscribers immediately (366–382). A loop called `notifyMany` still calls user code on its first row. A deferred flush is not source completion or an atomic operation boundary. |
| `location-runtime.ts:355–409,701–703` | Groups native publishers; at outer group exit calls each publisher and then settles consumers, retaining first error. Epoch advances publish through this group. | Does not hold path notifications or taps. Grouping native effects cannot order Link's earlier path deltas. Adapter/native notification remains a callback boundary; source admission must precede invalidation delivery too. |
| `entity-membership-view.ts:98–139`, `entity-membership-source.ts:91–107` | Existing optional reversal hold queues committed membership deltas, drains after installation, and appends reentrant listener mutations after older queued deltas. | This is read-only tooling, not Link authority. Its inventory's nested units join (`entity-membership-inventory.ts:108–127`); A0 reentrant operations must remain distinct. Do not import its whole-tree discovery walk or copy its grouping as new authority. |
| `mutation-capture-runtime.ts:100–125` versus rich publish functions later in that file | Prepared terminal responsibility can install without calling rich observers. | Rich committed-entity/order publication is callback fanout, not pure admission. It must not become a hidden admission callback. |
| `internals/commit-consequence.ts:177–235` | Existing causal/transaction settlement scheduling and collapse behavior. | Does not repair source chronology. Preserve it; arbitrary deferral to another microtask/timer or waiting for caller discipline changes the problem. |
| `internals/path-observation-port.ts:1–85` | Nullable optional delivery boundary; kernel does not value-import the optional notifier. | An additional permanent duplicate publication engine would violate its one-semantic-job rationale and bare-kernel ownership. Evolve/replace the private job behind this seam rather than add a public API or parallel authority. |

## Compatibility constraints the candidate must preserve

1. Public synchronous notification remains synchronous. `path-notifier.spec.ts:748–807` checks immediate `flushSync`, notification-before-`onFlush`, and batching-disabled immediate calls. `path-notifier.ts:454–462` explicitly distinguishes deferred isolation from synchronous propagation. `transactions/transaction-safety.spec.ts:255–313` requires the exact thrown subscriber error after compensation has applied and the transaction has settled. Do not silently buffer those user callbacks to group end.
2. Tap order, payload and subscription semantics remain. `entity-replay-tap-boundaries.spec.ts:45–89` distinguishes per-field replay changes from full-row target changes; 92–125 checks complete native state and a surviving reentrant update; 128–152 checks self-unsubscribe prevents later taps without interrupting installation. Delivering all taps before all paths or all paths before all taps changes existing order and must not be smuggled into a private fix.
3. Native invalidation timing remains. `entity-tap-reads.spec.ts:262–283` explicitly expects a previously obtained collection cell to retain its old cache inside the tap while a fresh collection read sees installed membership; the held cell becomes fresh after group end. Settling native groups early to make internal publication work is a semantic change.
4. Reversal membership delivery already promises commit order and complete installation. `restoration/membership-reversal-delivery.spec.ts:236–290,295–346` covers reentrant membership writes and later-delta survival after synchronous notifier errors. Preserve that optional reader's behavior and disposal containment.

These source/tests establish timing obligations, not that every conceivable ordering among unrelated subscribers is a separate public guarantee. The conservative design preserves the current callback schedule rather than selecting a new one.

## Smallest coherent admission option

Prepare exact O deltas, native identities, affected recipient bindings and minimal internal queue/projection edits alongside the existing frame preparation. Any cloning, equality, reflection or recipient preparation that can throw/reenter must finish before installation, followed by revision validation. Use the selected authored/inverse domain, not incidental neighboring subjects or a final physical snapshot.

In the callback-free installation interval, install the native changes and their prepared private admission records. For this atomic reversal, all constituent older units must be registered before **any** `invalidate`, rich capture observer, `notify`, enqueue observer, tap, synchronous subscriber or native effect can run. Admission itself must not call arbitrary reducers/listeners, schedule a synchronous endpoint, clone user values or reflect over them. Either install prepared projection changes or append immutable prepared deltas whose internal drain cannot cross a delivery boundary before it consumes the complete older prefix. Register pending work before making completion observable. A queue is insufficient if its first drain can invoke callbacks while later older units are not registered.

After that admission boundary, preserve existing invalidate/publish calls and exception/settlement behavior. A callback's setter creates a distinct later installation unit. Its internal admission follows the already admitted old group even when its public notification runs before a remaining old public notification. Reentrant reads of eligible state must drain this same ordered internal prefix; public notifications must not apply those deltas a second time. Keep membership visibility, exact O support and order tokens from the source unit; do not decide them from topology observed later during callback delivery.

Ordinary methods with existing partial success must register their actual installed units, then close with the partial disposition; they do not inherit reversal atomicity or receive a fabricated all-or-none group. Likewise, no whole ambient transaction becomes one operation. The scalar unit mechanism is a starting pattern, not proof that shared-branch/collection composition or source readiness is implemented.

Affected-source lookup, disposal and pending-work release remain necessary: no unrelated tree scan, no retained replay journal after all relevant relationships consume a unit, no started receipt acknowledging a newer revision. This is the minimum private internal replacement for notification-ordered projection, not a request to alter the public notification contract.

## Why suppression/refresh alone is weaker

A global revision check that drops an old row after any reentry loses unaffected older work. Per-row suppression still loses selected old fields when the callback changed another field on that row, and can lose membership/order edits with different support. Refreshing from P can import inspection or foreign work and broaden authority. Refreshing from the latest O is sound only if it preserves the same exact selected delta/support identities and ordering—precisely the source admission work otherwise omitted.

A versioned packet check remains useful after coherent reduction: an unstarted packet may be superseded by a newer completed projection, while an already started receipt acknowledges only its own revision. It cannot repair an eligible projection already overwritten with old data. Therefore prefer complete private admission plus revision-aware send validation, not notification suppression as the primary fix.

## Bounded falsifiers and limits

Already run by the supplied evidence: permanent mixed-undo tap reentry regression fails at final outbound equality, with native latest state correct and source hashes unchanged. This demonstrates the covered delivery recurrence; it does not prove the proposed replacement passes.

Not run in this source-only review: the same reversal with reentry from (a) `observeEnqueue` under normal batching, (b) an ordinary subscriber with batching disabled, and (c) native invalidation/effect delivery; each must retain newer installed ordinary facts in final outbound while preserving each callback's timing and error behavior. A cross-field same-row variant discriminates exact composition from whole-row revision suppression. An unrelated-row mutation discriminates precise sequencing from global-revision dropping. Existing held-cell, self-unsubscribe, synchronous-throw and membership-reader controls must remain unchanged. These are finite verification targets, not authorization to resume rejected A1 repairs.

Source hashes inspected: entity-signal `956d39c81548d5168df8ba40a20ddedd40b89b10b46d26eebb2c37827033b013`; tree-realization-adapter `167803fd47bfa52469f125f7fcddae8c5a84842f52f41b9ef8fff252d52226d0`; path-notifier `445c22fcd15b413631c7ca8852773698a2029e6f332c52fd88e4298caf1c043c`; link `1e854b98436cf1eac2b2c8e2d96ebd382031793fe02810589f555ffca93b6b4c`.
