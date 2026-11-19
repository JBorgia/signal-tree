# Bounded C12 cost plan

Disposition: source-supported candidates only; no runtime patch, new measurements, or limit changes. Correctness (including the separately reviewed C14 scalar correction) takes priority. C12 manifest SHA-256 d96cb84faeec4f098b4bba00deb9b82b108a33469b965978e4d248fa354b1df2; 3053 input files verified in the preceding inspection. Source identities and prior evidence are adjacent.

Evidence: Main’s preserved C12-POINT-FIRST.log reports 13,800 selected visits for 200 point writes, against strict <2,000; the two executed specs total 16 passes/2 failures. At least 11,801 visits must disappear to pass. The prior 14,200 histogram is not a fresh C12 histogram. The singleton physical-pair path in experimental-publication/entity.ts:19–55 removes the old ordinary spread and physical find: two visits/write, predicting 400 fewer visits, consistent with the observed delta but not independently attributed. The reported clear 2N+1 remains unresolved: that clear spec did not execute in this particular log.

## 1. Shared unused proof and empty terminal-plan work

At lib/experimental-publication/lifecycle.ts:181–198, prepareNativeRequirement computes nativeProof(requirement) only to consume it in the active-frame loop. When active.length is zero, that particular read is unused and the produced record has no writes/adds. Defer only this unused proof read, and bypass composition of producer-certified empty records with a single actual terminal plan. Applicable composition sites: experimental-publication/entity.ts:230 and private.ts:130–133,210–214. Preserve actual plans, deletes/writes/adds ordering, fresh per-install requirements, unfinished/unactivated registration, inputs and finalizeNativeRequirement:200–207. No listener-count or pending-count shortcut and no lazy activation.

Discriminators: unused pre-proof calls 1→0 per empty-frame installation, while finalization and window capture remain unchanged. The prior counter assigned lifecycle zero visits, so this proof saving has no claimed proxy benefit. Bypassing the entity three-input merge predicts 3 filter visits/write (600/200) removed on that branch, plus real temporary containers; this is a conditional prediction, not a result or a route to the full ceiling. Do not book scalar-path savings against the entity workload. Before any patch, check immutable plan ownership and unchanged error precedence. Required future controls: clean versus foreign pending/confirmed history, late enrollment/input, active horizons, reentry/refusal, held snapshots, callback counts and terminal operation order. Historical support must never become falsely clean.

## 2. Avoid rebuilding order topology for an empty endpoint extension

At enhancers/restoration/order-boundary-evidence.ts:207–285, completeView always calls applyPairs for prefix and suffix. Even an empty interval list builds a node Map, finds its head, traverses and validates it. At :98–202, extend also rebuilds for empty intervals. A canonical endpoint with no selected extension can retain its token and return the same sequence contents with current fresh-array ownership, without graph replay. Shared callers are transactions.ts:1863 and restoration.ts:3972.

Constraint: do not blindly return a copy for arbitrary malformed inputs. Existing duplicate/undefined/cycle/refusal behavior needs canonical source provenance or equivalent validation/fallback. Do not skip nonempty token intervals merely because values or pairs appear equal. Physical and ordinary frontiers remain distinct.

Discriminators: empty-extension graph builds and head-find calls 1→0, nonempty replay unchanged; a valid nonempty applyPairs input contributes one head-find visit. This could explain a +1 only if that callsite actually supplies the residual. Clear’s +1 is NOT attributed: transaction orderDeltas.find, target-transition lookups and other placement searches also exist. No claim of 2N established. Preserve empty-prefix/suffix, aliasing, malformed-input refusal, divergent physical/ordinary frontiers, gap refusal, reverse adjacency and compound membership-order controls. Never remove the intentional second adjacency-resolution pass.

## 3. Optional point completion memo allocation

At lib/entity-signal.ts:1331–1361, completedChanges supports repeated structural completion across rich result views. Point demand has only the final selected.map call and no byPhysical/byStep views. Omitting the memo only for that single-consumption path may remove one empty Map allocation/write while keeping completion and rich identity reuse intact. Prediction: 200 fewer empty Maps, zero direct counted visits. Lower priority; verify distinct descriptors and structural adoption/removal controls before considering implementation.

## Explicit limits

These candidates do not explain away or close the point ceiling. No recommendation to drop physical evidence, ordinary preparation, source history, authored partial-field comparison, or historical proof based on absent subscribers. No new dormancy/bootstrap design. No new tests or measurements performed for this packet; all prospective controls above are unexecuted. C14 scalar safety review is independent and should precede any cost rewrite. Frozen routing/presence inputs remain untouched.
