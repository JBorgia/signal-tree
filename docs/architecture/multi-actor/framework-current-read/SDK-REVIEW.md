# Independent source-current SDK contract review

## Disposition

**Return the legacy-fallback policy for owner resolution. Prefer the distinct optional capability over the option form, but do not approve the exact draft as a full native guarantee or as satisfying “no silent unsupported-adapter fallback.”** The proposed port can express the neutral semantic requirement. Its Angular/Vue realization remains unestablished; the draft correctly makes that a proof gate rather than claiming success.

This is a specification review only. No runtime, API, test, implementation, or repository-document changes were made. No external CLI review was used. No previous reviewer reports/conclusions were consulted. RESULT.md was used for the requested evidence pointers and raw-control descriptions, alongside actual source and logs; its verdict is not the basis of this disposition.

## Reviewed identity and premises

- Exact proposal: `/private/tmp/st-selected-projection-repair/repair-evidence/SDK-PROPOSAL.md`, 107 lines, SHA-256 `347564a0a4d0d5baf4721cbeb30c84c0ba1c05110118331ce4f3ac17cddfb343`.
- Working checkout HEAD: `628d302dadb082a48c58528651c9088234d0a777`, branch `fix/d1-d2-forward-port`; unrelated dirty files preserved.
- Proposal source base: `87f6831fa60cafe87508f0ace84b7638698ca3b0`, retained archive at `/private/tmp/st-selected-projection-repair` (not itself a Git checkout). This is a different source baseline; main-checkout runtime observations are not substituted for it.
- Inspected `REJECTED-source.patch` (SHA-256 `7134d90baf33b478fbcc924774a900334cb934a7bcae3c4613738fa9c0e71c05`), relevant archive sources and exact controls. Confirmed current entity-signal and Angular/Vue control hashes match FINAL-HASHES.json. The archive ObservationAdapter matches its recorded Git base by hash.
- Read review-contract, contributor-contracts, support-policy and independent-review protocol. Relevant ownership premise, verbatim from contributor-contracts at checkout HEAD: “A framework package owns anything that exists because of that framework's API, lifecycle, diagnostics, scheduler, rendering model, identity rules, or quirks. A neutral interface may live in the kernel; its framework implementation must not.”
- Compatibility premise, verbatim from support-policy at checkout HEAD: “The public API is what the package barrels export. `@signal-tree/kernel/adapter` and `@signal-tree/kernel/internals` are versioned the same way, but they are seams for adapter authors and tooling rather than application surface.”

All source paths below are relative to the retained archive unless stated otherwise.

## Finding 1 — Explicitly documented legacy behavior is still a silent runtime fallback

**Proposal lines 56–66 and 103; blocks the requested no-silent-fallback determination.** Line 59 preserves a bare callable for every older custom adapter, including native-carrier adapters; line 62 explicitly excludes a warning or runtime throw. This knowingly leaves such an adapter's advertised native read shape unavailable inside the callback. Line 65 correctly asks for owner acceptance, but no such acceptance is established by this review request.

Concrete counterexample: take the pre-capability Vue-shaped adapter, with all three existing native factories and no new member. `packages/kernel/src/adapter.ts:89–102` still selects the native runtime, as the proposal requires. Ordinary `rows.ids` has its native shape. During a tap, the proposed absent-member path returns the dependency-reading function itself. `rows.ids.value` is undefined; spreading it throws. Similarly a bare callable does not retain Angular's signal node/identification. Neither the optional TypeScript member nor preservation of factory selection prevents this outcome.

Evidence: byte-preserved Vue public control reads `[...rows.ids.value]`; `repair-evidence/vue-first.log` records the corresponding TypeError before its selection oracle executes. This is evidence for the missing-facade failure, not a successfully executed Vue stale-selection assertion. The proposal expressly preserves this historical limitation for legacy custom adapters.

**Cheapest falsifier:** construct a legacy native adapter without the member, obtain the same projection outside and inside a tap, assert native reads and identification, and verify an explicit unsupported outcome before exposing an invalid facade if full support is required. **Status:** historical missing-facade control inspected; the proposed routing does not exist, so this precise proposed-policy test was not run. The contradiction follows directly from the specified bare-function result.

**Owner choice:**

1. Accept explicitly versioned legacy behavior, with the full guarantee limited to capability-adopting adapters. This preserves compatibility but intentionally relaxes the user's no-silent-fallback condition; do not label it full native correctness.
2. Keep the full guarantee/no-silent-fallback requirement and authorize explicit capability enforcement for native adapters. Prefer rejection before a mutation begins over discovering unsupported realization from a tap after mutation. This changes behavior for older adapters and needs an agreed compatibility/version policy.

Recommendation: keep the neutral/kernel/React callable path as complete support, not degraded native fallback. Do not accept the legacy-native row automatically. Runtime capability enforcement is a proposed owner decision, not authorization to implement it here. A warning alone would expose the problem but still would not make the native reader correct.

## Finding 2 — The signature is a viable semantic port, not proof of current carrier feasibility

**Proposal lines 26–30, 87–92; proof limit, not a demonstrated impossibility.** The draft correctly rejects dummy metadata and keeps source freshness separate from notification. Nothing in a callable return type establishes that existing framework carrier contracts can satisfy the complete combination.

- Angular's actual factory uses `computed(compute)` (`packages/angular/src/lib/observation-adapter.ts:40`); the public readonly carrier is `Signal<T>` (`carrier.ts`). A retained cached computed is falsified by `angular-held-first.log`: A remains A after the callback selects C. Replacing a producer per metadata access is falsified by `angular-metadata-first.log`. A stable copied symbol alone addresses neither real tracking nor coherence.
- Vue's carrier is `ComputedRef<T>` (`packages/vue/src/lib/carrier.ts:10–11`), while its readonly-view carrier is separately `Readonly<Ref<T>>`. These types are not interchangeable. Its wrapper routes both callable and `.value` reads to one computed and exposes that computed's `.effect` (`vue-observation.ts:35–47`). Installed Vue 3.5.42 declarations also give ComputedRef a computed brand and an effect object. An ordinary custom/ref wrapper does not establish this contract. The stale-A and changing-effect controls fail in the preserved logs. A type assertion would not discharge them.
- Solid/neutral can naturally express direct accessors. This supports the neutrality of the semantic question; it does not prove Angular/Vue compatibility or framework cleanup.

**Cheapest falsifier for a future implementation:** one retained callback reader, A→C across a nested write, stable metadata before/after, and a real native consumer observing that same reader after publication. Include warmed app-computed execution counts, readonly operations, dependency switching, exceptions and teardown. The proposal's lines 97–105 largely specify this already. **Status:** existing rejection controls and final acceptance log inspected, not rerun; no proposed implementation exists, so no positive capability proof has run. Final preserved acceptance is 18 passed / 2 metadata failures, not acceptance of this new capability.

Recommendation: retain line 92 as a hard proof gate. Do not freeze a shipping SDK shape on the assumption that `customRef` or a copied Angular symbol can implement it. Require a bounded implementation proof only after the owner authorizes it, and stop if it requires carrier weakening or unsupported framework machinery.

## Contract interpretation and public-type burden

The freshness/cache separation is coherent: the callback-acquired direct reader can consult current kernel truth while an already-warmed application computed continues to return X until ordinary publication, then C. Direct reads must not publish to force that computed. The supplied source must itself be current: wrapping unpublished `activeIdSignal()` cannot repair stale source values. Proposal lines 38–50 preserve this distinction correctly.

The kernel selects the semantic boundary; adapters realize shape and tracking. No tap-depth or framework-symbol API belongs in this port. A framework-free fake can implement a direct accessor over a source that takes dependencies, with notifications held separately. This is a constructive semantic sketch, not an executed fake proof.

| Shape/policy | Public and compatibility burden | Determination |
| --- | --- | --- |
| Distinct optional `createCurrentReadonlyCell` | One exported interface member; existing adapter objects remain structurally assignable. Presence is a direct support signal; existing cached factory remains unchanged. | Preferred of the two signatures. Absence policy still requires owner resolution. |
| Optional read-policy argument plus capability flag | Changes existing method signature and adds a negotiation member; invalid flag/factory combinations need validation. | Can express the same contract, but more surface and coupling without a demonstrated benefit here. |
| Optional argument without capability flag | Older one-argument implementations can ignore it and return cached readers. | Unsound support detection; correctly rejected by proposal line 80. |
| Require capability from older native adapters | Old objects may still compile if the member stays optional, yet fail at runtime. | Behavioral compatibility change; optional syntax does not make it automatically minor-safe. |
| Change Vue carrier to readonly Ref | Consumer assignments, computed branding and effect access differ from exported ComputedRef. | Separate public compatibility decision; not a hidden implementation detail. |

Adding a member to the already-exported ObservationAdapter is public SDK expansion even with no new barrel name. Source assignability is narrower than semantic compatibility; verify both. Keep the three-member runtime selection unchanged rather than silently switching an older native adapter to neutral behavior. Adoption needs coordinated package/declaration tests and the declared peer ranges; the retained installation alone does not prove Angular 20/21/22 or all Vue ^3.5 compatibility.

One bounded wording clarification: proposal line 101's “unchanged unrelated-row granularity” should distinguish ordinary selected observation from a callback-acquired reader. Existing `entity-signal.ts:633–635` deliberately reads collection `version()` for fresh readers, and the comment at 628–630 documents that dependency. The current granularity control exercises an ordinary preexisting selected computed. Do not accidentally require new selected-only dependencies for every retained tap reader under the label “unchanged.” This is a scope clarification, not a reproduced regression.

Also specify that line 26's retained-cell obligation includes readers used after their acquisition callback returns, as line 102 proposes testing. Separate getter acquisitions may differ; one acquired reader must not silently change its read policy as callback depth changes. The kernel must supply a source closure satisfying that lifetime, rather than assuming the adapter can repair a source that changes its own policy.

## Run / not-run boundary

Ran read-only source, diff, line-reference and SHA-256 inspections. Inspected exact original public tests, strengthened facade controls, historical stale-reader/missing-facade/metadata logs, and final acceptance output. No runtime tests, typecheck, builds, mutation runs, framework experiments, or external reviews were executed in this review. Historical logs remain historical evidence; proposed acceptance tests are not represented as passed.

Owner-ready decision: **the distinct optional member is the simpler candidate for a bounded proof, but the exact fallback policy does not meet the stated requirement. Resolve that policy explicitly; retain Angular/Vue feasibility and native carrier preservation as unpassed gates. No implementation or release authority follows from this report.**
