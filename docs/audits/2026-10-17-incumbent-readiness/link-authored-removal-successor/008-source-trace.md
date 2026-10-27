# First focused authored-removal trace

005: 24 pass / 2 fail, unchanged original5, new routes8 and independent8 all pass; obligations5 has3pass2fail. 005-before/after manifests match byte-for-byte. No lifecycle edit.

## Destination-first failure

Sequence: q pending foreign; p authors O-neutral removal; r opens later; neither sends initially; p confirms, collection incorrectly sends while q remains pending. Input-first case passes (q confirms first, ordinary p gate still holds, then p confirmation delivers). This asymmetry is consistent with lost collection native proof plus ordinary tree-local pending fallback. It does not establish by itself that p/Q lifecycle cells are missing.

First source-derived loss:
- entity frame invokes source finalizer before install (entity-signal:1358). Native requirement finalizer captures fixed possible-owner window excluding only own D and actual inputs (lifecycle:108–116).
- entity native support transports source D/I/W preserving roles (experimental-publication/entity:103–115); source preparation is recipient independent.
- Link collection binding gets aggregate:true (link:567) and whole collection recipient passes no field to prepareSourceProjection (link:registerEntityRecipient).
- private prepareScalar installs unit.native; ready:183 combines its nativeProof into authoredProof.
- ready:200 (no field/presence) installs completedValueFact and payload, but projectionSupport:151 aggregate branch uses summary, baselineStructure and ancestor presence. It omits completedValueFact entirely. That leaves aggregate effective proof without this collection source's D/W. Nested recipients pass an explicitly registered field and update summary atready:199.

This is a source trace, not an instrumented proof/cell dump. Minimal candidate next probe should record p.inspect() pending status and compare same removal through held field versus collection, with same q. A private reducer correction requires review of whole collection field/domain registration; no lifecycle change is justified by this finding.

## Unsupported declaration

Qualified whole collection declaration fails before callback with unsupported-source from lifecycle:239. The existing experimental declaration supported-source predicate excludes this source. This is an unexecuted capability, not a pass and not authorization to expand the API. Original assertion/test preserved. Held field declaration proof-only independent8 case passes (remove inspected-created field whose value already undefined; held until pconfirms then useful undefined send).

## Types/infrastructure

003 source tsc log empty but shell reused reserved zsh status variable, so actual checker status unrecorded. 004 invoking nonexecutable script failed before tests. Both preserved. 006 exact checker exit2 reports only missing changed property in existing fallback project assignment atprivate:335 after metadata type addition. Narrow correction sets changed:true for that preexisting value publication; no policy change. 007 captures corrected checker exit.

## Boundaries

Retirement/selected rich capture/inspected-input fixed owner policy remain unqualified. Physical-only selected marker currently suppresses additional authored-removal derivation; whether its existing O list also needs suppressing must be reviewed before selected behavior is claimed. No second canonical payload store was added.

## Current source hashes (after type-only correction)
- `packages/kernel/src/lib/link.ts` SHA256 `b583bef6b6b006126baf4531377edb0128164035c4b295499d5c36adace9afaa`
- `packages/kernel/src/lib/experimental-publication/private.ts` SHA256 `b50e0ef118b9e9f87f25654feb5bf8950f0938326a6e921bb80e92909cfe7383`
- `packages/kernel/src/lib/experimental-publication/lifecycle.ts` SHA256 `7fcfd3098cd59bbdd9f07ff9ce46e547e63175d14ff0ea7c265a410b41593dff`
- `packages/kernel/src/lib/experimental-publication/entity.ts` SHA256 `47f8e14c3280e0fbf81bfb34149d76a120873b836ad2fed13771d5146e74a74b`

## Correction: earlier sufficient delivery bypass

After the initial trace, direct source verification establishes a sufficient earlier gate: Link552–555 explicitly sets `supported: !collection && ... && (!entityLocation || entityLocation.fieldKey !== undefined)`. Projection.supported returns exactly that identity flag (projection.ts:8). private.allowed309–310 returns true and private.admit313–314 invokes the original scheduler immediately when `!projection.supported(channel)`. Thus this collection connection's source receipt proof cannot gate delivery at all, regardless of the later aggregate proof reduction concern. Its declaration rejection uses the same unsupported identity. The observed asymmetric sequence is explained by ordinary tree-local scheduler hold (p), with no foreign-q gate. The earlier aggregate completedValueFact omission is a separate source finding, NOT established as the first operative cause of this test. No whole-collection-as-field workaround or enabling is implemented. The unchanged tests remain failed/unqualified for this currently unsupported scope.

007 corrected source typecheck exact exit0; source runtime frozen after the single fallback projected metadata `changed:true` compile correction.
