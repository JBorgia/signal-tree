# Independent prepared-unit design review

Disposition: the shared prepare/install/deliver direction is justified by the demonstrated safety failure and can proceed as bounded implementation work once the three concrete prerequisites below are made explicit in its tests and private records. No new owner policy or public staged-read API is required. The proposal is not yet evidence that mixed units or transformed sibling support are correctly implemented.

## Evidence and attribution

Read `/private/tmp/st-public-partial-install-comparison/PREPARED-UNIT-BOUNDARY.md`, `RESULTS.md`, and serialized production/experiment permutation outcomes. Compared the named seams against `/private/tmp/st-native-explicit-handoff-successor/candidate` (source manifest `057c6b8f4933eca5dbb3c0c31c069612264998b66e71c9e49ddd1a933edddad3`). The public comparison establishes the partial-install/terminal-orphan defect on retained `87f6831fa60cafe87508f0ace84b7638698ca3b0` as well as the experiment; inverse order differs. It does not identify which experimental change altered ordering.

No runtime edits or test runs in this review. Existing diagnostic results were inspected, not independently re-executed.

## 1. Transformed sibling overlap needs ordered support semantics

Proposal lines 20–22 and 43 correctly require admitted transformed deltas and source-issued sibling support, but “both selected endpoints preserved” cannot be unconditional.

Concrete case: inverse y0 is prepared, then inverse x0's public onUpdate transforms its patch to `{x:0,y:99}`. The later admitted step authors y again. Its value and source-issued support must supersede the earlier y0 selection. Retaining both baseline selections in a union map would associate y99 with the y0 certificate. The equal-value variant `{x:0,y:0}` is also necessary: value equality is not permission to retain the previous step's authority.

Source basis: updateOnePrivate uses the final transformed patch's keys as authored scope (`entity-signal.ts:2037–2085`). Publication selects an edit's restored field certificate only for that edit, otherwise admitted/proposed support (`experimental-publication/entity.ts`, `chosen` following `prepareResponsibility`). Ordered publication steps already distinguish per-step authorship. A single final `restoredFields` union or final-value diff loses that distinction.

Required refinement: maintain ordered edits and per-step selections; later authored overlap wins under the existing source admission rules. Preserve a selected endpoint in the final support only if a later authored step has not replaced it. Unaffected siblings keep their prior support; transformed siblings do not acquire an inverse certificate merely by being in the same row. A transform inconsistent with its own selected field still fails the existing selected-field validation.

Cheapest discriminator, not run here: y inverse then x inverse with a third untouched z; transform x to write y, testing both different and equal y values. Assert final physical/ordinary values, per-field support identity, unchanged z support, exact callback count and atomic refusal when the transform changes x away from its certified endpoint. Include the opposite overlap order so an explicit later selected y inverse replaces an earlier authored sibling edit.

## 2. Same-row preparation must distinguish callback inputs from the private accumulated row

The proposed single final row is necessary and sufficient in direction, but preparation must not construct every full row from presentEntity's original backing. That would let a later x-only patch reinstall y11 after the earlier y0 draft. Apply ordered materialized deltas to the same private row draft; a whole-row replacement replaces that draft and preserves its authored whole-row scope. Certified removal and own undefined remain distinct.

Keep public onUpdate arguments/call count in existing effect order. Public reads do not expose the draft. Capture per-step before/after delivery descriptors from the intended ordered step, rather than rereading either the committed backing or final combined row at delivery. `preparePointValues` currently emits a row-level tap and creates one transition; it cannot be reused unchanged to preserve these per-step facts. `prepareRealizationTransition` already applies ordered field/row edits to ordinary truth and is a useful lower-level seam, not an interceptor substitute.

Compatibility constraint: extracting common preparation must leave ordinary public updateOne/replaceOne installation and callback behavior unchanged. “Getters once” must be pinned to materializing the selected input, not used as an unsupported promise about every getter read in ordinary setters or observers. Do not introduce deep-cloning/identity changes to public payloads merely to freeze selected delivery records.

Cheapest discriminator, not run here: two selected fields on one row, with a transformed sibling and certified absence; verify no lost sibling update, per-step tap arguments/order, and final whole-unit visibility. Compare row-callable and projected-field callback reads explicitly. Their observed cache behavior is not an invented public prefix-read contract.

## 3. Mixed-unit installation requires an actual callback-free composition boundary

The proposal correctly rejects any/all booleans over an already partial loop. Before enabling a chosen route, name every required unit and ensure all callback-capable preparation/finalization has finished before its first selected store write. No unit may invoke fresh getter/equality/interceptor work or publish between installations.

Existing seams help but do not automatically satisfy this:

- `preparePointValues` has install/invalidate/publish separation, but its install still calls publication finalization; move or prove the relevant finalization is nonthrowing and callback-free before combining units.
- `preparePointRealization` installs members/scalars and collections, then publishes. Its common revision check is useful. It still depends on each constituent's installation contract.
- The general adapter can combine membership installation, scalar-frame commit and perEffect writes (`tree-realization-adapter.ts:608–630`). A scalar commit or member helper that delivers internally cannot simply be placed in the new install loop.
- A generic entity frame mark must follow both installOrdinary and its separate responsibility record, before observeCommitted. The current responsibility-undefined caller is a narrower case.

Required implementation gate: build and validate the complete chosen operation, then install prepared primitive value/topology/support/terminal records as one callback-free unit; set complete only after all required installations, before delivery. Unsupported constituent routes must not silently fall back after any portion starts installing. Do not add blanket public refusal behavior for previously supported mixed operations as an incidental shortcut; keep unqualified routes outside the claimed correction until their integration is established.

Cheapest discriminator, not run here: an actual mixed scalar/entity route with public entity blocking/transformation, assert the interceptor ran and refusal leaves all selected contributions intact. Pair it with successful complete installation followed by a propagating delivery error. If testing the perEffect fallback specifically, prove that route was reached; the existing mixed diagnostic takes preparePointRealization and does not qualify fallback. Include an independent callback write that advances the clock and invalidates preparation; it survives while selected compensation refuses.

## Terminality and lifecycle conclusion

Preparation success is not installation success. Choose exact completion accounting before preparation can throw; on preparation refusal retain usable pending authority and obligations. After complete installation, errors belong to delivery and must not make the compensated transaction retryable. A swallowed preparation failure or skipped/deferred continuation must prevent unit installation, not look like an empty successful operation. No unrelated physical-clock change supplies completion.

The proposal's split between closed per-effect invocation and unit-owned prepared records is correct: clearing a saved proceed must not destroy the unit's legitimate preparation, and abort must release that preparation. One-use continuation, fresh retry, synchronous coalesce and the existing outer-coalesce guard remain required. Ordinary public proceed semantics remain unchanged. Internal after-proceed selected reads do not create a public compatibility veto; actual batching behavior and public onUpdate still must be preserved.

These are implementation prerequisites and finite discriminators, not new semantic laws or a request to preserve partial installation. The original public refusal assertions should remain unchanged. Historical private tests may be ported to the preparation boundary without discarding their authority/reentry checks.
