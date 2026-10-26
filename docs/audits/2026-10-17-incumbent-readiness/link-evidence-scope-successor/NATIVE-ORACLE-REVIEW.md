# Native provenance fixture oracle review

Read-only contract review; no test/runtime edits or runs. Reviewed the preserved original 18-case preregistration, first baseline output, established inspection controls and approved native-input design. All historical user falsifiers remain unchanged.

## Inspection assertion is a fixture-contract mismatch

The original `expect(p.inspect()).toEqual(before)` is incorrect after the fixture ordinarily replaces the very source field p authored. `before` was captured while x=7 was current. The updater callback reads that7, writes target.y7, and returns source x2. This is a newer source write; publication declaration ownership does not prevent it from superseding p's displayed contribution.

Existing `queued-inspection-review.spec.ts:25–38` explicitly distinguishes later realized scalar replacement: same path/address, status superseded. Its ABA controls (41–61) retain supersession even if the value returns. `settlement-inspection-terminality.spec.ts:95–107` explicitly rejects frozen current snapshots while a pending handle remains live: later ordinary x99 requires live status superseded. `proposal-inspection-0.spec.ts:120–130` independently specifies newer scalar replacement as supersession. This is live contribution inspection, not a prediction of the rollback plan or proof that pending authority disappeared.

The exact replacement oracle is:

| writer | after inspect().changes |
| --- | --- |
| root | `[{path:'x', address:['x'], subject:undefined, status:'superseded'}]` |
| updateAndReport | `[{path:'x', address:['x'], subject:undefined, status:'superseded'}]` |
| branch | `[{path:'pair.x', address:['pair','x'], subject:undefined, status:'superseded'}]` |

Preserve every other inspection field and the single-change cardinality. The previously returned `before` object should remain the original current snapshot; do not mutate it to make equality hold. An exact literal mapping (or an explicitly asserted single known source change) is preferable to generically changing every status in an unknown payload. No runtime cursor, authority or inspection behavior should be changed for this test.

The preserved first run reports18 failures at that assertion, with current→superseded diffs; those failures prevent later assertions from executing. Therefore this first result is **18 fixture-contract mismatches at the first assertion**, not18 proven provenance defects and not evidence that later assertions pass. Preserve original body/hash and log alongside the corrected test.

## Independent-claim oracle follows the approved input contract

The contradiction expectation is justified for all three writer forms. A native root/branch/updateAndReport callback receives its input7 from the runtime **before** it overwrites the source with2. The supplied input has a known pending source contribution p. It is not an application-hidden value saved outside a supported scope. Approved design distinguishes native requirements, execution validation and recipient evidence: known authentic owners of actual supplied inputs are common factual lower bounds and cannot be erased by independent labeling or passive enrollment changes.

The copy to target.y occurs synchronously within that updater and declaration horizon. An independent declaration names no owners, contradicting the observed p requirement; discovery occurs during callback, so after-callback/contradiction is the correct error classification. The ordinary source x2 and target.y7 writes remain installed after this declaration error. Later x2 cannot retroactively erase the dependency of the already-consumed input7. Disposing the passive source Link inside the updater cannot change native provenance or prevent that contradiction. This is a required cross-tree **observed native-input** boundary, not a promise to infer arbitrary asynchronous application causality.

## Truthful-dependent held/confirm oracle also follows

The dependent declaration names authentic pending p, which is exactly the observed source requirement. No other owner is introduced by this fixture. It should complete without a declaration error, leave y7 held with pending-dependency, and prevent local-tree-empty fallback from bypassing the known foreign dependency. That is distinct from the previously adjudicated wider-input case with an unrelated foreign transaction and no actual consumed foreign fact.

`p.inspect()` becoming superseded does not make p terminal or invalidate the dependency on its earlier supplied7. The target's ordinary copy remains its own authored truth, not p-owned rollback state. Confirming p can therefore release y7 with declared basis even though source x currently remains2. Known input support must survive its source's later overwrite until the actual dependent obligation resolves. The passive source Link was created only after the source write, so neither its enrollment nor disposal may provide or remove that native owner identity.

These are supported expected outcomes, not newly executed results. If corrected fixtures subsequently fail at contradiction, held state or confirmation, preserve those as new first runtime failures and trace them independently; do not assume the inspection correction repairs provenance.

## Exact evidence identities

- Original `NATIVE-PREREG.spec.ts`: `9a7ebc8832061b8d71e475d46f272897353ec9e13405cb1a3d93978251d01def`.
- Original `NATIVE-BASE-FIRST.log`: `8136732272579b60a76e4c63e630d49faa1daaca8f411c7c3c097668e550cacc`.
- `queued-inspection-review.spec.ts`: `b0b267a318dadd091e87aefc8765b05f094b6c65b2a33630cf62e6e23e94f40a`.
- `settlement-inspection-terminality.spec.ts`: `ea60ac112e783a4dde00e36745b46d6c2d2ccab22b5bf9731a6406b2f1132638`.
- Existing queued-inspection history includes `d93ba794` (lossless proposal address), `3e596ebe` (entity-field address contract), `d394047c` (transaction vocabulary). Those history subjects support provenance of the existing tests; no new product authority is inferred from commit titles.

## Additional enrollment16 oracle check

Inspected original `/private/tmp/link-evidence-scope-design/ENROLLMENT.spec.ts` and its preregistration unchanged. The controlling noninterference target is valid: c1's exact native input/owner requirements, declaration, own enrollment and validation horizon remain fixed, so passive c2 must not alter c1's useful **declared-basis** publication. The unrelated foreign owner p is not consumed by this callback, so its inspection remains unchanged (unlike the provenance18 source replacement).

The global `expect(otherSent).toEqual([])` is a separate, overstrong oracle. For a still-live c2 (`before-pending`, `during-pending`, and enrollment during updater), a real ordinary source update occurs after c2 enrollment. C2 may not borrow c1's declaration or evidence, and may be locally coverage-unknown; however the preserved automatic gate is tree-local. There is no pending transaction on t and no known contributing foreign dependency in this exact callback. Once relevant horizons finish, a fresh coherent ordinary c2 projection can therefore publish on **surviving** basis. No-output is not entailed by “no borrowed permission.” Requiring every such c2 to wait for unrelated p would reproduce the global unknown gate rejected by the fallback adjudication, not establish passive noninterference.

Disposal cases must be timed separately. Disposed-before-start connections may start no request, so variants which dispose before the value write or before pending delivery legitimately require no later sends. Disposal after declaration may cancel queued work but cannot retract an already-started request; the contract does not make endpoint history disappear. A blanket no-output oracle across both live and disposed variants does not establish this distinction.

Recommended **specification** distinction, not permission to edit historical tests: preserve all16 original bodies/first output, require c1 started/declared in every applicable variant, and independently observe c2's authorization basis/actual-start boundary. A live c2 may send only via its own legitimate ordinary/declared evidence; it must never gain a declared grant from c1 merely by sharing native input. A known actual foreign dependency is the contrasting control that must block c2 fallback despite an empty local gate. The current fixture's no-output assertion does not supply that dependency.

Consequently “all original16 must pass literally” conflicts with the preserved tree-local fallback in their live-c2 cases. Do not change runtime to satisfy that conflict, and do not report an adjusted vector as the unchanged16 passing. Preserve it as a test-contract issue for root/owner disposition, alongside the separately valid c1 enrollment recurrence controls. No runtime recurrence can be inferred solely from a live c2 endpoint send without determining its permission basis.
