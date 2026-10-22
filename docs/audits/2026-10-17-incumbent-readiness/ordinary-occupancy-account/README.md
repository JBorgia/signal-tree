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

## Concrete pending contract decision

Minimal active-old relocation is already determined. A distinct payload variant
is not explicitly settled: ordinary oldA(n7), inspection relocates oldA to B and
changes displayed n99, transaction creates fresh A, then rejection. OldA must
return to A and freshA must detach. Does oldA display99 with ordinary7, or does
structural restoration replace its displayed payload with7 as well?

Existing C2 restores a physically absent old lifetime; W5 excludes incidental
field adoption, but this example's authored operation is W4 creation. Preserving
an inspected sibling on another lifetime does not settle inspected fields on
the displaced lifetime itself. The [interpretation review](interpretation-review.md)
records that distinction. The owner has been asked; no answer is inferred.
Recommendation: preserve inspected fields outside explicit field reversals.
This is a narrow physical realization choice, not a change to restored ordinary7.

## Disposition

Recurrence stop remains active. No successor is selected, and slices3–5 remain
gated. Preserve the two failures unchanged. Before runtime consideration, resolve
the payload case and demonstrate one prevalidation account covering normalization,
occupancy, value edits and approved successor placement through all private routes.
Retained ordinary divergence is a live obligation; the separate source-only false
entry cleanup risk is not a measured leak. No cost or collectibility claim follows.
B remains closed. Production hold, public API and budgets are unchanged.
