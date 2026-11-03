# Entity reduction audit — bounded, read-only

**Prioritize dead class methods and duplicate rekey bodies; treat optional prepared facilities as a dependency split, not dead code.** No public API removal, source edits, tests, builds, or benchmarks performed. No budget increase proposed and no savings invented.

Candidate: `/Users/jonathanborgia/.codex/worktrees/capture-point-owner/signaltree`, HEAD `4b37f3fc`. Observed pre-existing changes: point-owner adapter modification and untracked point-owner research/tests; preserved. Paths/line numbers below are relative to this candidate, with `E` = `packages/kernel/src/lib/entity-signal.ts`, `S` = `packages/kernel/src/lib/physical/structural-store.ts`, `F` = `packages/kernel/src/lib/physical/entity-mutation-frame.ts`.

## Exact emitted scope

Supplied `artifacts/v16-reduction-audit-2026-10-14/attribution.json` records bare **35,434 raw / 11,930 gzip bytes**, entities **91,539 raw / 27,431 gzip bytes**. Its generator `attribute.mjs` bundles archived P1 ESM with esbuild browser/ESM/minification, `ngDevMode=false`, then gzip level 9. I read that generator, the two metafiles, and the saved entity bundle; did not execute it.

Entities output attribution: E **37,530**, S **10,486**, F **2,664** emitted raw bytes; entity-value-store **480**. None of E/S/F contributes to the bare output. These are module contributions, not removable byte counts or independently additive gzip costs. The bare/entities fixtures differ; their difference is not an isolated measurement of EntityMap internals. The three scoped archived module hashes still match attribution. The scoped candidate files are unchanged relative to its HEAD; source-to-emission rebuild equivalence was not independently established.

## Concrete reductions, ordered by confidence

### 1. Delete obsolete numeric restore-index implementation

Delete `S:388–417 restoreIndexForSubjects` and its sole helper `S:847 indexOfNode`. They remain present by name in `entities.bundle.js` despite no current execution path found. Keep `nodePrecedes`: the live placement resolver also uses it.

Evidence exceeds a single caller search: searched repository source/tests/tools for both names, inspected class consumers (`E`, F and `physical/entity-handle-resolution.ts`), public entrypoints and framework packages, and checked history (`git log -S`, introduction in `dbf958adb`). The only external remaining name reference found is the static function list in `tools/subject-identity-census.mjs:140`, plus its generated census/old records. Neither is an invocation. The live restore path is `E:1582 frame.stageSubjectRestore` → `F:prepareCommitInstructions` → `S:510 resolveSubjectRestorePlacement` → `F:commit` → `S:565 restoreSubjectAtResolvedPlacement`. It uses resolved anchors, not a numeric index.

Expected graph: shrink the retained StructuralStore class in entity-containing outputs; no bare change or module-level dependency removal. Refresh the census inventory when implementing; preserve historical records. This is the clearest genuinely unused implementation found.

### 2. Remove test-only wrappers from the production graph, preserving the tests

- `S:491 restoreSubject` is a convenience wrapper around resolve-placement + install-placement. Production F already calls those two methods directly. Its current invocations are in `structural-store.spec.ts:40,131,142,153,166,181,200`. Replace it with a spec-local helper exercising the same two production operations, then delete the production wrapper. Keep all restoration semantics and lower-level methods.
- Move `S:657–741 __assertActiveOrderIntegrityForTesting` to a test support helper; current calls are `structural-store.spec.ts:28,204`. The method is present in the production bundle. Preserve its checks of both private indexes, links, active states and count: weakening it to a public snapshot assertion would lose coverage. A test-only cast/helper or test build seam is needed because TypeScript fields are private. No production import back to that helper.
- E attaches testing/probe seams unconditionally at `4335–4377`: `__acquireEntityHandleForTesting`, `__resolveEntityHandleForTesting`, `__rebuildActiveProjectionFromOwnersForTesting`, `__retireSubjectRetainedValueBackingForTesting`; also `__planSubjectReclamation` at `4350` is a test-facing convenience wrapper. Functions are at `476–488`, `2726`, and the inline planner attachment. Move these to an explicit test/probe seam or compile-time-eliminable test branch. Do not merely rename them or delete the tests.

Dependencies: acquisition is used by `tools/bench-entity-realization-retention.mjs:61,142,145` and `tools/probe-restoration-required-set.mjs:98`; those probes need a deliberate nonproduction route. Projection/reclamation/retirement tests include `entity-signal.spec.ts:299,354,372,431,1003,1195` and many later projection assertions. `__resolveEntityHandleForTesting` is the E consumer of the `resolveEntityHandle` helper imported at `E:26`; removing that production edge can allow `physical/entity-handle-resolution` to disappear from this graph. **Do not delete `StructuralStore.resolveSubjectHandle`: live row reads use it at `E:2350`.** Likewise acquisition/store primitives should only disappear if a complete consumer check after the seam change permits it.

Expected graph: smaller E/S and potentially removal of the test-only entity-handle-resolution module edge. Removing the `__planSubjectReclamation` wrapper does **not** remove the reclamation planner: `E:2531` still calls it. These are internal seams, not public exports; inspected root/adapter/internals entrypoints and package export map. Coordinate test-hook work with the owner's diagnostic-cost audit rather than double-counting it.

Historical caveat: `e9d62712` explicitly removed rejected index experiment shadow paths while retaining integrity controls. Move those controls out of production; do not erase their protection or resurrect the rejected index-removal experiment.

### 3. Share rekey execution/publication, keep distinct preparation semantics

`E:1097–1184 planRekey` and `1186–1265 planPreparedRekey` duplicate transfer-frame construction, changed-subject publication, rekey tracking, participation narrowing, active selection update, synchronization and notification. Make the validated ordinary planner delegate to the common prepared execution body after retaining its checks and subject/entity resolution. Preserve the two hook entrypoints and no-op behavior; the removable material is the duplicate body.

Callsites: public `changeId` uses `E:3016 planRekey`; hooks are installed at `4293,4298`. `internals/causal-runtime/tree-realization-adapter.ts:1081–1106` selects the prepared form when its prepared context supplies the subject/value, otherwise the ordinary form. The prepared form intentionally cannot re-read current occupancy as if prior planned removals/rekeys had already installed. Replacing it with the ordinary validating planner would break that distinction.

History: `1bd52ed0` and `0e47de5c` fixed participation width, including no-op rekeys; `enhancers/restoration/rekey-claim-width-0.spec.ts:66,106,130,173,189,236,262,286` covers ordinary/prepared participation, rejection, redo, held identity, undo and rollback. Preserve `lastSubjectIds` narrowing and selection/publication order. Expected graph: smaller E body, same modules and public behavior. No measured byte estimate.

### 4. Split optional prepared implementations from core entity ownership — conditional design candidate

Plain EntityMap forcibly retains `preparePointValues` (`E:495–533`), full transition preparation/readback (`535–740`), restoration planners (`1515–1724`) and their hook attachments (`4280–4323`). All are retained in the supplied plain entities bundle. Full structural preparation/install (`S:218–323`) is reached through `E:578,630`; frame restore staging/preflight/install is reached through `E:1582` and F. They are live optional functionality, not obsolete implementations.

Concrete split boundary: retain core physical stores and minimal collection identity/read-source/publication primitives in the entity owner; move point/transition planning and restore-specific preparation into an explicitly supplied optional kernel implementation, installed from the causal/restoration consumer side. Split read-only transition identity/source access from mutation preparation first. A runtime `if (hasRestorationAuthority)` around functions still statically imported by E is insufficient to remove their emitted bytes. Simply extracting them into another E-imported file is also insufficient. Any factory/port must retain one kernel authority and fit the existing construction contract; this audit does not approve a new architecture.

Critical consumers to preserve:

- Transition binding: `transactions.ts:2450–2452,2698–2700`; `restoration.ts:1828–1830,2978–2980,3049–3051` (under their enhancer directories).
- **Not just restoration:** `internals/plain-branch-membership.ts:65–73` identifies collections via `__prepareTransitionTarget`; `562–570` reads installed rows and `745–754` resolves hidden collections. `internals/state-location-view.ts:123` reads its subjects. Removing the whole binding from plain entities can change membership/read semantics even if preparation itself is unused.
- Point plans: tree-realization adapter `720,738`; fresh/restore `1002–1036`; remove `1141–1154`; legacy direct restore `1457,1593`. These hooks cannot be called dead.
- Link projection: `lib/link.ts:331,377,491,552,570` consumes/reseeds `getEntityProjectionSeed`. Preserve E's `4249–4274` seed, membership source at `4240`, and restore structural publication (`E:1593–1615`). Link topology depends on membership-add facts, not only updated row values.
- Native adapters share these owners: Angular `src/index.ts:23`, Vue `:33`, Solid `:35` call kernel adapter `createSignalTreeFactory`; `kernel/src/adapter.ts:86–103` supplies native locations to the same kernel construction. Entity marker `lib/markers/entity-map.ts:252–286` passes that location runtime to E. React uses kernel facilities rather than a separate StructuralStore implementation. Preserve epoch advancement, held-row identity and install-before-publication ordering across realizations; absence of direct framework imports of S/F is not absence of framework dependency.

History/tests: `e3dc446f` deliberately introduced detached complete targets for swaps/reorder and all-owner preparation before installation. `physical/declarative-target-binding.spec.ts:24,88,130` covers held facades, key swaps and detached values. `F` specs at `100,129` require active-forget/restore preparation failures to leave earlier staged work unapplied. `689dd67b` preserved entity lifetime/replay facts. Splitting must preserve those properties; deleting preparation or collapsing it into mutation is not justified.

Expected graph if the static edge is genuinely cut: plain entities may exclude restore/target planners, S's full-target builder and restore-specific F preparation branches, while enhanced graphs retain them. Core S/F remain. No claim that all deepClone/deepEqual code disappears: ordinary entity writes use shared utilities too. Coordination with the transaction/realization reviewer is required at these consumer edges.

## Keep: live core facilities that look optional

F is not an optional transaction-only frame. Ordinary entity mutations stage fresh subjects (`E:1941,2074`), replacements (`1950,3138,3226`), tombstones (`3334,3418`), and batched setAll operations (`3914–3916`). Zero-owner reclamation stages retirement at `2703`; do not remove `forgetLifetime`, `forgetSubject`, or the preflight active-state check. `E:2595` also serves prepared reclamation, whose hooks are consumed by `internals/subject-reclamation-sink.ts:84,104` and `causal-runtime/subject-reclamation-coordinator.ts:78,108,223`. `entity-map.ts:309–315` registers restoration-owned collections for reclamation; no-restorer trees instead reclaim at retirement. Their publication suppression prevents re-interning deleted revision records (`E:2601,2715`).

No evidence here justifies deleting either active node index, rewriting public mutators, dropping collection order, or removing restoration/lifetime semantics to meet a ceiling. The immediate source-reduction candidates are items 1–3; item 4 needs an ownership-preserving dependency design and subsequent validation, not a budget exception.
