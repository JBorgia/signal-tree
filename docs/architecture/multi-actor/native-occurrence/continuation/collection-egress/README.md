# Frozen bounded collection-egress successor

Ready for independent review, not production activation. Candidate: `/private/tmp/st-collection-egress-successor/candidate`. One runtime file changed from the reviewed row-source input; Main, root and frozen predecessor sources untouched. No public API/type change, physical reread, membership/admission bypass or proof weakening.

## Freeze identity

- Predecessor manifest: `a801391e26f62d725a99bda9deb1267020482604d67202e810687811fb017b38` (`PREDECESSOR-SHA256.json`). Verified input bytes from `/private/tmp/st-row-source-successor/candidate` before copying.
- Successor manifest: `010d069cabb8c020758fdc50f7b477655504bd9961ff99bf79becc2e1cfe18ca` (`SOURCE-SHA256.json`, 2945 files).
- Runtime patch: `source.patch`, SHA256 `8bfcadde9d93a4e10f41ebeb2c725dc7c1f0f8a5851904d8445b45a9b7e0efd9`.
- Tests patch: `tests.patch`, SHA256 `f8571355dbe153f114b307a011e838c06431d3c963ab9111e3073706169cdbdd`.
- `FREEZE.json` records the exact scope. Candidate source is frozen; no further edits after these identities were recorded.

`tests.patch` adds the new 12-case collection spec and copies the unchanged accepted six row-source controls for runnable verification. The runtime patch changes only `packages/kernel/src/lib/experimental-publication/private.ts`.

## Correction

In `ready`'s membership arm, a direct collection recipient already selects `ownCollection.payload` after its occurrence becomes exposed. Generic membership snapshots use the containing branch's `{all:...}` representation. Applying that snapshot at relative `[]` overwrote the selected row array.

The two generic membership-payload adoption branches now require `!ownCollection`. Direct collections retain the existing source-owned natural array selection; unexposed sources still use existing absent projection. Ordinary root/branch snapshot adoption and explicit nested-collection composition remain unchanged. No source is read again during completion. Source proofs, occurrence enrollment, publication eligibility and pending reduction order are unchanged.

Rationale and prerepair plan are in `DESIGN.md`. Prior exact trace is `/private/tmp/st-membership-egress-trace/README.md`.

## Before-fix evidence

- `first-controls`: unchanged Link absent-locations plus first seven new controls, **6 failed / 22 passed**. Five failures are the original collection omission/re-add failures; the sixth is same-turn collection-only omit/readd. Entire original log preserved.
- Expanded all new dimensions across ancestor versus collection-only omission BEFORE editing runtime: `expanded-prerepair`, **6 failed / 6 passed**. Failures cover same-turn direct shape, root/branch paired direct shape, independent/dependent receipts, and callback-new-write with/without throw on collection-only omission. Ancestor variants pass as boundary controls.
- `PREREPAIR-collection-natural-egress.spec.ts`, `PREREPAIR-expanded-collection-natural-egress.spec.ts`, and `PREREPAIR-private.ts` preserve those exact inputs.
- `prerepair-spec-types` found two test typing errors for marker-bearing aggregate Link sources. Public `TruthfulLinkSource` intentionally rejects those. Final root/branch representation tests explicitly use `@ts-expect-error` with that reason: they are runtime representation probes plus checked negative type boundaries, not claims that this public construction is type-admitted. No runtime assertion was weakened and no public type changed. This first type failure remains preserved.

## Validation

| Exact run artifact | Result | Scope |
| --- | --- | --- |
| `repaired-focused` | **63 passed** | new 12; original Link absent-locations 21 (all original five failures now pass); accepted row six; nested collection; native address; membership provenance |
| `repaired-source-types` | exit 0 | installed tsc, `--noEmit -p tsconfig.typecheck-all.json` |
| `repaired-spec-types` | exit 0 | canonical spec-type ratchet, no baseline change; new spec has zero diagnostics |
| `relevant-contracts` | **88 passed / 1 failed** | membership input, async settlement, commit boundary, entity membership restoration, collection Link |
| `predecessor-foreign-boundary` | same failure | exact predecessor, focused FOREIGN commit-boundary test |
| `branch-boundary` | **33 passed / 2 failed** | unchanged branch-omission file; same two predecessor failures |

New controls verify final natural array shape; same-turn omission/re-add; root/branch `{rows:{all:...}}` representation; independent declaration delivery despite an unrelated pending owner; dependent hold until confirmation; receipt `started` at endpoint entry and after settlement; endpoint callback newer writes; thrown callback error identity/reporting and subsequent corrective delivery. All assertions are outside callbacks. Callback bodies only record, perform the requested new write, or throw the fixture error. Trees/Links/error subscriptions tear down in finally blocks.

The copied row-source six verify row/field/empty-key selection, pending confirm/rollback, rekey/remove/readd lifetime isolation, disposal and unbound rejection. No claim that the two runtime aggregate probes add public API support.

## Preserved unrelated failures

1. FOREIGN commit-boundary: `link-commit-boundary-carrier.spec.ts:164` expects durable `a:'MINE'` during another tree's open transaction; observed no payload (`undefined`). Reproduced unchanged on an isolated verified row-source predecessor, **1 failed / 4 skipped**. This test has no collection membership reactivation; no correction attempted. Do not report the 89-case relevant run green.
2. Adjacent explicit replacement-adoption oracle: `branch-omission-correctness.spec.ts:292/309`, observed `{name:'Inspected'}` instead of `{name:'Ada'}`. Remains Heisenberg's separate adjudication; not changed.
3. Same-turn branch removal/reintroduction ending absent: observed `{name:'Ada',age:8}` instead of `{name:'Ada'}`. Traced independently below; not patched blindly.

The prior line-316 inspection-only omission remains passing in the unchanged branch file. No conflation with either adjacent failure.

## Separate branch failure trace

Diagnostic-only `branch-trace/` is not frozen candidate source. `branch-trace.patch` contains all logging changes against the corrected candidate. Raw `branch-native.jsonl`, `branch-native-v2.jsonl`, `branch-native-v3.jsonl` and matching `.log`/`.command.json` preserve progressive instrumentation.

Exact test: `--testNamePattern=same-turn removal and reintroduction ends absent`; **1 failed / 34 skipped**. Trace shows:

1. Membership preparation emits age absent, present (8), absent in order.
2. `ready` completes all three membership units. Its final completed presence is false; `maskPayload` correctly produces `{name:'Ada'}`. Revision 13 is projected and Link refresh receives it twice.
3. A subsequent **fallback** `project(...)` call receives `relative:['age']`, payload `{name:'Ada',age:8}`, and `pending:0`. This creates revision 14 and replaces the correct final projection.
4. Link refresh and endpoint send then receive revision 14's stale payload.

Source seam: `link.ts:819–824` applies a later notifier leaf value to eligible payload and calls `research.project`; `private.ts`'s fallback project arm installs the supplied payload directly. It is downstream of successful native membership masking, unlike the collection bug's overwrite inside membership completion. This trace establishes the concrete boundary without selecting a fallback-migration policy or implementing another repair.

## Commands and reproduction

All execution uses `run.py`: pinned Node v24.15.0 PATH, NX_DAEMON=false, NX_ISOLATE_PLUGINS=false, NX_TUI=false. Existing installed dependencies are symlinked; no external CLI transmission. Each run has exact cwd/argv/exit in `.command.json` and raw `.log`/`.exit`. Use fresh names; runner refuses evidence overwrite.

```sh
python3 /private/tmp/st-collection-egress-successor/run.py review-focused corepack pnpm nx test kernel --skip-nx-cache collection-natural-egress.spec.ts link-absent-locations.spec.ts row-source-independent.spec.ts link-nested-collection.spec.ts link-native-address.spec.ts publication-membership-provenance.spec.ts --maxWorkers=1
python3 /private/tmp/st-collection-egress-successor/run.py review-spec-types node tools/check-spec-types.mjs
python3 /private/tmp/st-collection-egress-successor/run.py review-source-types node node_modules/typescript/bin/tsc --noEmit -p tsconfig.typecheck-all.json
```

Source/spec types apply to the frozen candidate, not logging-only traces. No full suite/build/package/GC/release qualification was run or claimed. Existing archived tsconfig-resolution warnings remain in initial Nx logs. The source is available for independent review with known inherited reds explicitly retained.
