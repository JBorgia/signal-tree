# Dynamic-member enrollment successor — frozen for independent review

Bounded implementation in this candidate only. No public API, exports/barrels, SDK, root, frozen C0 or shared history changed. Main owns integration. Independent implementation review remains pending; this is not acceptance or activation.

## Identity

Predecessor: `/private/tmp/st-native-combined-c/candidate`, frozen SNAPSHOT-C0.json SHA256 `f80a70476d3e110db83242f7a17ef02964d7bb7dcb5c071de7d89151e2547e26`; 2974 files verified before copying and again at freeze.
Successor: `/private/tmp/st-dynamic-member-enrollment-successor/candidate`.
Frozen SOURCE-SHA256.json SHA256: `5f9b20cfff783d947cff974fab5e5f3ef9ac15e0e902c1638601166310e70bfb` (2975 files).
Runtime source.patch SHA256: `301071b8e583a50c8cd6f5e5e87185eeecb1490050abe8380bd4c269b4edddd3`.
Tests patch SHA256: `bf670a48f0e70c7675a153ec92a902416b774a38c47dc27fb4709e2093ea3c62`.
Source archive SHA256: `353d680edca1c53343a2341ca664956ee5636f40f6930f27e41687911d5fb0e5`.
Six runtime files plus one added spec. Original whole-value-new-keys.spec.ts is unchanged. FREEZE.json and CHANGED-SHA256.json give exact identities. `git apply --check source.patch tests.patch` succeeded against the isolated C0 baseline copy; no patch was applied to C0.

## Mechanism

- The materializer prepares the detached canonical child's ordinary snapshot, explicit absence-before/presence-after, and authenticated subtree identities before installation. No notification or completion rereads physical state to grant eligibility.
- The private prepared-occurrence path verifies the parent ancestry, registry and exact descendant addresses; it does not weaken ordinary cold capture. Reentry validates the parent/edge and recipient generation/current revision before the first physical store change.
- Dynamic recipient preparation creates plans only. Scalar preparers, field indexes and slot indexes install with physical membership. Occurrence/proof entries activate from the captured identities during installed completion, before completing that member's publication unit. Later synchronous completion callbacks can immediately write a descendant and be observed.
- Failed-plan testing exposed the existing early `inheritObservationForAddedMember` call: it armed an abandoned child and a later write could publish through the new child's address. The call now occurs only after successful physical/record installation, before membership completion. The unchanged source observation substrate still owns the claim/release implementation.
- Fresh inspection members install ordinary-absence exceptions, without publication permission. Their descendants are enrolled but masked. Supplied whole-member adoption, or a direct authored descendant write through the required ancestor path, advances ordinary membership; inspected siblings remain excluded. This extends the existing ordinary-absence path walk through ancestors, justified by the preserved direct-descendant counterexample.
- Removed/readded retained child identities reuse their enrollment. Disposal releases installed registrations and ignores captured completions for a dead binding. Failed plans have no live recipient or inherited observation registration. No new permanent registry or weak reference to live authority was introduced.

## Execution and first failures

All Nx runs use Node24.15.0, corepack/pinned pnpm, skip-nx-cache, one worker, fresh ST_PREPARED_REVIEW_OUTPUT, NX_DAEMON=false/NX_ISOLATE_PLUGINS=false/NX_TUI=false. Each run retains exact COMMAND.json, SOURCE-BEFORE.json, first.log, RESULT.json and SOURCE-AFTER.json. Original and interim failures were not overwritten. Installed dependencies reused; no external CLI review/source transfer.

| Run | Result / interpretation |
| --- | --- |
| original-timeouts | unchanged original file: 24 pass / 2 timeout, exit1 on verified C0 |
| preregistered-red | initial new controls fail on C0; raw log retained before runtime edits |
| first-runtime | 27 pass / 4 fail: inspection adoption and callable metadata name/length guards |
| source-membership-correction | 31 pass; original2 fixed plus initial5 controls |
| focused-runtime | 57 pass / 5 files; two guessed occurrence filenames matched nothing, NOT occurrence coverage |
| occurrence-and-failure | 15 pass / 5 fail: abandoned-child observation leak plus four occurrence failures |
| baseline/runs/occurrence-baseline | untouched verified C0: same four occurrence failures / 8 pass |
| failed-plan-observation | 34 pass after observation claim moved to installation |
| descendant-adoption-first and descendant-adoption-corrected | each 34 pass / 1 fail; latter used invalid leaf-runtime lookup shortcut, removed |
| descendant-adoption-path | 35 pass including direct ancestor adoption |
| spec-types-first | new fixture unknown dynamic members; fixed with explicit InstalledRow fixture type, matching original dynamic-key fixtures; no runtime/public type weakening |
| collection-inventory | failed at asserted native collection binding, before any collection-delivery assertion; see inventory below |
| relevant-final | 406 pass / 12 files; followed by stricter prepared-identity validation |
| freeze-focused | final source: 406 pass / 12 files |
| freeze-source-types | final source TypeScript exit0 |
| freeze-spec-types | final spec-type ratchet exit0, baseline unchanged |

Final focused command:
`corepack pnpm nx test kernel --skip-nx-cache whole-value-new-keys.spec.ts dynamic-member-enrollment.spec.ts dynamic-member-reactivation.spec.ts dynamic-vs-entitymap-domain.spec.ts accessor-store-coherence.spec.ts plain-branch-membership.spec.ts plain-member-absence-observation.spec.ts ordinary-member-presence.spec.ts ordinary-presence-independent.spec.ts ordinary-presence-discriminator.spec.ts absent-path-write.spec.ts absent-collection.spec.ts --maxWorkers=1`

Types: `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.typecheck-all.json` and `node tools/check-spec-types.mjs`.
Final run source identities match the frozen candidate. No source edits after freeze. Repeated passes are not additional distinct tests. Earlier intermediate runtime versions have per-run hashes and raw output; they are not all separately archived as full source trees. C0 and final source are fully reconstructible/preserved.

## Focused controls

Nine new tests cover root+nested recipients, omit/readd identity and later updates, inspection whole-member adoption, failed preparation/retry plus writes through abandoned detached child, foreign pending owner and rejection, disposal while pending, reentrant construction preserving newer identity, disposal during preparation, immediate descendant write in an installed completion, and direct descendant adoption excluding inspected siblings (some tests combine assertions). Original unchanged tests retain later n(3), complete partial membership followed by later thrown value, typed key metadata collisions, creation responsibility and transaction/recovery controls.

## Collection producer inventory — no scalar extrapolation

There are two actual installer paths: ordinary whole-value additions in signal-tree.ts, and internal keyed `materializeMember` in materialize-markers.ts.
Ordinary whole-value construction rejects EntityMap/registered marker definitions before construction (`ordinaryConstructionValue`). It cannot produce a new native collection through this path.
Keyed `materializeMember` calls its bound `materializeOrdinaryBranch` constructor. The separate probe attempted `{rows: entityMap()}` under this branch. It failed at `getEntityPublicationBinding(child.rows)` being undefined, before asserting any delivery or writing rows. This is NOT evidence of a supported native collection being repaired or broken by the enrollment mechanism. That dynamic constructor does not run the initial marker-finalization pass needed to realize the supplied definition as a native collection. The processor warning is preserved too.
Probe source moved intact outside the test suite as `collection-producer-attempt.spec.ts`; its raw failure and source manifest remain under runs/collection-inventory. No replacement success assertion was substituted. This task does not authorize enabling dynamic marker construction. Existing collections, their explicit acquisition, and direct array versus nested `{all:...}` semantics remain separately owned. No new supported dynamic native-collection producer was established by this bounded inventory; if one is supplied, its staged registration/acquisition must be qualified separately, not assumed from scalar subtree success.

## Independent review focus / limits

Review staged registration ownership and install/complete boundaries, absence versus physical membership, error/reentry cleanup, exact lifetime identity and requirement provenance. In particular, confirm that source-issued prepared occurrences and the ordinary snapshot do not confer late physical eligibility; check installed observation claims and disposal paths. Review packet is REVIEW-PACKET.md.
Four inherited occurrence-successor failures remain outside this patch (scalar/mixed/empty/collection first-omission declaration controls); they were independently reproduced on C0, not waived or changed. No broad suite, framework matrix, release build, public declarations, retained-heap/GC measurement or performance qualification. Passing spec types is a ratchet, not zero inherited diagnostics. No independent reviewer verdict yet.
