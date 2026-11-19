# Independent interpretation: source-linked native metadata and fresh direct reads

## Answer

**A stable native computed over the same `readCurrent`, actually used for dependency tracking, is not automatically dummy or unrelated metadata. A source-current wrapper around it is a plausible source-linked carrier under the already specified ST-fresh/native-cached distinction. The public types inspected do not establish a rule that its native cached value must equal every direct read while publication is held.**

Consequently, reading SDK-PROPOSAL.md line 28 as forbidding every separate cached native computation is stronger than the existing property/type evidence supports. Reading it as excluding unrelated metadata and requiring a real source/dependency relationship remains justified. Stable identity and non-vacuous dependency tests must still pass. This interpretation neither changes owner policy nor approves an implementation.

The stronger positive claim—any same-source wrapper preserves the carrier contract—is also false. I executed two specific hazards below. They concern dependency tracking and cached errors, not the mere presence of a cached native component. They do not prove that every wrapper construction is impossible.

## Source/property evidence

Reviewed retained source `87f6831fa60cafe87508f0ace84b7638698ca3b0` under `/private/tmp/st-selected-projection-repair`; working checkout remains `628d302dadb082a48c58528651c9088234d0a777`. Read `repair-evidence/feasibility/RESULT.md`, its actual runtime/type probes, manifest and compiler diagnostics, the exact SDK proposal, and installed framework implementation/declarations. No external review CLI, web request, production edit or SDK change. This review does not use other reviewers' conclusions.

The feasibility matrix tests eight specific constructions, not the proposed same-source wrapper. Its failed plain getter/ref type checks and failed cached direct reads are valid counterexamples to those constructions only. Its result already states that limitation.

### Angular

`packages/angular/src/lib/carrier.ts` promises `Signal<T>` for readonly carriers. Installed Angular 22.0.7 `types/_chrome_dev_tools_performance-chunk.d.ts:62–76` describes a reactive current-value function and declares:

```ts
type Signal<T> = (() => T) & { [SIGNAL]: unknown };
```

The public predicate checks callable shape and symbol presence (`fesm2022/_pending_tasks-chunk.mjs:3073`). It does not establish the semantic relationship by itself. Actual native computed reads update the producer, register access, and return its cache (`_effect-chunk.mjs:257–273`). That is native computed behavior; `Signal<T>` does not publicly expose a typed node-value equality assertion.

A proxy retaining the native computed as its target retains the same node identity without creating a new producer on each property lookup. If its read actually consults that computed and then current kernel source, it differs materially from borrowing a symbol from an unrelated signal. Neither `isSignal` nor proxy typing proves notification correctness, but native node cache X versus direct current C is not by itself a violation of the inspected public Signal property contract under the ST freshness exception.

### Vue

`packages/vue/src/lib/carrier.ts:10–15` distinguishes `ComputedRef<T>` from `Readonly<Ref<T>>`. This distinction remains binding. Vue 3.5.42 `reactivity.d.ts:346–375` includes readonly `.value`, computed/ref brands and `.effect: ComputedRefImpl`; the effect field is explicitly deprecated with “computed no longer uses effect.” ComputedRefImpl is described as private for Vue-core use and not exported from the main vue package, but it is still reachable through that declared effect property. Do not erase or fabricate it.

Native Vue sets `effect = this` for backward compatibility (`reactivity.cjs.js:1683–1755`). Existing ST already returns a different callable object whose `.effect` is the source computed's effect and whose value/call delegate to the source (`packages/vue/src/lib/vue-observation.ts:35–47`). Thus `carrier.effect === carrier` is already not an ST wrapper invariant; demanding that would impose a new identity rule.

The proposed source-current wrapper would add a **real observable distinction**: while held, `wrapper.value` can be C while `wrapper.effect.value` remains X. I observed that in the local probe. The declarations expose both paths but do not state they must be equal during held publication. Ordinary native computed happens to make them the same object/path; the existing ST-fresh/native-cached distinction is precisely the question here. This discrepancy must be recorded, not dismissed as inaccessible, but it is not sufficient evidence to invent an equality policy. A claim of complete behavioral equivalence to an ordinary cached `computed()` would be too broad.

Actual `unref`, `toValue`, and ref-source `watch` read `.value` (or invoke a getter); they do not obtain current values through `.effect.value` (`reactivity.cjs.js:1567–1572,1841–1843`). This supplies a supported public-consumer route for the wrapper's direct read, not a proof of all consumers. Brands and existing public assignments still require real type validation. My runtime Vue witness used a native-ref proxy; it does not demonstrate the additional callable SDK representation without casts.

## Executed bounded falsifiers

Executed inline Node ESM probes in the retained scratch directory using Node 24.15.0, Angular 22.0.7 and Vue 3.5.42. No files in the author's feasibility directory were modified. The probes use public `signal`/`computed`/`untracked` or `shallowRef`/`computed`; Angular's exported SIGNAL was read only for identity. No node mutation or private framework import.

Shared setup:

```text
raw = X; publication epoch = 0
readCurrent(): track epoch; return raw
native = computed(readCurrent)
wrapper direct read: read native; then read current source
metadata: forward the same native metadata object
```

### 1. Native-only tracking loses a consumer created during the hold

1. Warm native and an existing application computed to X.
2. Hold publication; raw becomes A then C. Direct wrapper reads A/C; existing warmed app still X with unchanged execution count.
3. Create/read a second application computed from the wrapper while raw is C: it caches C.
4. Raw returns to X; advance publication epoch once.

If the wrapper's fresh read is untracked and consumers depend only on the native computed, the native value remains X across publication. Its equality suppression hides the needed change from the newly created app computed: **that app remains C while direct source is X**. Reproduced on both Angular and Vue. For Angular the variant used `untracked(readCurrent)`; the Vue native-only variant read raw after accessing native, introducing no direct epoch dependency.

The otherwise identical **direct-tracked** source-read variant returned X after publication on both frameworks. Both variants retained native identification and stable metadata identity; both preserved the original warmed-X timing during A/C. Thus metadata identity and the original warmed-consumer control alone do not detect this defect. This is a concrete constraint on the connection between wrapper and source, not a rejection of every separate native producer.

Raw results:

| Framework | Fresh source tracking | Direct after publish | New computed after publish | Expected |
| --- | --- | --- | --- | --- |
| Angular | tracked | X | X | X |
| Angular | native-only | X | C | X |
| Vue | tracked | X | X | X |
| Vue | native-only | X | C | X |

All four reported stable metadata and native identification true. Vue's cached `effect.value` during the hold was X, distinct from current direct C.

### 2. Calling a cached native computation first can poison a recovered direct read

Warm the native computed while `readCurrent` throws `bad source`. Catch the error. Change raw to `good` without publishing. Evaluate `native(); return readCurrent()` (Vue equivalent uses native.value).

- Angular: direct `readCurrent()` returns good, but wrapper still throws the cached `bad source` error before reaching it.
- Vue: this specific sequence returned good.

This directly challenges proposal line 31 (“an exception must not poison subsequent reads”) for the simple native-first Angular wrapper. It does not establish that the wrapper author must suppress arbitrary errors, nor authorize a particular repair. Any bounded wrapper proof should retain this control instead of relying only on non-throwing sources.

## Interpretation of the proposed metadata rule

Three statements must remain separate:

1. **Stable identity:** the same retained carrier must not create another native node/effect on property access. Required and unchanged; the rejected per-property realization fails it.
2. **Source linkage and usable observation:** the native producer genuinely computes the same source and participates in dependency delivery; no unrelated brand-bearing object. Same-source wrappers can potentially satisfy this, but the executed native-only counterexample shows why provenance alone is insufficient.
3. **Cache equality at every direct read:** native metadata's cached value must always equal the wrapper's source-current result, even during held publication. This is not established by the inspected public types/property documentation or existing tests. Treating it as an already approved requirement overreads line 28 and would preclude the requested distinction without a separate premise.

The positive feasible interpretation is source-linked representation with distinct read/cache paths, not dummy metadata. Whether a specific implementation preserves every promised behavior depends on its actual dependency/error/read paths and native consumer tests. The existing tests compare stable identity, native identification, current direct values, delayed warmed computations and real notification. None should be waived or replaced by a type assertion.

## Limits and conclusion

Ran the two local falsifiers above; inspected the author's original probe and saved compiler failures. Did not rerun or overwrite its artifacts, implement SDK routing, execute integrated ST controls, or typecheck a new complete callable Vue carrier. Dynamic dependency switching, allocation/object identity, readonly mutation attempts, creation during held publication with real observers, disposal, and supported peer-version coverage remain unestablished for a final wrapper. Those are implementation proof obligations, not evidence of blanket impossibility.

**Owner-ready interpretation:** the proposed strict wording may reject a legitimate same-source construction if “separate cached” is treated as synonymous with “dummy.” No such equivalence follows from the inspected public contracts. Continue the already authorized bounded same-source feasibility proof without redefining policy or weakening identity tests. Apply the concrete native-only/ABA and Angular cached-error counterexamples to the actual construction. No full carrier acceptance is established by this review.
