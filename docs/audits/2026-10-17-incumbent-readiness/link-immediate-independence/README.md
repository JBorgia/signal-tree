# Immediate Link independence: bounded negative decision

The responsibility-observation mechanism does not meet immediate independent
progress. Stop expanding it. Its passing ABA correction remains useful, but indexing
or cleanup cannot resolve the missing eligibility evidence demonstrated here.
Production hold and the automatic-progress release requirement remain unchanged.

Baseline: `d7c6da825e76a1e8ff82a9fa589f753ea76d4801`.
Private helper is byte-identical to the preceding responsibility experiment; loader
changes only its output directory. No production source or eligibility algorithm
changed. Node 24.15.0, four fresh processes, same standalone transformed bundle.

## Prewritten decisive expectation and execution

```ts
const t = signalTree({ x: 0, y: 0 }, { enhancers: [transactions()] });
const connection = link(t.$.y, { set: value => sent.push(value) });
const pending = t.transact(() => t.$.x(7));
t.$.y(7); // literal independent write, no read of speculative x
// Drain microtasks: required sent=[7] while pending remains open; actual sent=[]
pending.confirm();
// Drain microtasks: actual sent=[7]
```

In the paired dependent case, an x subscriber copies `t.$.x()` into y while the
transaction remains pending. That case correctly stays held. The raw receipt for y
is identical in both fresh processes, including identity counters:

```json
{"event":"revision","owner":1,"position":3,"revision":2,"clean":false,"blockers":[{"owner":1,"id":1}],"unknown":false}
```

Both writes have null ambient write context. The pending lifecycle snapshot confirms
one actual pending transaction, and all four controls send [7] after confirmation.
No result depends on an absent endpoint or a transaction that already settled.

| Case | While pending | After confirmation | Interpretation |
| --- | --- | --- | --- |
| Unconditional literal y(7) | [] instead of [7] | [7] | Proven immediate-progress failure |
| Ordinary y(x()) copy | [] | [7] | Safety control passes |
| x subscriber copies y(x()) | [] | [7] | Reactive safety control passes |
| x subscriber writes literal y(7) | [] | [7] | Diagnostic; trigger itself may depend on speculation |

The last case is not counted as a second established defect. Its original diagnostic
expectation remains saved; it cannot establish a product rule for control dependency.
First harness attempts incorrectly read transaction.status and then reader.read();
those errors and source are preserved. The corrected harness uses the existing
lifecycle reader.snapshot(). The original literal progress failure persists.

## Exact missing information

`annotate` receives mutation metadata, owner, location, authorship participation and
payload. It snapshots pending owners across registered trees. It receives no list
of consumed source revisions or their owners, and no evidence excluding a dependency.
The completion channel then transports this same fact; it does not add read evidence.
The immutable revision/receipt mechanism solves stale responsibility observation,
not attribution of a new ordinary write.

Equal payload, disjoint target location, absent transaction attribution and empty
ambient write context do not distinguish these examples. Releasing this fact while
its captured owner remains pending would also release the reactive copy. Holding
it preserves safety but fails the literal write's progress requirement. This is a
limitation of the tested inputs/representation, not proof that richer bounded read
tracking is impossible. Callback context elsewhere in the kernel is not disproved;
it is not consumed as a dependency proof by this mechanism. A callback-only guard
would also leave the direct read/copy pair unresolved.

No scan optimization or lifecycle repair was attempted after this result. Such work
would optimize a mechanism that still misses its central product requirement.

## Historical 32/34 reconciliation

The original tests/results remain unchanged. A companion reconciliation in the
archive records these two outdated expectations:

| Original expectation | Recorded actual | Contract-consistent expectation for this experiment |
| --- | --- | --- |
| `unknown never cleansed`: [] | [42] | [42] after all captured relevant owners confirm |
| `actual held after confirm`: false | true | waiter completes after confirmed eligibility/delivery |

The owner's current direction explicitly says: “Permanent holding after all relevant
owners confirm should not remain a required behavior merely because an older test
encoded it”. Earlier approved surviving-write semantics also preserve a newly authored
ordinary write after rejection; that is a separate case and does not erase another
still-pending dependency. Neither approval authorizes treating unknown dependencies
as absent. Here the experimental immutable possible-owner bound has fully confirmed.

This records a contract basis for replacing those two oracles in a future maintained
suite. No original assertion is edited, no new 34/34 run is claimed, and no release
qualification is inferred. The companion uses the prior exact replay, with its hash.

## Disposition and alternatives

Preserve responsibility observation; reject this owner-window mechanism as a solution
to immediate independence. Cross-tree safety remains bounded to the complete registry
of one instrumented runtime. Its scans and retained metadata remain unqualified.

A different eligibility source would need trustworthy read/write dependency evidence
within an explicit execution boundary, including reentry and foreign source handling.
Explicit application ownership or isolated workflows supply different information
but require a separately approved public/product contract. Keeping conservative hold
is safe but leaves automatic independent progress unmet. No alternative is selected
or implemented here; recommending another unbounded policy iteration would exceed
this finite decision. No public API, budgets, production activation or B work changed.

## Evidence and replay

[Archive](evidence.tar.gz) contains prewritten specification, unchanged helper,
loader/bundle, four raw results, first harness errors, original confirmation controls,
companion oracle reconciliation and independent review. [Checksum](SHA256SUMS)
identifies it. Internal manifest preserves uncompressed source/evidence identities.

Extract into a fresh directory and run each scenario in a fresh Node 24.15.0 process:

```sh
mkdir -p /private/tmp/link-immediate-replay
tar -xzf evidence.tar.gz -C /private/tmp/link-immediate-replay
SCENARIO=direct node --input-type=module -e 'const {run}=await import("/private/tmp/link-immediate-replay/link-immediate-decision/bundle.mjs"); console.log(JSON.stringify(await run(),null,2))'
SCENARIO=callback-copy node --input-type=module -e 'const {run}=await import("/private/tmp/link-immediate-replay/link-immediate-decision/bundle.mjs"); console.log(JSON.stringify(await run(),null,2))'
```

Use SCENARIO=copy and SCENARIO=callback-literal for the other controls. Rebuilding
loader.mjs requires its recorded worktree/dependency paths. No broad suites or
benchmarks were run; source is unchanged and the central bounded falsifier fails.
