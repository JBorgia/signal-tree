# Ordinary occupancy: reviewed design boundary

Read-only runtime investigation, 2026-10-22, after rejected checkpoint
`6bd4ee8a37ddc7ee5f84d5a983970cb8b2da8a48`. No successor implementation,
standalone model, later-slice execution or qualification is claimed.
Production remains `87f6831fa60cafe87508f0ace84b7638698ca3b0`.
Slice1 retains its previously accepted existing-lifetime scope.

## Findings

The [finite inventory](inventory-review.md) identifies 14 occupancy cases and
eight lifecycle checkpoints. Cases9/12 are derived discriminators, not executed
proof. Ordinary participating state includes installed pending contributions;
it is neither committed-only state nor Link eligibility.

The [proposed mechanism](MECHANISM.md) uses common staged Bind/Unbind admission
across creation, adoption, rekey and removal. It keeps ordinary authority facts
separate from physical realization, values and placement. This remains a
hypothesis. The [mechanism review](mechanism-review.md) and
[lowering audit](lowering-review.md) establish a specific implementation limit:
ordinary inverse effects cannot simply enter the existing physical interpreter.
Both adapter validation and complete-target derivation reject add of an already
active lifetime before installation. A shared identity join must precede both,
retain the ordinary inverse unchanged, and carry separate physical instructions
and approved placement. Relaxing the physical add guard is not a repair.

No second settlement authority is required by the two minimal witnesses as far
as source review establishes. Feasibility is not proven: normalized inverse
folding, complete-unit placement, shared validation/installation revisions and
cleanup still require executable evidence before successor acceptance. This is
larger than a displacement-table patch. No runtime changes are authorized by
this document.

## Preserved executions

Both frozen rejected bundles were replayed unchanged in this investigation:

- Rekey vacancy: rejection reports success, leaves only B, held oldA undefined.
  This is missing captured destination occupancy, not payload-ID/key divergence.
- Active old lifetime: rejection refuses because old lifetime is already active
  at B. This is unavailable compensation, not successful silent corruption.

Logs are included. Both use native operations with the established internal
inspection-context harness; neither is a browser/devtools end-to-end claim or
fault injection. No new assertions or passing runtime counts are claimed.

Original bundle SHA256 identities:

- rekey-vacancy.mjs: `4d951652b4db81193818053438b365c7488e7aa7bd80a72e4f9c610119cf9b16`
- retention-review/bundle.mjs: `61f84d18d2cab8a56024e963a02a794732b6afad46c9b635c187cbffeba6e126`

Replay against preserved local artifacts (the preceding slice2 archive retains
source, bundle and exact identity provenance):

```sh
node --input-type=module -e 'const m=await import("/private/tmp/semantic-transition-slice2/review/rekey-vacancy.mjs"); const r=await m.run(); console.log(JSON.stringify({...r,heldAIsUndefined:r.heldA===undefined}));'
node /private/tmp/semantic-transition-slice2/retention-review/bundle.mjs
```

## Owner-approved active-old payload rule

On October 22, 2026 the owner selected: **Preserve inspected display99;
ordinary truth7.** In the specified case, ordinary oldA(n7) is relocated by
inspection to B and displayed as n99; a transaction creates fresh A; rejection
must detach freshA and relocate the exact old lifetime to A. Its inspected n99
display survives while ordinary n7 is restored. Explicit field reversals remain
separate; this decision does not authorize retaining values those reversals undo.

The original [interpretation review](interpretation-review.md) remains unchanged
as the evidence for why owner authority was needed. Its pending wording describes
the pre-decision review, not current status. See the
[acceptance mapping](PAYLOAD-DECISION.md) for the required assertions and limits.
No new test execution or implementation acceptance follows from this decision.

## Disposition

Recurrence stop remains active. No successor is selected, and slices3–5 remain
gated. Preserve the two failures unchanged. Before runtime consideration, demonstrate one prevalidation account covering normalization,
occupancy, value edits and approved successor placement through all private routes.
Retained ordinary divergence is a live obligation; the separate source-only false
entry cleanup risk is not a measured leak. No cost or collectibility claim follows.
B remains closed. Production hold, public API and budgets are unchanged.
