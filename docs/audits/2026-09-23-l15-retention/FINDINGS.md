# L15 retention characterization — no live-policy repair

This is bounded evidence, **not L15 conformance**. The raw `held` statuses mean
only that a frozen control's assertions held. In particular, an empty pending map
is not a bounded-history result. The combined confirmed rollback/public-history
store remains unbounded and unseparated; L15's terminal-correctness versus bounded
history requirement is not closed. No cap or eviction policy was selected.

## Exact sources and execution

- Immutable HEAD: `7ade0e3ecb25ff0d06da4355b5f7d67844e147b7`.
- Current source: complete original source SHA256 maps in
  `evidence/current-counts.json` and `evidence/current-gc-v3.json`.
- Count run: `tools/experiments/l15-retention/run.mjs`; original and virtual
  instrumented transaction source hashes are both recorded. Only two count-only
  methods are inserted in the in-memory esbuild output. They change no retention,
  value, settlement or ownership. Repository production and dist are untouched.
- GC run: `tools/experiments/l15-retention/run-teardown-gc.mjs`; **no production
  instrumentation at all**. Exact production source is bundled unchanged.
- Every arm runs in a fresh Node subprocess, sequentially, with `--expose-gc`.
  Count timeout: 120 seconds; GC timeout: 30 seconds. Process memory ceilings are
  execution safety limits, not retention policy. Errors/incomplete/timeouts never
  count as passes. No timeout occurred. The v2 GC fixture hit its process memory
  ceiling and is explicitly invalid evidence, retained below.
- Every valid run reports `changedInputs: []`. `EVIDENCE-SHA256.json` fingerprints
  the copied evidence. No commands rewrote production files or shared dist.

Reproduce with new output directories (existing outputs are refused):

```sh
node tools/experiments/l15-retention/run.mjs baseline /private/tmp/l15-baseline-new
node tools/experiments/l15-retention/run.mjs current /private/tmp/l15-current-new
node tools/experiments/l15-retention/run-teardown-gc.mjs baseline /private/tmp/l15-gc-baseline-new
node tools/experiments/l15-retention/run-teardown-gc.mjs current /private/tmp/l15-gc-current-new
```

## Frozen R01–R06 observations

| Control | Immutable HEAD | Current source | What remains unproven or nonconforming |
| --- | --- | --- | --- |
| R01, 50,000 successful transactions on one live tree | 50,000 retained confirmed records; zero pending | Same | Unbounded combined confirmed evidence/history. **Not a green retention claim.** |
| R02, 50,000 rejected transactions | Zero confirmed/pending after settlement | Same | Bounded specimen, not every state topology or allocator proof |
| R03, 1,000 retries of an occupied-identity rollback | Only first refusal; pending authority lost; later retry cannot restore | All 1,000 refuse; counts/state unchanged; removal of conflict allows successful retry | Does not prove all failure causes |
| R04, one oldest pending plus 50,000 newer accepted same-field writes | One pending plus 50,000 confirmed records | One pending, **two inspection writers/two footprints**, plus 50,000 confirmed records | Inspection is compact, **TransactionAuthority confirmed ledger is not** |
| R05, destroy pending row retirement while holding runtime/handle | Pending turn, opening sequence, dependency and commit scope survive; confirmation still succeeds | Those active structures and claims clear; later confirmation and public reader refuse | Confirmed payload reclamation separately fails the GC probe below |
| R06, diagnostic journal off/on | Outcomes equal within baseline | Outcomes equal within current | Parity is not legality; baseline ABA/failed-settlement behavior is wrong in both arms. No claim for untested diagnostic interfaces |

The R01 current-source counts at terminal settlement are exactly:

- confirmed turns: **50,000**;
- retained effect slots: **50,000**;
- retained scalar baseline entries: **50,000**;
- pending turns, pending opening sequences, dependency effects, queued evidence,
  capture buckets/effects, inspection writers/footprints: **0**.

After `destroy()`, with the tree/runtime still intentionally held, all **50,000
confirmed turns, 50,000 effect slots and 50,000 baseline entries remain**.
The public reader refuses then; absence of reader rights does not itself free
its runtime's references. That teardown defect is independent of live policy.

R04 reaches the same 50,000 confirmed/effect/baseline counts while one rollback
obligation remains. Rejecting the oldest pending transaction preserves the
latest accepted value and clears pending/inspection structures. The confirmed
array still contains 50,000 records afterward.

Current R01 live GC heap samples: construction 4.61 MiB; 1,000 confirmations
5.72 MiB; 10,000 9.63 MiB; 50,000 27.10 MiB; terminal-live sample 26.95 MiB.
These are single-process samples from the recorded generator, **not bytes
attributed uniquely to any field or a performance claim**. Typed-array backing
stores are not comprehensively represented by `heapUsed`.

## Retention obligations and actual readers

The inventory searches current `packages/kernel/src` and `tools` for
`confirmedTurns`, `getConfirmedTurnRecords`, `getConfirmedTurnCount` and
`getConfirmedTurnIds`, excluding specs and semantics harnesses. The exact matches
are retained in `evidence/consumer-inventory.txt`. The private Studio workspace
and downstream application consumers were not searched by this task.

| Structure | Known role/readers | Classification |
| --- | --- | --- |
| `TransactionAuthority.pendingTurns`, `pendingOpenedAtSeq`, queued evidence | Pending rollback, overlap refusal and settlement | Active correctness |
| `dependencyLedger` | Later realized/ordinary effects after a pending opening; cleared when quiet | Active correctness; no fixed live bound proven |
| `inspectionWrites` | Proposal's latest surviving writer chronology | Active inspection; two footprints measured under same-field 50k churn, distinct from confirmed ledger |
| `TransactionAuthority.confirmedTurns` | `getPendingRollbackPlan()` reads later confirmed effects; `hasConfirmedTurnAfter()` also reads it, with no current external caller found | Conditional correctness obligation while older pending work exists |
| The **same** `confirmedTurns` array | `getConfirmedTurnRecords()` → `internals.ts` projection → supported `confirmedTurnReader`; count/ID methods also forwarded on `__transactions` | Public diagnostic/history obligation while live; currently inseparable from the rollback array |
| `__baselineValues` on retained confirmed records | Written/copied with turns; located consumption is `pendingTurn.__baselineValues` during compensation | Confirmed-record necessity **not established** by current readers; do not invent one |
| Restoration history | Independently captured through lifecycle and notifications | Separate restoration obligation; not a reader of this array |
| Causal-runtime `TurnStore.confirmedTurns` | Another class/map with its own eviction path | Different authority; same field name is not evidence of identical retention |
| Diagnostic journal | Independent turns/events buffers, existing defaults 50/200 | Diagnostic-only; R06 uses defaults, no new cap introduced |

With no pending transaction, current rollback queries have no outstanding need
for old confirmed records; future pending turns have higher IDs and query their
later suffix. This establishes a distinction in obligations, **not authorization
for any chosen live eviction rule**. A long-lived oldest pending can still make a
later suffix arbitrarily large. Which sufficient dependency representation and
public history window should replace the combined array remains unresolved.

## Separate destroyed-tree GC red

The valid v3 probe allocates an obsolete ordinary array leaf after construction,
confirms it, replaces it with a new array, and destroys the tree. The old array
contains a 1 MiB typed array, but the weak target is the ordinary array actually
retained as one terminal value. It then holds only the destroyed tree, internal
runtime and public reader; it **never obtains or retains raw history snapshots**.
Sixteen complete event-loop jobs with GC run without intermediate WeakRef reads.

| GC arm, fresh process each | Expected | Current and immutable HEAD |
| --- | --- | --- |
| Destroyed tree/runtime/reader held, two confirmed turns | Obsolete array collectible | **Retained — red** |
| Live tree/runtime/reader held, two confirmed turns | History can retain array | Retained — positive control passes |
| Destroyed wrappers held, external writes only | Collectible | Collected |
| Destroyed wrappers held, rejected transaction | Collectible | Collected |
| Destroyed tree/runtime/reader released | Collectible | Collected |

In the red arm, the current value is already the replacement, two confirmed
records remain, and the public reader demonstrably throws
`STUDIO_TREE_DESTROYED`. This isolates an obsolete payload retained by destroyed
runtime ownership, not a caller intentionally retaining a snapshot. Releasing
all wrappers collects it, so this does not assert an unconditional global root.

History establishes the teardown contract independently of live retention:
`56b7fb95` (September 9) introduced per-read destruction refusal and explicitly
separated a live empty history from a dead tree. `confirmed-turn-view.ts` says a
reader holder snapshots what it needs **before** releasing the tree. Existing
reader tests pin that refusal. A teardown-only authority release can therefore
be evaluated separately from any live cap; explicit caller-held snapshots must
continue to retain their own referenced values. No teardown repair was made in
this characterization task; Descartes owns the assigned fix and controls.

## Preserved instrument corrections

- **v1:** weakly referenced an opaque object wrapper. The actual scalar capture
  recorded its fields, so even the live-history positive control collected the
  wrapper. Its destroyed-arm collection is not evidence of correct teardown.
  Rejected-object arm also exposed an unrelated structural-drift error. Sources,
  freeze and raw results are preserved; no claim of teardown correctness derives
  from this invalid target.
- **v2:** targeted a direct 1 MiB typed-array leaf. Current transaction capture
  expanded numeric keys and exceeded the subprocess's 256 MiB execution limit.
  Those are recorded errors, not completed reclamation cases. No production
  changes or increased resource ceiling were used to turn them green.
- **v3:** uses an ordinary array, which the existing scalar capture explicitly
  treats as terminal. All four controls pass, leaving only the intended
  destroyed-confirmed arm red, on both source versions. The law/assertion was
  not weakened.

The copied raw `held` statuses are intentionally unchanged. They never close
L15, R01's combined-store bound, or a general GC proof. The additional destroyed
payload red makes a narrower teardown defect concrete without settling the
remaining live-history design.
