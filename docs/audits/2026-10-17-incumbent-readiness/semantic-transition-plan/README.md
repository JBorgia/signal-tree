# Shared prepared transition migration — authorization proposal

October20,2026. Plan source64a7287d2164741714c704f13a416b9962d907cd.
**Planning only. Runtime migration is not authorized by this document.**
Production87f6831f, B closure, conservative Link default, existing budgets and
rejected checkpoints remain unchanged. Unrelated working-tree changes are excluded.

## Decision requested

Authorize an isolated internal migration that carries separately named physical
and ordinary transition facts from affected entity preparation into existing
capture, inspection and publication consumers. Scope is slices0–5 below, gated
by their acceptance checks. No public API/semantic changes, default activation,
merge, push, release, tag, publication, budget increases or B work are included.
An unexpected public-contract conflict or required broader mechanism stops the
dependent slice; independent authorized verification can continue.

The owner's direction is explicit: “Authorize this specific migration before
runtime changes.” The concrete scope here is offered for that authorization,
not inferred from the retained independent-progress requirement.

## Internal contract and non-goals

The existing native state and incumbent settlement authority remain authoritative.
A transient prepared result does not become a second state store or history log.
Exact internal syntax remains an implementation choice within these invariants:

- Identity: tree/collection position, non-reused subject lifetime, storage keys
  before/after where relevant; payload ID is not storage-key identity.
- `physicalBefore` / `physicalAfter`: actual displayed row/member presence, used
  for native invalidation, value equality, and established callback arguments.
- `ordinaryBefore` / `ordinaryAfter`: facts that participate in ordinary truth;
  own-property presence is separate from present undefined. Never overload the
  physical pair or infer membership ownership from seeing a row.
- Explicit authored field footprint, replacement/derive intent, participation,
  native origin, transaction attribution and restoration designation. Updaters
  continue to read displayed state. Partial writes do not adopt inspected siblings.
- Explicit membership/key/order facts, using current lifetime/placement/frontier
  rules. Pure reorder needs no invented row-value transition. Selection remains
  its existing scalar location; maintenance is not an authored user write.
- Prepared-against revision, existing responsibility plan and operation ordering.
  Failure-prone reflection, cloning, interception and equality precede installation.
  A rejected outer preparation installs none of its own state; legitimate reentrant
  writes keep their established ownership and may remain or be compensated by
  their enclosing transaction. “Untouched” never means erasing independent work.
  Installation records responsibility before delivery; later reentry never loses
  authored intent. A mutable final frontier token, where existing installation
  must mint it, is finalized once before consumers—not another mutable authority.
- All participating state and native projections are installed coherently before
  callback/durable delivery. First failures, failed-abort recovery and retry rules
  remain. No user callback/getter is moved across its established boundary casually.

Use the single existing notify protocol; no parallel notifyPrepared/event bus.
Shared preparation may provide consumer-specific evidence through that protocol,
but native value subscribers must not receive synthetic value changes merely to
record adoption. Existing explicit collection-order capture remains; it is not a
new competing protocol. Do not route point work through full collection targets.

Divergence retention is owned by the native entity value substrate, keyed by
collection instance and non-reused subject lifetime. The frozen experimental
`EntityValueStore.inspectionBaselines` / `ordinaryForSubject` mechanism is a
prerequisite to audit, not accepted production code. Retain only the ordinary
facts required while display differs or a live restoration obligation requires
them. Adoption updates/discharges the appropriate footprint; realized acquisition
must discharge or replace the same obligation. Removal must preserve live recovery
facts until eligible retirement; retirement/destruction releases storage. Same-key
new lifetimes must never inherit old baselines. Specify and test these transitions
before implementation; counters alone do not establish payload collectibility.
This is bounded divergence storage, not a permanent second canonical tree.

## Matrix legend and regression keys

The [source inventory](../semantic-transition-feasibility/WRITERS.md) supplies exact
anchors. Paths below are relative to `packages/kernel/src/`. `P` means physical
pair, `O` ordinary pair, `M` membership/key facts, `Q` ordering facts, `A/I/R` authored,
inspection or realized participation. These names are views of one prepared
operation, not interchangeable values. Consumers: C capture/settlement, H inspection
chronology, N native projections/value callbacks, L ordinary Link projection,
T consumer taps. Tables explicitly say when a field is absent or unchanged.

Regression keys name existing unchanged tests/archived falsifiers, not unexecuted
coverage claims:

| Key | Existing evidence to retain unchanged |
| --- | --- |
| E1 | `lib/entity-update-one-equivalence.spec.ts`: fast/frame equivalence, identity, no-op, realized classification, undo/rollback |
| E2 | `lib/entity-set-all-staging.spec.ts`: mixed remove/update/add, duplicate keys, transformed/blocking interceptors, rekey/reentry controls |
| E3 | `lib/entity-inspection-egress.spec.ts`: H1/H2, A1/A2, C2/C3/C6; inspect-only no send, minimal necessary adoption, no neighbor promotion |
| E4 | `lib/entity-active-prepend-changeid.spec.ts`, `lib/entity-selection-lifetime.spec.ts`, `lib/entity-order-carrier.spec.ts` |
| E5 | `lib/entity-lifetime-ledger-null.spec.ts`: held row/field detachment, same-key new lifetime, reclaim/restore |
| E6 | `lib/entity-replay-tap-boundaries.spec.ts`, `lib/entity-replay-taps.spec.ts`: partial/full replay arguments, installed state before reentrant taps |
| E7 | `lib/entity-restoration-authority.spec.ts`, `lib/entity-membership-link-restoration.spec.ts`, `lib/entity-restore-diff.spec.ts`; `enhancers/restoration/jump-undo-equivalence.spec.ts` |
| E8 | `lib/whole-value-membership.spec.ts`: hidden member, absence versus undefined, supplied reintroduction and held identity |
| E9 | `enhancers/transactions/rollback-refusal-scope.spec.ts`, `enhancers/transactions/rollback-refusal-legibility.spec.ts`, `enhancers/transactions/settlement-inspection-terminality.spec.ts`, `enhancers/transactions/recovery-handle-0.spec.ts` |
| E10 | `lib/entity-large-batches-v16-controls.spec.ts`, `lib/entity-large-batches.spec.ts`; retain original work-count assertions |
| A1 | Frozen bounded-repair archive: `combined/focused-final/adoption-review/witness.ts` setAll inspection failure; original assertion unchanged |
| A2 | Same archive: `adoption/witness.ts`, `combined/adoption-root/witness.ts`, `adoption/extra-first.ts`; adoption, sibling inspection, preparation throw, reentry; original oracle mismatches remain separately recorded |
| A3 | Same archive: `combined/focused-final/{entities,aggregate,restoration,composition,root-controls,projection-controls,nested-same-channel}/witness.ts` |
| A4 | Same archive: original declarations, scalar/frame/root/overlap controls, source guard, lifecycle/destruction; old vacuous retention verdict excluded, current counter control retained |

A1–A4 are members of [the frozen archive](../link-bounded-repairs/evidence.tar.gz),
not files in this checkout. Slice0 must enumerate every exact member path and hash
from its [manifest](../link-bounded-repairs/MANIFEST.sha256) before promotion; A4
is a coverage group, not an executable test name.

Archive identities and original results: [bounded repairs](../link-bounded-repairs/README.md).
Historical three no-adoption expectation differences and32/34 delivery accounting
remain preserved; they are not silently rewritten to claim a clean run.

## Six installation paths: producer/consumer matrix

| Path | P before/after | O before/after | M / Q | Participation | Capture, inspection and publication mapping | Existing checks; explicit gap |
| --- | --- | --- | --- | --- | --- | --- |
| S1 direct existing row | Displayed row -> transformed partial result | Prior ordinary row -> only authored fields merged | Physical M unchanged; ordinary necessary existence follows E3; Q none | A adopts footprint; I moves P only; R realizes approved facts | C/H use O authored footprint; N/T use physical semantics; L uses ordinary projected fields | E1,E3,A2,A3; add new shared-evidence failure/reentry mapping checks |
| S2 multi-instruction frame | Staged display values/lifetimes -> complete installed frame | Prior ordinary facts -> authored value/structure result | Explicit create/tombstone/rekey/restore records; Q carried separately as needed | A/I/R frozen per instruction/operation, never guessed after callbacks | C before install; H consumes same authored facts; N/L/T select their defined view after complete installation | E2–E6,E10,A1; multi-row semantic/physical divergence currently fails |
| S3 point realization | Active lifetime physical row -> cloned target | Existing ordinary fact -> realized target within footprint | M/key validated unchanged; Q none | R, not a new transaction contribution | Existing install/invalidate/publish phases retained; C obligations settled, H preserves existing realized chronology filtering, N/L/T coherent target | E1,E6,E7,E9,A3; verify no inherited authored ownership |
| S4 complete target | Current physical subjects -> prepared complete target | Participating ordinary facts -> defined realized target, excluding unauthorized inspection hitchhikes | Explicit full membership/key/order/selection target | R; existing source authority grants required | Install all targets; invalidate/projections/order then publish/taps; H and L see same realized transition | E6,E7,E9; full-target inspection divergence mapping needs additional regression |
| S5 structural replay plans | Current active/dormant facts -> validated restored/removed/rekeyed lifetime | Existing ordinary structural facts -> authorized realized disposition | Existing successor/predecessor/frontier policy; destination validation | R; never authors incidental neighbors | Keep plan/commit/publish composition; C preserves authority on refusal, H preserves current replay filtering/classification, N/L/T after complete unit | E4–E7,E9,A3; multi-plan adoption+refusal/reentry composition gap |
| S6 direct order, selection, maintenance | Order/selection actual before/after; retirement has no new value | Ordinary order/selection disposition from existing rules; retirement has no authored O | Explicit order/frontier; selection scalar; retire inactive identity only | A/I/R as existing operation; cleanup not authored | Existing order/scalar channels remain; no fabricated row deltas; C/H/L only applicable facts, N/T existing timing | E4,E5,E7,E10; prove unchanged routes do not bypass new value evidence |

S3’s existing-lifetime realization/discharge handoff is a slice1 dependency. The
remaining S3–S6 work consists of audit-and-disposition paths, not preapproval to redesign them. Keep an
existing path unchanged if its evidence already meets the contract, with executable
coverage. If changing it would resolve an unsettled product question, stop that part.

## Eleven writer families: mapping and unchanged acceptance

| Family / paths | P | O | M / Q | Participation and consumers | Regression / additional required coverage |
| --- | --- | --- | --- | --- | --- |
| W1 field/updateOne S1 | Displayed row -> transformed patch | Merge only authored keys onto ordinary row | Physical M unchanged; ordinary necessary existence follows E3 / none | A/I/R; C,H semantic; N,T physical; L ordinary field | E1,E3,A2,A3; same-value adoption and untouched inspected sibling |
| W2 whole row/updater S2 | Displayed row -> supplied/derived row | Whole-row authorship or established derive footprint, never infer new intent | Same lifetime/key / none | A/I/R; updater sees P; C,H,L approved O, N,T physical | E1,E3,A2; full/derive distinction and throw/reentry |
| W3 updateMany/predicate S2 | Per-target display -> staged partial results | Per-target explicit authored patches | Unchanged / none | All targets installed before first delivery; keep authored operation order | E2,E10,E9; new multi-row inspected-sibling and mid-preparation failure checks |
| W4 add/prepend one/many S2,S6 | Absent/fresh or existing according to actual operation -> row | Explicit authored existence/value, preserve minimal-inspection rules | Fresh lifetime/occupied-destination policy; completed append/prepend Q | A/I/R; C structural before delivery; H/N/L/T final installed unit | E2–E5,E9; nested prepend/append/remove/rekey and throwing callback |
| W5 rekey S2,S5,S6 | Same lifetime value; old/new storage keys | Key authorship only; no implicit field/order adoption | Explicit key occupancy; existing selection and Q behavior | A/I/R; preserve payload-ID/key distinction for all consumers | E4,E5,E9; rekey while fields inspected and later independent writes |
| W6 remove one/many/where/clear S2 | Active rows -> absent/dormant | Authored/realized removal, no value promotion of inspection-created row | Explicit lifetimes/neighbors/frontier; selection as existing | A/I/R; C retains live recovery claims; H/L correct removal; N/T installed absence | E2–E7,E9,E10; compound refusal/retry and partial-preparation failure |
| W7 upsert one/many S1,S2 | Per-item update or new row | Separate partial update versus authored new existence/value | Per-item structural facts; Q only actual add/order intent | A/I/R; no blanket whole-row promotion for update branch | E2,E3,E10; mixed inspected updates/adds plus duplicate-key and reentry controls |
| W8 setAll / reorder S2,S6 | Staged complete display input/order | Existing replacements + explicit adds/removes; don't infer pure order from row snapshots | Exact input order and explicit M; pure order no row value delta | A/I/R; C/H same semantic fields, N physical, L ordinary, T complete unit | A1 unchanged decisive failure; E2–E4,E9,E10,A3; no equal-display chronology loss |
| W9 hidden collection reintroduction S2 + branch-member seam | Public absence despite retained storage -> supplied live rows | Authored path/membership only; retained hidden values not resurrection input | Parent-member existence plus row lifetime/order facts | Existing absence-aware contract; C includes member responsibility, H/L truthful visibility; N/T identity preserved | E8,E3,A3; new hidden collection+pending transaction preparation-failure/reentry mapping |
| W10 realized restoration/replay S3,S4,S5 | Physical current -> validated point/structure/target | Authorized realized ordinary disposition | Exact restore lifetime and placement; no retargeting | R; existing settlement only, no new authored contribution; all consumers agree final disposition | E5–E9,A3; compound mixed adoption/inspection/restore refused then retry |
| W11 retirement S2/S6 low-level store | Inactive backing/cache -> reclaimed when eligible | No authored O transition | Non-reused identity; live obligations protected | Maintenance; do not mint C/H/L contributions or synthetic N/T events | E5,E7,A4 current cleanup controls; pending restore and retained-reference cases |

Equality alone cannot classify setAll as pure order. Pair a genuine explicit
order-only replay with same-display whole-row setAll adoption: existing intent and
authored footprint decide which fields are adopted, not matching row snapshots.

W4/W6 (and mixed W7/W8) inspection-created/removed-lifetime transaction
compensation remains conditional on a governing existing rule. Egress minimality
alone is not that rule. Characterize it separately and stop that dependent case if
existing decisions do not determine the result; do not use this matrix to select
new semantics.

Selection delegates to existing scalar machinery within S6; initialization is an
explicit compatibility control (empty/populated construction, no synthetic events),
not an unlisted twelfth migration. All rows are planned coverage, not current green
qualification. Existing tests verify their named contracts, not every newly required
cross-product; gaps above must receive new prewritten tests before implementation.

## Consumer matrix

| Consumer | Facts selected from shared result | Must not do | Unchanged control |
| --- | --- | --- | --- |
| Paired responsibility / incumbent settlement | O authored footprint + explicit structure/identity/participation; prepared revision | Capture incidental topology, install unowned state, treat R as new owner | E9,A2 and prior capture/recovery falsifiers |
| Pending inspection chronology | Same authored footprint, identity and operation order; preserve existing filtering of realized/inspection/restoration work | Reconstruct adoption solely from display equality; suppress unavailable error | A1,E9,`enhancers/transactions/proposal-inspection-safety.spec.ts` |
| Native invalidation/framework values | P change, membership/order/projection revision and existing scheduling | Force value emissions to wake responsibility; promise fresh native computed inside groups | E1,E2,A4 and preserved four-framework controls |
| Link ordinary projection | Ordinary participating field/membership/order evidence and immutable responsibility revision | Read whichever display inspection exposes; infer permission from membership observation | E3,A3,A4 |
| Consumer taps/interceptors | Existing P-based inputs/results and completed-install timing | Move callbacks earlier, replace arguments with O, let delayed outer work overwrite reentry | E2,E6,A3 |
| Restoration/history | Existing source-authorized realized transition, structural/frontier evidence | Reset history manually, weaken ST1034 or gain retroactive lifetime rights | E7,E9, preserved compound restoration controls |

## Ordered slices and gates

Each slice freezes a source identity and separate diff before review; no slice may
borrow an unimplemented later slice and call itself complete. Use isolated candidate
worktree/disposable overlays until qualification; retain all first failures. No
blanket catch/delete compensation, refusal-only 'success', or assertion weakening.

| Slice | Change boundary | Useful success | Fault / reentry / refusal gate |
| --- | --- | --- | --- |
| 0 coverage and fixtures | Promote unchanged archived falsifiers into runnable focused Nx tests; add matrix gap tests with expected facts fixed first; internal record type/design reviewed | A1 reproduces exact failure against frozen rejected overlayba21c351; incumbent is a separate control (no approved adoption), existing positives run | Preserve original failures; verify test instrumentation itself; no runtime behavior change |
| 1 value preparation + consumers | S1/S2 ordinarily-existing lifetime value result, ordinary/physical separation, existing notifier/H consumer and minimal S3 realization/discharge handoff in one cohesive diff; W1/W2/W3, update-only W7 and unchanged-topology W8 | Point, replacement, batch/update-only upsert/unchanged-topology setAll adoption inspect+rollback+ordinary publication agree; genuine no-op suppressed | Throwing preparation/equality/getters install no outer-attempt state; legitimate reentrant effects retain existing ownership; nested writes retain ownership; newer conflicting work refuses atomically, resolves for useful retry |
| 2 structure/order + compound writers | W4–W8 structural branches; complete operation combines current structure/order facts with value result, retaining existing policies | Mixed add/remove/rekey/reorder, selection and callback snapshots coherent | Occupied destination/missing permitted placement refusal preserves state+authority; callback C→X→C/nested writes/throws survive; no delayed outer order |
| 3 realization/hidden/retirement disposition | Audit S3–S6 and W9–W11; modify only proven incompatible handoffs | Compound rollback, undo/redo, hidden-member reintroduction, same-lifetime restoration and old-reference isolation | Multi-target preparation failure no partial outer install (reentrant effects classified separately); refused settlement retains inspectable recovery; later retry works; live obligations not reclaimed |
| 4 combined focused qualification | All paths/families and existing declared-Link repairs together; native + Angular/React/Vue/Solid and existing-adapter compatibility/type controls | Useful declared sends, ordinary observer coherence, receipts/errors; unchanged A1–A4 and all matrix tests | Cross-path reentry, ABA, multiowners, in-flight corrective delivery, destruction/disposal, capture failure and repeated settlement; independent review challenges omitted routes |
| 5 frozen full verification and costs | Exact-SHA candidate after slice4 survives; enumerate applicable gates from current verify-gates registry, do not treat the gate listing as executed verification | Full kernel/framework Nx suites, semantic-scope matrix, Link/restoration/inspection/recovery/destruction, types/spec-types/lint/docs, installed artifacts, fresh demo/packages | Every changed verdict reconciled; no fallback authority, no ceilings changed; budget/type/runtime failures remain blockers |

Prerequisites are explicit: start from production87f6831f, with the reviewed
experimental scalar/projection/lifecycle components selected by frozen manifest
from the bounded-repair archive. Preserve their exact source identities in the
candidate manifest before edits. The rejected combined overlay is a falsifier
control, never silently accepted wholesale; its entity adoption layer is the
replacement target. No inherited helper may escape the diff or qualification.

Slice1 preserves E3 minimal egress behavior for inspection-created subjects, but
does not claim new transaction compensation semantics for them. Its rollback gate
includes S3 ordinary-baseline discharge now, not after slice3. Mixed upsert/setAll
invocations remain compatibility controls until slice2. If new value evidence
cannot coexist coherently with an old structural branch, keep the entire operation
experimental until its structural migration is complete; no partially coherent
public method is accepted or activated. All slices remain isolated experiments
until combined qualification.

A plan-conflict refusal is only the required control when existing semantics require
it. Independent/allowed operations must still succeed. Preparation faults mean
controlled supported throw boundaries, not universal process-OOM recovery. Failed
abort must expose existing SignalTreeRollbackError recovery contract. Comparisons
separate deliberate baseline expected failures, unsupported observations and genuine
candidate defects; no silent reclassification.

## Measurement and acceptance after correctness gates

Use the current [measurement contract](../../../performance/measurement-contract.md).
Before decision measurements freeze workload sizes, sample counts, distributions,
noise/uncertainty interpretation, decision acceptance criteria and exact artifact
hashes. Keep current artifact ceilings and work-count constraints as hard gates;
preregister material CPU/heap regression thresholds and equivalence/inconclusive
rules before samples, with owner approval where a new tradeoff policy is needed; no favorable resampling.
Use exact incumbent8d220643e0d4e34cbdbc6e55e6ef692b25d5e023 and the immediate
production87f6831fa60cafe87508f0ace84b7638698ca3b0 as separate attributable controls
where relevant. Do not compare successful adoption with incumbent no-op as equivalent
work; report capability-only cases separately.

Measure bare and populated builds, fixed/per-tree heap, increasing populated size,
pending responsibility, successful/refused/recovered settlement, construction/churn,
post-capture-drain cleanup and four-framework stabilization where claimed. Point
work must not acquire whole-collection traversal. Report absolute bytes/times,
distributions and uncertainty, improvements and regressions. Current bundle ceilings
still gate; new costs need explicit tradeoff acceptance, not inherited prior approval.
Entity collectibility remains an independent unresolved track; counters or scalar
GC cannot close it. No production acceptance while applicable lifecycle evidence
remains missing. Migration authorization is not budget or performance acceptance.

## Stop boundaries and authorization limits

Stop the affected work and present the minimal counterexample and options if:
- Ordinary/physical separation cannot preserve a public callback, inspection,
  membership, ordering, error or framework timing contract.
- Inspection-created/removed lifetime compensation needs a rule not established
  by existing decisions. Minimal egress adoption does not decide rollback ownership.
- A second canonical store, new settlement engine, global replay log, parallel
  notification protocol, new public API or policy is required.
- A supposedly shared correction reproduces the same missing-facts mechanism in
  another mapped writer; do not continue with another caller exception.
- Complete coverage requires writers or capabilities outside the named inventory,
  or meaningful verification cannot be completed within available resources.

Keep B closed and retain the safe default. The product alternative—defer declared
progress and keep conservative Link—is not authorized by this plan. Authorization
would permit only the internal migration, its regressions and gated verification;
final acceptance remains a separate evidence-backed disposition.

## Independent review disposition

[Contract review](CONTRACT-REVIEW.md) and [writer review](WRITER-REVIEW.md) are
planning reviews, not runtime qualification. Both used source/test evidence;
neither ran new behavioral tests. Required corrections are incorporated:

- Preserve realized chronology filtering and legitimate reentrant effects.
- Reproduce A1 on its rejected overlay, with incumbent capability separately labeled.
- Keep unresolved inspection-created lifetime compensation conditional.
- Require preregistered decision criteria and tradeoff authority.
- Separate physical membership from ordinary necessary-existence adoption.
- Include point-realization baseline discharge in slice1 and name prerequisites.
- Gate mixed writer operations atomically; equality does not imply pure order.
- Name divergence retention ownership, identity and release obligations.
- Expand test paths and require exact archived member provenance on promotion.

Root verification checked the cited test families, the frozen adoption patch's
subject-keyed baseline methods and release hooks, and archive member layout.
This establishes the plan corrections; it does not establish implementation
feasibility or complete lifecycle coverage. Runtime source remains unchanged.
