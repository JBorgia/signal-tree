# Independent frozen C24 bounded review

**Disposition: reject composition of this prototype because selected source responsibility retains an unbounded equal-operation chain.** This does not reject the bounded source-selection premise. The remaining React receipt mismatches are not demonstrated premature-delivery failures.

## Identity and scope

Author packet: `/private/tmp/st-c24-equal-owner`; candidate beneath `candidate`. Frozen manifest SHA256 `cb54add521dafd9ec875b87d6c19f85de38e4b56d0c79c147a7c3c3e41306bcd`; runtime patch `3cd1e93852c8550bc6a5cbdba45e28e5aa4aaee6a75233cfd3b01fa244ec03ef`; base C23 manifest `bc8926949819af2cab3b716b71a04b6f3f97a6be5117b954bbfa236b66dec90b`. FREEZE itself hashes `e300477a22517723faeb0ebd3f2c16ebee8d41a73f5c6c3c24f78287f5e883f7` and explicitly labels the prototype non-composable.

`FROZEN-IDENTITY.json` records verification: all five freeze artifact hashes match; all 181 captured kernel runtime files match both frozen manifest entries and current candidate bytes. Both uninstrumented diagnostic originals match those entries. Consequently the executed captured-runtime counts below apply to this exact frozen runtime; no rerun was necessary or performed. This is not verification of every full-workspace manifest entry. Root HEAD inspected: `628d302dadb082a48c58528651c9088234d0a777`, branch `fix/d1-d2-forward-port`; root is not the candidate identity.

Reviewed frozen runtime diff and relevant current source against `docs/review-contract.md` and approved `CURRENT-SPEC.md` in `docs/architecture/multi-actor/native-occurrence/continuation/declare-api-scope-review`. No candidate, root, runtime, test, or assertion edits. No release/activation acceptance.

## Demonstrated blocker: current support grows with equal history

`packages/kernel/src/lib/experimental-publication/private.ts:157–164` preserves the selected endpoint but installs `combineNativeRequirements([retained.requirement, prepared.requirement])` on each equal declaration. `lifecycle.ts:121–127` recursively checks components and deduplicates only immediate identities, not equivalent settled support. Horizon cleanup at lines352–355 does not collapse the component chain.

Independent captured execution, leaf and whole-branch routes, live p owning x7:

| Equal declarations | Selected nodes | Depth | Readiness visits | Proof visits | D owners |
|---|---:|---:|---:|---:|---:|
| 64 | 129 | 64 | 129 | 129 | 1 |
| 256 | 513 | 256 | 513 | 513 | 1 |

Input/validation/possible-owner counts stay zero. Initial graph is one node. Receipts are discarded. Leaf confirmation retains the enlarged graph; whole rollback restores the one-node initial graph. Thus weak source keys and eventual whole-tree collection do not establish bounded live-source retention. This violates the requested bounded current-responsibility representation, without inventing a timing or heap ceiling. Flattening traversal alone while retaining every historical component would not resolve it.

Evidence and exact command: `/private/tmp/st-c24-equal-owner-retention-independent/REPORT.md`, `CAPTURE.json`, `INSTRUMENTATION.patch`, `FIRST-RUN-COUNTS.json`, `COUNTS.jsonl`, and `runs/neutral/{COMMAND.json,first.log,RESULT.json}`. The command was `corepack pnpm nx exec -- pnpm exec vitest run --config /private/tmp/st-c24-equal-owner-retention-independent/vitest.config.mjs --maxWorkers=1`, pinned Node24.15.0/pnpm10.17.0. Instrumentation only observes the selected graph and counts existing readiness/proof entries; it changes no decision. Four public cases in the first completed run pass: no early send, exact values/owner inspection, no equal notifications, pending settlement, one correct terminal delivery, settlement, no duplicate, no post-disposal delivery.

Runner limitation remains explicit: Nx exec unexpectedly repeated this same diagnostic in multiple contexts. Owned processes were stopped; wrapper exit is -15, not a successful overall qualification. First completed four-case run and its four rows are the primary evidence; all repeated raw output remains preserved. No timings, heap/GC result, or full-suite claim follows.

## Receipt distinction

Approved CURRENT-SPEC.md:42 says “No relevant authorship yields no-write” and “equal support-only authorship need not emit a native value notification.” A declaration receipt describes that invocation, not all preexisting pending connection work. Retaining the same owned endpoint and effective obligations for a literal equal write does not itself create new relevant authorship; allocating another wrapper does not change that interpretation.

Therefore `no-write` is justified for these unchanged-owned-support invocations. It does not permit clearing destination p, inherited q, or actual new input/validation obligations; it also does not cover unowned equal support changes that must make progress. Frozen `lifecycle.ts:265–270` separates invocation evidence from selected output debt: inherited support remains a dependency without being falsely asserted as newly consumed input.

Author preserved invocation-split logs report kernel14/14 and React3/6, with RESULT exit0/exit1 respectively, no timeout and unchanged source. React's three failures now concern expected held/conservative versus actual no-write, with no premature send observed at those assertions. They are not a repeated C23 early-send counterexample. Their later terminal/disposal assertions were not reached, so receipt interpretation alone cannot qualify transport behavior.

Preserve the originals. A bounded counterpart may assert exact no-write while retaining the pending-owner/no-send checks, then require exact terminal payload, settled completion, no duplicate, sticky receipt, and disposal cutoff. A genuine held-receipt disposal control still needs actual relevant pending authorship; relabeling an already terminal no-write receipt does not test held-to-disposed behavior. No counterpart was edited or run in this final review.

## Preparation, restoration, and limits

Source inspection supports the intended placement: transactions.ts:2873–2896 binds the selected first-before/after endpoints to this attempt's detached `scalarAdmission` effect objects; terminalRecord supplies those objects at4313. Direct leaves/location and frame routes pass prepared terminal metadata before publication installation. Native validation checks predecessor and physical-view identity before installation. Registry selector cleanup is registered at5184, and restoration selection uses scoped try/finally. Existing field endpoint bindings are reused for selected inverse/frame paths rather than a new historical scalar ledger.

These are source findings, **not full atomicity proof**. The old late-capture draft remains unexecuted evidence, not a validated alternative. I did not execute comprehensive callback/reentry, failed preparation, inspection-overlay certificate, cloned/inverted binding, or every restoration/teardown boundary against this freeze. In particular, source reuse of an existing physical view on an ordinary-equal write needs a targeted inspection-overlay check before claiming physical/ordinary certificate equivalence; no supported counterexample was executed here, so this is not a second established blocker.

Next required falsifier after an actual correction: rerun the bounded live-owner 64/256 graph discriminator with all useful public assertions intact, plus targeted selected-before/net-zero/inverse and validation/reentry controls warranted by the changed mechanism. Preserve D/I/V/W and live readiness while bounding settled history. No broader architecture or API widening is requested. Current disposition rests on demonstrated retention, not speculative atomicity failure or receipt-oracle preference.
