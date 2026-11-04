# FAST-POINT-DUAL-MAP-0 — independent premise review

Disposition: the dual-Map identity/COW premise is conditionally viable, but escape marking alone is insufficient. Copy-on-write must be rechecked at terminal installation, including marks acquired after point preparation returned. No implementation or cost acceptance follows.

Read-only source review. No tests/builds/heavy jobs were executed, no repository files changed. Only this requested review artifact is written.

## Frozen premises and source identity

Verbatim from eef7dfc0b `docs/audits/2026-11-03-integrated-point-runtime/DESIGN.md`:

> Unknown attribution remains unknown; write ownership is not proof of input independence.

> Destination settlement ownership, known input dependencies, fixed possible-owner holds, shared validation and recipient uncertainty remain separate roles even when owner identities coincide.

- `f165d28` resolves to `f165d28e55dce241ff6466a58c9b850f1bbc20f3`; `experimental-publication/entity.ts` SHA256 `bd81eb814b4a2fbca148bcce281acfbad09fd8db4e82a98609202f42ffc39240`.
- `eef7dfc0b` resolves to `eef7dfc0b95c16658b825d7b1466c95b1cf43c20`; `experimental-publication/entity.ts` SHA256 `6ec2b3732967dfb3ba0b720292597e288578cc26b1c67304a45f6c528a167714`.


The hypothesis restores f165's separate ordinary endpoint and physical View row Maps, retaining eef's non-entity point pipeline. This review concerns freshness/escape/retirement. It does not select architecture, certify prototype code, reopen historical B, or change native roles.

## What is supported by source

At f165, `prepareRetirement` snapshots both row Map identities plus member, placement, visible, placement-view and mapping identities. `current()` compares all eight identities (`entity.ts:239–299`). Generic preparation creates a replacement row Map for each touched side. Thus a same-value support installation invalidates the prior plan even though the physical View cell may intentionally retain its identity and change its `requirement`.

At eef, in-place point updates replace the ordinary endpoint, retain/mutate an equal-value physical View and change `RowFacts.revision` (`entity.ts:162–239`). `prepareRetirement` adds that revision check (`369–418`) because row identity alone would otherwise remain stable. The source-level revision/recipient checks in `internals/entity-publication.ts:267–320` remain separate; removing the per-row token must not remove these checks.

A retained retirement plan can force Map replacement instead: mark both captured row Maps escaped, then ensure the next point installation copies each marked Map before changing its entries. Existing identity comparisons become sufficient for touched-row freshness, while other subjects retain their current plan. Structural deletion/reappearance and generic one-side writes already replace/delete the corresponding identity. Empty/missing sides must preserve f165's separate row-existence semantics.

There is no demonstrated need for a persistent RowFacts wrapper or a new row revision token if this COW discipline is enforced at every mutation frontier. That is a representation inference, not an executable result.

## Concrete preparation/installation ordering trap

The existing eef test at `integrated-field-facts.spec.ts:54` obtains the retirement plan BEFORE preparing the next equal-value point. Add the opposite order:

```ts
seed(1);
const unit = prepare(1, {x:0,y:0}, {x:0,y:0});
const plan = native(source).prepareRetirement!(1);
expect(plan.current()).toBe(true);
finish(source, unit);
expect(plan.current()).toBe(false);
```

This is an unexecuted, source-grounded falsifier using the existing fixture. If target Maps were chosen while unescaped during `preparePoint`, marking them only when `prepareRetirement` later captures them does not stop the already-prepared terminal write from mutating those Maps in place. `current()` would incorrectly remain true. Eef's per-row revision detects this sequence. The proposed replacement must recheck escaped status inside installation, or otherwise isolate every prepared target before escape. A finalization-time check alone is weaker than the terminal frontier unless no later capture can occur.

Mark retirement Maps before iterating requirements/evaluating readiness, not after potentially callback-capable proof access. A Map may also escape from a getter trap while point preparation runs; recheck marks after all payload/trap reads. Both checks are needed for distinct orderings.

## Mutable View cells are deliberate

COW means shallow row-container copying, not immutable View snapshots. `integrated-field-facts.spec.ts:71–98` asserts:

- a saved per-edit ordinary/physical requirement stays at the earlier installation;
- a captured source physical View retains identity for an equal-value reauthoring and its requirement advances;
- a changed physical value replaces that live View.

Preserve the exact earlier per-edit physical override (`eef entity.ts:205–215`, `f165:200–208`). Merely copying the physical row Map leaves the edited-key View shared; per-edit evidence needs a detached `{requirement,present}` cell there. Deep-copying every View instead breaks the intentionally live `captureViews` identity contract. Retirement freshness therefore uses row Map identity, not freezing the mutable cell or treating equal value as no semantic write.

## Physical-only and callback constraints

`integrated-field-facts.spec.ts:147–171` preserves staged physical facts while ordinary support remains a live source fallback. The restored dual-Map implementation naturally supports that distinction: a physical-only preparation captures `nextViews`, whereas its ordinary lookup continues through current `fields`. Do not freeze/capture an untouched ordinary row merely because the physical row escaped. Marking an actually captured Map is separate from deciding which lookup is a snapshot.

A preparing WeakSet must protect both base Maps before payload traps and release only its own registration in `finally`. Reentrant point installation must copy a protected side; generic f165 preparation already creates replacement Maps. Preserve callback read order and source reentry refusal (`integrated-field-facts.spec.ts:101–144`). An escaped/refused completion may still retain readers even when its installation is rejected. `expose(completion)` must therefore seal and mark captured row containers BEFORE a recipient callback receives the native completion, including a recipient enrolled during preparation and one that never immediately reads `facts` or `support`.

Generic completions also need escape registration for the prepared row Maps retained by their selected evidence/support. Untouched fallback rows remain dynamic. Per-edit duplicate/repeated-subject snapshots retain first-physical/unit-local pairing and separate ordinary endpoint sequences; Map restoration is not authority to remove those snapshots.

## Required focused checks, not executed here

1. Existing exact-row retirement invalidation, plus plan-created-after-point-prepare witness above; unrelated subject must keep `current()==true`.
2. Retirement captured from a payload getter; install must replace marked Maps and stale outer preparation must refuse after inner installation.
3. Existing unread-completion/unsubscribe saved-reader witness, equal-value live View identity and later changed-value replacement.
4. Physical-only staged facts with later ordinary point update: staged physical remains fixed, ordinary facts/support remain current.
5. Ordinary-only and physical-only row populations, empty maps, independent insertion order, retained per-edit first-physical pairing and repeated subjects.
6. Existing owner settlement/disappearance, fixed-window retirement, source retirement revision and error-precedence tests unchanged.

## Limits

The proposed mechanism is not yet executed or inspected as a concrete patch. Complete escape coverage is still an implementation obligation. Source-level revision validation and recipient enrollment checks remain required even if row-token freshness is replaced. Existing tests establish meaningful oracles but do not make all mutation/escape paths exhaustively proved. No CPU, heap, allocation or numerical gate improvement is claimed by this premise review.

## Follow-up: terminal-install constraint and retirement-only WeakMap carrier

The parent identified a further relevant frozen implementation constraint: terminal installation executes precomputed internal writes; it must not add row Map cloning/iteration that can fail after earlier native records have installed. The late-capture falsifier above therefore does not by itself authorize cloning in `pointWrite.set`. Its narrower purpose is to show that prepare-time-only COW cannot replace the old retirement revision check.

A participant-owned `WeakMap<Map, object>` populated only when retirement captures a row Map can cover that late-capture case without a persistent RowFacts wrapper:

1. `prepareRetirement` obtains or initializes one token per captured endpoint/View Map, before deriving requirements. A second plan over the unchanged Map reuses its existing token; merely observing/capturing a plan must not invalidate prior plans.
2. The plan stores both Map identity and its captured token. `current()` retains all f165 member/placement/visible/mapping identity checks and additionally compares the token for each still-current captured Map.
3. Point preparation preallocates a fresh object-identity token, including when no retirement carrier exists yet. That handles a carrier initialized after the point was prepared.
4. Terminal installation performs only precomputed field writes and, for an in-place-mutated Map that already has a carrier, replaces its carrier value with that preallocated token. It creates no Map clone, traverses no row, and does not allocate the token there.
5. COW already decided during preparation can still replace an escaped Map; its identity alone invalidates the old plan. Generic f165 row replacement/deletion likewise needs no new per-row wrapper. Token updates may be conservatively applied to each mutated old Map, but untouched subjects must remain current.

Object identity is preferable to a numeric increment for this purpose. A wrapped/reused numeric stamp admits ABA while an arbitrarily retained plan still exists; JS number precision also imposes a bound unless separately handled. A fresh preparation-time object has neither issue. This is conditional sparse freshness metadata, not evidence that all previously unwanted token allocation has disappeared.

The carrier fixes retirement freshness only. It does not freeze escaped evidence snapshots. Retain the existing source exposure protocol: a native-only completion remains opaque; any completion issued to a recipient is sealed before its callback; sealing a point's own lazy evidence may allocate/clone during the escape boundary, before terminal installation. Prepared generic evidence retains its touched row Maps, while untouched fallback lookups stay dynamic. If another supported path can make a point's mutable target Map genuinely escape after target choice without going through such sealing, that requires separate admission/validation or earlier isolation. A retirement carrier cannot repair snapshot aliasing.

The mutable physical View rule remains unchanged: equal-value point installation may update an existing View's requirement, but must invalidate a captured retirement assessment through the conditional carrier even when the View and Map identities stay stable. A per-edit physical reader still requires its detached edited-key View; live `captureViews` cells must not be deep-cloned.

Weak keys do not establish lifetime-only-to-the-plan storage: once a currently retained row Map has a carrier, the entry may remain while that Map is reachable even if the particular plan is dropped. Thus call this "only maps ever captured for retirement receive carriers," not "metadata exists only while plans are live." Whole-process heap effects require measurement.

Disposition after this clarification: conditionally viable bounded mechanism; the retirement-plan-after-point-prepare control remains mandatory, now expected to be satisfied by token mismatch rather than terminal COW. No concrete implementation patch was reviewed or executed here, and no heap/cost benefit is established.

## Supported escape connection audit

No supported delayed immutable-row escape was demonstrated in the inspected eef Source routing. `EntityPublicationSource.prepare` calls `native.expose(nativeUnit.completion)` before every recipient callback. The native-only Source unit returns an opaque WeakMap-backed completion instead of the native completion/parts graph; this remains true when the native participant consumed the responsibility-preparer record. The source-owned point-group wrapper dispatches through the same Source completion boundary.

`Source.captureInput` exposes captured requirements; `Source.captureViews` exposes intentionally live View cells; `Source.evidence` is a current lookup. None is an issued immutable row-container snapshot whose later exposure requires blanket protection of every generic seed Map. Responsibility field selections expose endpoint/requirement values and source/proposal lookups, not the row Map itself. A point completion's own supported exposure calls its seal function, which can isolate its selected targets during that escape boundary.

Therefore the earlier late-escape paragraph is an admission limit for any future routing change, not a demonstrated current blocker. Do not blanket-mark generic seed row Maps or clone during terminal installation merely to cover direct manual native.prepare/expose calls bypassing the Source authority. The experiment may rely on the existing supported routing discipline if kept unchanged and tested. The retained-Source-unit plus retirement-plan-after-prepare witness is separate: it exercises the explicit retirement freshness contract and is handled by the conditional token carrier.
