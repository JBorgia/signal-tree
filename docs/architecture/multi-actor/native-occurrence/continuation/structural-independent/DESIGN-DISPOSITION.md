# Ordinary inverse completeness and public handoff disposition

No runtime implementation. This adds a bounded design/test disposition to REVIEW.md; all original frozen tests and failures remain untouched.

## Shared invariant

For every original structural effect admitted through prepareOrdinaryEffects, the exact collection source must either produce a complete ordinary installation contribution for that step, or refuse the complete operation before physical lowering/frame preparation. A physical no-op is not an ordinary no-op. No success may depend on an installer silently ignoring an admitted effect because its context was absent.

Completeness is a property of the resolved source-owned operation, not merely the presence of effect.structuralContext. Keep original semantic endpoints for admission and exact ordered source/subject scope. Associate the resolved ordinary plan/evidence with the lowered array and the same revision/one-use boundary. Do not recompute a missing recipe from later mutable state at installation.

The existing boolean __validateOrdinaryStructure proves membership/key admissibility, not availability of an ordinary installation recipe. The demonstrated context-free remove passes that boolean, lowers to an empty physical array, and is skipped by source ordinary installation. The new shared invariant must cover that gap before lowering. Source resolution that invokes callbacks or reads callback-bearing values needs the existing reentry/revision checks; do not call such resolution callback-free merely because topology reads are pure.

## What the source can resolve without inventing history

Remove: after semantic admission confirms the exact ordinary subject is present, the source already has its effective ordinary key, ordinary value, and adjacency in the staged placement/value view. It can prepare the current removal fact and ordinary absence directly from that view. This describes the removal now being performed; it does not reconstruct an earlier authored add or invent historical ownership. Use the resolved ordinary key, not an obsolete diagnostic before key or inspection's physical key. Preserve subject-based remove semantics. A prior step in the same unit may supply the ordinary value/placement, so resolution must share ordered staging rather than reading every step from initial state.

That source-produced removal is sufficient in principle to handle context-free removal correctly. It is not implemented in the frozen candidate. If the bounded successor does not implement that resolution, the safe minimal alternative is explicit refusal of a remove lacking the recipe the current ordinary installer actually needs, at prepareOrdinaryEffects admission. Scope that refusal to the paired ordinary-realization path; do not impose it on legacy unlowered physical apply routes that correctly remove by subject. Do not defer refusal until after earlier physical plans install.

Add/restore: the source cannot infer historical restoration payload or anchors merely from physical presence/current key. The adapter's existing getStructuralAddEffect resolves authentic carried context or its existing descriptor-backed evidence. That resolved recipe must reach the ordinary installer as well as physical restore validation. Checking that the descriptor fallback exists but passing an unchanged context-free effect to an installer that skips it is not completeness. Missing restoration evidence must refuse; do not fabricate a payload, select a same-key replacement lifetime, or turn current display into historical evidence.

Rekey: the ordinary installer already constructs its fact from the original endpoints and subject. It does not require an add/remove context. Retain ordinary before/destination validation and physical lowering separately. No blanket structuralContext requirement is justified.

The narrow implementation recommendation is a shared resolve/admit step for the paired route: retain the source-resolved complete ordinary operation plus physical lowering. Where existing code cannot resolve the required ordinary contribution, mark the whole admission invalid and use its existing typed refusal. A guard may be an adequate bounded first step for the incomplete remove fixture, but it must not reject valid descriptor-resolved adds or legacy physical-only inputs merely because a field is absent.

## Private test disposition

Preserve structural-admission-sequence.spec.ts and the independent context-free presence failure as original evidence. Requirement object identity alone is not an ordinary-presence oracle; the independent probe established that the current ordinary state actually remains present.

If the author chooses explicit refusal instead of implementing source-derived removal, the successor expectation for the incomplete private fixture should be:

- prepare/validate refuses the entire operation before installation;
- direct apply of the rejected prepared result also refuses;
- physical ids, producer ordinary presence, source support/revision and any sibling state remain unchanged;
- no successful settlement/publication is asserted.

Add a separate complete-context positive, already shown feasible by independent probe: ordinary presence really becomes absent despite physical absence, and the prepared operation cannot replay. If the author instead implements source-derived removal, the context-free fixture should succeed with that same real presence/completion oracle. Neither option permits changing only the old requirement-identity assertion and declaring the no-op acceptable.

The direct remove/rekey handoff fixture remains a recorded private-route limitation. Public planning, not a relaxed physical occupancy predicate, is responsible for that complete handoff.

## Added public regressions and execution

New isolated test file: independent-public-handoff.spec.ts (also copied under independent/candidate/packages/kernel/src/lib/). Imports only the public index, no private adapter calls or casts. Initial rows have numeric 2 (“original”) and string '2' (“string”). One authored unit rekeys the original 2→1 and adds a different row at numeric 2. Compensation must remove the newly added subject and restore the original 1→2 while preserving string '2'.

Two controls executed through Nx:

1. Public undo/redo with restoration + undoable: validates initial authored image, compensating ids/order, original row handle identity/value, removed handle absence, unchanged string-key handle/value, and redo restoring the added lifetime and order.
2. Public transaction rollback: validates the same complete compensation and exact row/typed-key identities through transact/rollback.

Command (isolated copy, Node24.15.0, existing dependencies, daemon/plugins disabled):

    corepack pnpm nx test kernel --skip-nx-cache independent-public-handoff.spec.ts --reporter=json --outputFile=/private/tmp/st-structural-admission-independent/public-handoff-vitest.json --maxWorkers=1

Result: 2 passed, 0 failed, exit 0. Exact command/cwd, first log and raw JSON are in PUBLIC-HANDOFF-COMMAND.json, PUBLIC-HANDOFF-RESULT.json, public-handoff-first.log and public-handoff-vitest.json. This is genuine public planner coverage, not a rewritten private handoff test. Runtime unchanged. No new type gate or broader suite was run.

The source design remains for Main's implementation/review. Public handoff passing resolves that test-domain question; it does not excuse the incomplete private operation's silent success.
