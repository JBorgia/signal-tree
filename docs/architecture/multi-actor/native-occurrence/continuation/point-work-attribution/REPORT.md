# C21 point-work attribution — bounded diagnostic

Exact C21 manifest SHA-256 `73e4ecfde64ee05a1eed1eb1362e8ca6f18755b1192a3583454440ef4ad68c27`. All 3066 baseline files reverified unchanged after execution (AUDIT.json). Only a new diagnostic spec is added; DIAGNOSTIC.patch and SNAPSHOT-DIAGNOSTIC.json identify it. Root and frozen C21 were not edited. Dependencies symlink the working root node_modules; runner pins Node 24.15.0/corepack pnpm 10.17.0, disables Nx daemon/cloud, maxWorkers=1. This is not release verification.

## Actual finding

The unchanged `entity-granular-reactivity.spec.ts` test fails its original `<2000` assertion at line 215 with **13,800**. Its 2k/20k equality assertion at line 214 passes first. Original first log, command and exit are preserved as `original-first-*`. No assertion or budget changed.

Fresh diagnostic results are **13,800 at 2,000 rows and 13,800 at 20,000 rows**, exactly **69 visits on each of 200 updates**. Complete operation/stack/call/visit histograms match between populations, not just totals. Updated values of all 200 rows and an untouched row are checked outside measurement. This reproduces fixed counted overhead for this two-field, one-field-write workload; it does not demonstrate collection-size scaling.

| Charged source area | Visits / 200 updates | Per update |
| --- | ---: | ---: |
| experimental-publication/entity.ts | 4600 | 23 |
| internals/entity-publication.ts | 2800 | 14 |
| entity-signal.ts | 2600 | 13 |
| internals/intrinsic-mutation.ts | 1200 | 6 |
| experimental-publication/private.ts | 1000 | 5 |
| internals/utilities/deep-equal.ts | 800 | 4 |
| internals/location-runtime.ts | 600 | 3 |
| physical/entity-value-store.ts | 200 | 1 |
| Total | 13800 | 69 |

Raw `rows-2000.json` / `rows-20000.json` retain up to five source stack frames per operator. SUMMARY.json gives every charged first callsite and operator; zero-length calls are retained separately in raw evidence.

## Necessary roles versus repeated representation work

* Native entity support accounts for 23/69. Four two-field Map copies charge 400 each: entity.ts:148 clones ordinary field endpoints, :149 clones physical views, :162 captures the physical per-edit row, :196 captures the selected physical evidence row. The remaining 3000 visits walk singleton edits/field lists, pair the physical unit, and prepare installation writes. This is row-field work, not iteration over all entities. The last two snapshots traverse the same small row representation successively (800 visits combined), but the latter rewrites selected requirements and is retained by per-edit evidence. Duplicate traversal is established; safe deletion is not. Native support must remain valid without recipients, across retained evidence, reentry and equal-value authorship. An empty recipient set is not authority to skip it.
* Publication admission/completion accounts for 14/69. AdmissionMetadata.array at entity-publication.ts:76 charges 800; copying field metadata at :64 charges 600. These implement ownership transfer/freeze and preserve edit identity. Other charges prepare step metadata, native parts, record composition, finalization and completion. entity-signal.ts:2600 and :2601 independently map the same ordinaryPlan.changes into equivalent edit shells for packet ordinary and step ordinary (200 each); :2562 also maps the step and slices physical membership (200 each). This is directly observed repeated representation work. Sharing those shells is an optimization question with admission identity/immutability obligations, not an already-proven removable 400 visits.
* combineTerminalRecords at intrinsic-mutation.ts:20 charges 1200: two calls per write, each filtering three plan slots. Raw stacks distinguish native entity.ts:230 (600) from EntityPublicationSource.prepare:248 (600). These combine different layers of prepared installation records; neither scans collection history. The counter charges undefined slots too. Its flatMap concatenation and installation's indexed loops are not charged by this counter, so 1200 is not total composition cost.
* private.ts:113/:127 contributes 1000, exactly five visits per update: capture one writable-location view, map its requirement, iterate into a Set, iterate that Set into an array, map captureNativeInput. Stack shows location-runtime.derive -> publicationInputCapture -> native captureInput. This is real native input capture, not a collection recipient traversal. Set dedup is trivial for this observed singleton but serves multi-input semantics generally. Owner/dependency arrays in lifecycle.ts are empty in this fixture: their calls occur with zero charged visits. No claim is made for owner-bearing updates.
* deepEqual's Object.keys at :228/:229 charge 800 for the before/after two-field row equality check. location-runtime :404/:422/:386 charges 600 moving the one publisher through grouped invalidation and delivery. Those are useful value/invalidation responsibilities; no duplicate notification is demonstrated. Other entity-signal charges are patch-field enumeration, ordinary topology preparation, and completion delivery. Full callsite amounts remain in SUMMARY.json.

Thus the measured overhead is distributed across preparation, support, ownership and invalidation. The evidence does not justify declaring all native work dispensable, changing loop syntax to escape the counter, or promising that any local reduction closes `<2000`. No runtime correction was attempted.

## Counter calibration and limits

The diagnostic embeds the original counter byte-for-byte (COUNTER-EXACT.txt, hash in AUDIT.json) and runs both original and attributed counters against separately seeded identical workloads. Attribution patches exactly the same operators/charge rules. A busy guard excludes stack collection, parsing and histogram bookkeeping; setup/restoration are excluded. Actual application callbacks remain charged. Calibrations passed: empty 0; positive iterator/copy/map 7; nested map/includes 8; throw identity and prototype restoration. All three diagnostic tests pass. Original positive calibration is after its failing budget assertion, so the companion explicitly executes it.

Array methods charge full receiver length even for early exit; iterator next charges each yielded element; Object enumeration charges returned length; push charges argument count. This is a partial work-per-field/owner proxy, not all runtime complexity, allocation volume, actual comparisons or timings. Indexed loops, flatMap and Map/Set point operations are not comprehensively counted. Field width, owner/dependency count and recipient demand were not varied. No large 130k run, timing claim, broader suite or runtime mutation was performed.

## Reproduction and checks

Exact argv/env/cwd are in the corresponding `*-command.json`, raw output in `*.log`, child exit in `*-exit.json` (the Python wrapper itself does not propagate child exit).

- `python3 run.py original-first candidate nx test kernel entity-granular-reactivity.spec.ts '--testNamePattern=a single-entity update does not rebuild' --skip-nx-cache --maxWorkers=1`: unchanged first count failure, one failed / nine skipped. See command JSON for authoritative argv.
- `python3 run.py attribution-first candidate nx test kernel point-work-attribution.spec.ts --skip-nx-cache --maxWorkers=1`: three passed.
- `python3 run.py spec-types candidate exec node tools/check-spec-types.mjs`: passed (exit 0), recorded in spec-types-exit.json.
- `python3 freeze.py`: all baseline hashes, exact counter inclusion, complete cross-population histogram and per-write equality verified.

The unchanged budget failure remains open. Diagnostic evidence is review-ready; this report grants no optimization or budget-change authority.
