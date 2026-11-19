# Discriminator A: equal whole literal does retain native q obligation

**Empirical result:** on the unchanged frozen candidate, same-tree q writes x=7, an independent equal whole literal runs, and rejecting q restores x=0. This holds for direct setAll, root literal and omitted/restored root. q.inspect().changes remains byte-for-byte equal across the equal setter. Native ownership was NOT superseded by the publication declaration.

Foreign q is different: it owns z in another tree, not destination x. Rejecting it leaves local x=7. The unchanged frozen candidate conservatively holds both cases before settlement; only the foreign possible-window hold is the adjudicated original footprint failure. A successor cannot clean both indiscriminately.

## Runs

Scratch `/private/tmp/st-footprint-discriminator-a/candidate`, copied from `/private/tmp/st-occurrence-successor`. Every one of the frozen manifest's 2918 original files is unchanged in both directories; only a new scratch fixture was added. Source manifest SHA256 `80a0116269b26af939f775b9a10ff8a79d99b6e9b556a17b05137ab5e3f67502`.

Command (Node24.15.0, pnpm10.17.0, NX_DAEMON=false NX_ISOLATE_PLUGINS=false):

`corepack pnpm nx test kernel --skip-nx-cache footprint-discriminator-a.spec.ts`

- 001-nx.log: all twelve cases reached recorded observations, then fixture teardown incorrectly called confirm after successful rollback. Twelve cleanup failures preserved, with first fixture and 001-observations.jsonl.
- 002-nx-cleanup-corrected.log: **12 passed**. Only cleanup changed to confirm if rollback had not succeeded. First/final observations exactly match.
- Six scenarios each ran once with no responsibility observer and once with a fixture-installed delegating wrapper of the existing prepareEntityResponsibility callback. It calls the original callback unchanged and records supplied changes/plan counts; runtime source is unmodified. Observations match exactly between both runs.
- verify-and-freeze.py verifies all source hashes, q inspection equality, rejection success, destination outcome, no pre-settlement7 deliveries and both observer/cleanup comparisons. VERIFICATION.json records those checks.

The fixture asserts setup and equal physical7; post-run verification additionally asserts the decisive rejection and delivery observations. Neither a receipt status nor the count of passed cases is treated as new semantic authority. No unrelated discriminator, runtime patch, broader gate or type gate was run.

## Observed outcomes

| Native ownership / route | Receipt after equal literal | Output before rejection | Destination after rejection |
| --- | --- | --- | --- |
| same-tree q / collection setAll | no-write | none | x=0; root0 delivered |
| same-tree q / root literal | held, pending-dependency | none | x=0, other=2 delivered |
| same-tree q / omit+root restore | held, pending-dependency | only {other:1} | restored x=0, other=2 delivered |
| foreign q / collection setAll | no-write | none | x=7; root7 delivered |
| foreign q / root literal | conservative, unknown | none | x=7, other=2 delivered |
| foreign q / omit+root restore | conservative, unknown | only {other:1} | restored x=7, other=2 delivered |

For all observed equal replacements the native capture tuple is ordinary before {id:a,x:7} -> after {id:a,x:7}, structural:false. With same-tree pending q, the hook returns a plan with 3–4 metadata writes and zero adds. With only a foreign pending q, the destination hook returns no plan. Plan presence does not mean a new field obligation was recorded. Confirmed-history formation was not independently exercised in this rejection-only discriminator; the actual successful rollback is decisive for retained native obligation.

## Source explanation and next boundary

transactions.ts:2442 skips equal value/presence fields when preparing effects. Later source-admission bookkeeping can still install an empty-effects plan (:2532 onward). q's earlier field effect therefore remains current and rollback restores0. The independent publication declaration has not replaced that native responsibility. Native packet fields[] and later PathNotifier null identify a separate authored-scope mismatch; fixing the mask cannot grant permission to discard q's retained native obligation.

SELECTION-AND-ADMISSION-GAPS.md locates the exact hook/producer extensions needed, their validation/install order, and the current representation limits. Existing placement stages close over live maps; continuity tokens do not retain historical payload/order; EntityTopology.fork copies the whole collection; egress projections are relationship authority. A finite immutable source selection is not already available. The document proposes an explicit persistent-map representation with costs/retention and a source frontier protocol for later-child interception, clearly marked unimplemented/unreviewed.

Runtime successor remains blocked on that mechanism review. Original immediate foreign-window restoration assertion stays unchanged. The conflicting wider-ancestor-updater expectation remains separate.
