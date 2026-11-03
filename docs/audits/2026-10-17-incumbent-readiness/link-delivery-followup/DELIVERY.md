# Bounded delivery follow-up — final

Baseline checkout HEAD65dd717fcda88663d0200c5b254784aec37f9239. Private source-loader experiment only. No repository changes or public API. Prior `/private/tmp/link-policy-bridge` preserved. `witness.ts` is byte-identical to its previous witness. Premise review and fixed acceptance precede implementation in PROPOSAL.md and `/private/tmp/link-delivery-record/{SPEC.md,premise-review.md}`.

## Result

One delivery mechanism revision passes all 34 targeted assertions. The unchanged previous witness now passes its bridge stale-reentry and held-inflight replacement assertions. Inherited tree-destruction sends42 remains a FAIL in both scheduler-control and bridge; later confirmation of that destroyed tree throws as separate harness aftermath. The copied7-after-rollback control failure remains: unowned y copy survives x rollback, then control sends7. These are not newly repaired contracts.

Ordinary constant42 remains unknown and held after unrelated confirmation, including actual `settled()` remaining pending. This is **UNMET automatic independent progress**, caused by absent eligibility evidence, not a delivery wake problem. Passing its no-leak assertion is not useful-publication acceptance.

## Mechanism and bounded change

Actual Link still owns eligible projection, queue/chain, knownY, endpoint invocation and settled/disposal machinery. Private admission no longer retains unresolved send callbacks. A denied send adds an entry to actual Link's `held` set and resolves the current attempt without starting I/O, so the existing chain drains. A later eligible flush releases that same actual held entry and can reconcile. Equality to knownY still releases held settlement without duplicate I/O.

Each attempt captures its metadata ticket alongside `now`. Immediately after `observeLink()`, the final guard checks that ticket against enqueue-side latest revision and eligibility, as well as existing disposed state. A changed unknown revision cancels the old attempt and remains held; an eligible replacement reaches the existing next flush. An observer throw resets sending before the existing rejection/report path. No delivery algorithm changes followed the first run.

Started42 is acknowledged as42 even if requested9 exists; the existing serialized reconciliation then sends9. This does not recall42 or pretend it acknowledged9. No tree-lifetime validity was added.

## Fixed controls

| Control | Evidence |
| --- | --- |
| D1 paired ingress, original witness | Bridge `[42,7]` while x7 pending; scheduler-control holds then sends7. |
| D2 unknown direct/copy | Holds before/after confirm; actual settled pending. Eligibility requirement UNMET. |
| D3 observer unknown/eligible replacement | No stale42. Later9 sends; observer direct eligible9 also sends only9. |
| D4 started42→unknown7→complete42→eligible9 | Exact starts `[42,9]`, max one in flight; actual held settlement releases. |
| D5 started42→eligible9→complete42 | Exact `[42,9]`, max one in flight. |
| D6 repeated unknown/eligible and coalescing | Latest10 only; actual prior held wait resolves. |
| D7 held/started disposal | Held wait resolves; no new call. Started42 only after disposal. Original queued disposal preserved. |
| D8 equality correction | Already sent42; unknown7 holds settled; authoritative42 clears actual held without duplicate send. |
| D9 endpoint rejection | Exact attempts42,9; asserts existing onTreeError reports one link:set at y with original error. |
| D10 observer throw | No stale42; sending false; later9 progresses; asserts existing onTreeError reports one link:set at y with original error. |
| D11 tree destruction | Inherited send42 FAIL retained; no tree-terminal claim. |

First targeted run had32 assertions; final adds only two reviewer-requested observable error-report assertions. All34 pass. Event traces include starts/completions, held settlement timing, and error reports. No test removes prior failures.

## Immutable-ticket attack and authorized correction

First implementation inherited mutable `{revision,clean}` facts. `first-attack-traces.json` demonstrates notifier recipient assigning clean=true: assignment succeeds, fact unfrozen, copied speculative7 sends. This is a real first failure, not a compiler error. `first-attack-bundle.mjs` preserves exact attacked code. `first-source/` contains the entire pre-run source snapshot.

The root explicitly authorized completing the omitted immutability requirement without redesign: Fact properties became readonly and creation uses Object.freeze. No other policy change. `attack-traces.json` now records assignment throws, clean remainsfalse, frozen true, sent`[]`. The primitive-only fact has no nested mutable container. This does not claim arbitrary Map/Set payload immutability or change the separate evidence engine.

## Replay and source identity

All commands use Node v24.15.0 and the baseline-installed esbuild:

- `node /private/tmp/link-delivery-followup/loader.mjs` — exact prior witness, with private follow-up transform.
- `TARGETED=1 node /private/tmp/link-delivery-followup/loader.mjs` — fixed targeted cases.
- `node /private/tmp/link-delivery-followup/attack-loader.mjs` — actual ticket mutation attack.
- `<baseline>/node_modules/.bin/tsc --noEmit --strict --target es2023 --module nodenext /private/tmp/link-delivery-followup/private.ts` — passes, empty typecheck.log.

First outputs are first-replay.log, first-targeted.log, first-attack.log and corresponding preserved trace JSON. Final traces are traces.json, targeted-traces.json, attack-traces.json. Final targeted reports are also in final-targeted-reports.log. Each bundle has a matching receipt file listing original/loaded SHA256 for all kernel sources and exact substitution counts; original/loaded Link and notifier source snapshots accompany them. SHA256SUMS pins all final files recursively, including first-source. Esbuild execution is not transformed-source type checking; only standalone private helper was strict-checked. No compilation failures occurred in this follow-up.

The replay's bridge=false rows exercise original scheduling through the transformed helper, not a separately byte-identical original kernel bundle; original source snapshots/receipts disclose instrumentation. The earlier unchanged-source control remains archived in the previous harness and is not silently presented as a fresh baseline65dd run.

## Limits and disposition

Only scalar authoritative ingress evidence is integrated. No automatic portable tracking, callback provenance inference, async ownership, records/native/entity qualification, retention measurement, costs, release gates or production acceptance. latest revision Map and receipts remain retained research metadata; private held callback map is no longer used, but no memory cleanup claim follows. B/C and immutable owner outcomes belong to the separate model worker; this result does not qualify their integration.

Delivery controls improve within this bounded seam. Missing automatic eligibility and inherited tree terminality remain explicitly unresolved. No further mechanism changes or tests are planned; artifacts frozen for independent review.
