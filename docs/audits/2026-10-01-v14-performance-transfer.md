# v15 performance techniques for the v14 store

Owner-requested audit, October 1, 2026. This is a source/history audit and an
experiment ranking, not measured v14 optimization or authorization to add v15
semantics. v14 remains a store without transaction, restoration or causal
machinery in this effort. Its existing public compatibility still applies.

## Exact scope

- v14 checkout: `release/14.1.4-oldrepo`, `a9d625d3`, core 14.1.4, clean at audit.
- v15 checkout: `fix/v15-link-settlement-diagnostics`, guidance `3e6913a5`, runtime
  `8fe2664faecbb72c22b14100a41b7060177b1b39`, candidate 15.4.0.
- Comparison harness: `9000919a`. At initial inspection its installed older arm was
  **14.1.3, not 14.1.4**. The harness package/lock now selects 14.1.4 for new
  builds; the earlier measured results remain labeled 14.1.3. New v14
  experiments must identify the maintained 14.1.4 artifact. Preserve
  the own-property field-read/security correction between those versions.
- The v15 artifact hashes and original timing evidence are in the accompanying
  performance takeover record. A source sidecar is a claim; the harness checks
  installed/served bytes but does not prove their source derivation by itself.

## Ranked portable opportunities

| Rank | Technique | Fit for the simpler v14 store | Evidence required |
| --- | --- | --- | --- |
| 1 | Stable unsorted `ids()` across value-only edits | Cache keys with membership/order invalidation around the existing Map; no subject store needed | Computed execution counts and array identity; sorted field changes and every structural path |
| 2 | Fewer temporary arrays and passes in bulk operations | Reduce allocation while retaining v14 callback phases and replacement behavior | Baseline/candidate callback and notifier traces, duplicate inputs, blocked/reentrant callbacks |
| 3 | Separate unused diagnostic catalogue from runtime messages | Keep public exports and diagnostics; improve ordinary-import tree shaking | Exact exports/messages, authoring consumers, dev/prod bundles and security diagnostics |
| 4 | Cheaper notification bookkeeping | Investigate only after characterizing v14 delivery semantics | Late subscription, flush listeners, interceptors, batch metadata and cross-tree controls |

### IDs are the best bounded first experiment

v14 `packages/core/src/lib/entity-signal.ts` starts its projections from one
version counter. A field update invalidates unsorted `ids()` and causes a fresh
key-array scan when read. v15 commit `cb3de973` separates structural key identity
from field writes. The benchmark uses IDs to calculate its visible window, so
this can matter even with the aggregate footer disabled.

Adapt the principle, not v15's structural implementation. Sorted IDs must still
respond to changes in sort fields. Keep value invalidation for `all()` and
`asMap()`. Preserve `changeId`'s distinction between the storage key and the
row's ID property. Same-key-order `setAll` must not accidentally become a whole
operation no-op. Held-node and field-reference behavior remains v14's contract.

### Bulk mutation has compatibility traps

v15 `737e0074` reduced redundant structural walks. v14 `setAll` also allocates
previous-entry, incoming-record, ID and eviction collections, but it has less
machinery and may gain less. v14 re-announces surviving rows through `onAdd`;
v15 classifies survivors as updates. Config hooks run before clearing storage,
while entity interceptors run during rebuilding. Duplicate occurrences are
observable through callbacks. None of those contracts can change as an
incidental performance backport.

### Diagnostic exports must survive

v14 exports `SIGNAL_TREE_MESSAGES` through `authoring` and `isDev` through its
root. It uses additional security and lazy-feature diagnostics. v15's reduced
message-table technique (`dda146ed`) cannot be copied as a deletion. A module
split may retain exact public exports while removing unused catalogue data from
ordinary consumer bundles. No byte saving has been established for v14.

### Do not transplant v15 notification gating

v14 PathNotifier queues writes even with no current subscribers; a subscriber
installed before the microtask flush can receive them. v15's write-time demand
contract differs. Its avoided structural-effect cloning also has no v14 analogue.
The v15 percentage gain is not a prediction for v14. Exact-artifact follow-up below confirms v14 `clear()` omits removal payloads
for path-only observers. Treat that correctness defect separately rather than
using it to justify broader notification removal.

## Already present; not new opportunities

v14 already has lazy projections and O(1) count (`6d9aae8b`), weak node caching
with guarded finalization (`409316b3`), direct unsorted filtering/early-exit find
and cached predicates (`09a20fb3`). It directly replaces Map values for one-row
updates and materializes `all()` from Map values, without v15's subject lookup
or generic mutation frame. Do not add those costs to obtain an optimization.

## Exclude

Confirmed-turn ledgers, restoration claims, undo-neighbor records, causal
membership machinery, subject epochs/tombstones, framework-realization ports
and lifetime-based replacement behavior are not performance backports. v14's
key-based held references must not become v15 lifetime references. Do not mutate
previously returned arrays or maps in place to manufacture stable identity.

## Validation before claiming a gain

Use freshly packed 14.1.4 control and one change at a time, identical production
defines, 1k/10k/50k rows, footer on/off, primitive timing separate from framework
stabilization, repeated A/B and A/A samples. Preserve host-contention labels.
Guard complexity with deterministic work counts where practical. Missing byId
lookups depend on idsSignal: insertion/rekey must still wake readers of an absent
key. Splitting catalogue files is insufficient if ordinary runtime code still
imports the frozen full catalogue; the dependency split itself must be measured. Run core tests,
typing/source checks, fresh bundle checks, the production demo and relevant docs
checks. Bulk/notifier changes require callback-order, duplicate, reentry,
first-old/latest-new, metadata and held-reference controls.

The audit establishes opportunities and exclusions. **It proves no v14 speedup.**

## Exact published 14.1.4 follow-up

A read-only probe run verified the npm-cached tarball against its recorded
SHA-512 integrity. Tarball SHA-256:
`216edbf90e81b4ca4749c42e86bfed154f9ad6896b8d41b89b7a749de00b1bba`.
Evidence and executable probes: `/private/tmp/st14-readonly-audit-2026-10-01/`
(`identity.json`, `run-exits.json`, `results.json`, `callbacks.stdout.log`).
Run the stored `.mjs` probes with Node 24.15.0. No v14 production changes.

The IDs premise reproduces: a value-only update produces a new unsorted IDs
array and reruns a computed visible window without changing keys. Sorted IDs
must remain value-reactive: sort-field edits, external signals read by the
comparator, and changes to the selected ID property all have distinct behavior.
Reentrant hooks can add rows before the outer operation's tap. Same-key setAll
still announces surviving rows and emits onChange. Limit the first optimization
experiment to unsorted value-only writes; this proves redundant work, not speedup.

### Newly confirmed correctness defect: clear notification

`node /private/tmp/st14-readonly-audit-2026-10-01/clear-minimal.mjs` exits one:
a path-only `rows.*` subscriber receives no removal when `clear()` empties the
collection. `--control` installs an empty tap and exits zero with the removal.
The same failure reproduces with synchronous delivery and ngDevMode=false;
beforeRemove, removeMany and setAll([]) controls deliver correctly. The first
probe set batching before tree construction, which reset it; corrected probes
set and assert the mode afterward. Preserve that fixture correction.

This is a shipped 14.1.4 issue, not a v15 performance regression. A v14 repair
should pin path-only and late-subscriber delivery, then remove the accidental
dependency on unrelated hooks/taps. The source cause is the `observed` check in
`packages/core/src/lib/entity-signal.ts` (`clear`, around line 1449): it builds
removed entries only for taps or `beforeRemove`, but uses those same entries
for path notification. Checking current path subscribers alone would still miss
subscriptions installed before the queued flush. Preserve v14 delivery semantics
and callback order rather than copying v15 observer-demand gating. It is separate from cache optimization.
Late subscription after `clear` is now directly measured too. With two rows and
no subscribers during removal, attaching `rows.*` before the natural microtask
or an explicit `flushSync()` receives **0/2** removals from plain `clear()`.
Adding an empty tap, using `removeMany`, or using `setAll([])` each delivers
**2/2**, including the correct previous row and undefined next value. Every
collection is empty afterward. All 118 installed package files matched the
integrity-verified tarball. See `late-clear.mjs`, `late-clear-exits.json` and
`late-clear-artifact-verification.json` in the evidence directory above.
Checking subscriber count only when the write occurs would not repair this
contract; copying v15 write-time observer gating remains incompatible.

The durable [clear-notification probe](../../tools/probe-v14-clear-notification.mjs)
accepts an isolated installed consumer directory, then `clear`, `clear-tap`,
`removeMany` or `setAll`, and `microtask` or `flushSync`. It checks the exact
14.1.4 package version and emits observed counts before asserting delivery.
Plain clear exits one; controls exit zero. This is an audit reproduction, not a
new release gate or evidence that v14 has been repaired.

### Security controls constrain comparison

Isolated exact-artifact probes confirm 14.1.3 reads inherited field getters after
replacement omits an own property; 14.1.4 returns undefined without running the
getter. Crafted circular-reference metadata pollutes Object.prototype through
14.1.3 deserialize/restore and is refused by 14.1.4. Results are in
`security-14.1.3.stdout.log` and `security-14.1.4.stdout.log`; isolated processes
removed the temporary prototype property. **Keep the 14.1.4 protections and use
14.1.4 as the performance baseline.** A smaller/faster insecure comparator is
not an optimization target.
