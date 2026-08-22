# Frozen phase model — blast radius, classified

**Status:** decision input. No implementation started.

Adopting enhancer-aware planning and freezing configuration are **one change**:
`signalTree()`'s `.with()` calls `finalize()` _before_ applying the enhancer,
because enhancers expect markers (`entityMap()`, `form()`) to exist when they
run. So markers materialize immediately before the first enhancer and the plan
can never see one. Deferring application is the only way out, and deferring
application is what makes late `.with()` illegal.

## Measured blast radius

```text
11 failing tests, 6 spec files, 18 post-materialization .with() call sites
```

## The decision test

> Does any failing test encode a runtime behaviour that genuinely requires
> enhancing an already-used tree?

**No.** All eleven are protocol artifacts or guarantees whose _demonstration_ —
not substance — depends on late `.with()`. One carries a real semantic change
that must be deliberately preserved; see the last row.

| failing tests                                                                                                  | class                                                                                                                                                                     | disposition                                    |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `batching.behavior` setter wrapping ×2, `walker-conformance` ×1                                                | protocol artifact — the test writes or reads first, then enhances. Under the phase model it enhances first.                                                               | rewrite                                        |
| `enhancer-method-forwarding` "keeps `$` identity, so leaf refs held across the enhancer still work" ×3         | real guarantee (enhancers do not rebuild the state graph), but the scenario becomes **unconstructible** rather than violated: no user reference can exist before finalize | rewrite to assert `$` identity across finalize |
| "a THROWING enhancer publishes neither its name nor its capabilities" ×2                                       | real guarantee; only the _timing_ moves — the throw surfaces at finalize instead of at the offending `.with()`                                                            | rewrite to assert at finalize                  |
| `entity-restoration-authority` ×2                                                                              | ours, from `d5333830`. The sequence it exercises (retire, then attach) becomes illegal, so the contract is satisfied by construction                                      | rewrite, see below                             |
| `enhancer-metadata-authority` "capabilities become visible to the NEXT `.with()` once application succeeds" ×1 | **a real semantic change**                                                                                                                                                | rewrite **and** re-implement the check         |

## The one item that is not an artifact

Two independent mechanisms exist today:

```text
signal-tree.ts:1393   eager, per-call validation
                      `${who} requires capability "${dep}", which no applied
                       enhancer provides`  -> throws at the offending .with()

resolveEnhancerOrder  topological REORDER on requires/provides.
                      It does not throw for an unsatisfied requirement --
                      an enhancer requiring something nobody provides simply
                      gets no incoming edge and is ordered anywhere.
```

Under deferred application the eager check has nothing to fire on, and if it is
simply dropped the unsatisfied-`requires` case becomes **silent**: reordering
absorbs it with no error.

Deferral makes that error _later_, not impossible — at finalize the full
enhancer set is known, so the same message can be produced, and arguably better
(report every unsatisfied requirement at once; reorder legitimate
out-of-order declarations instead of rejecting them). But it must be
re-implemented deliberately. **If this is overlooked, the phase model trades a
loud error for silence.**

## Consequence for the prospective-authority contract

`d5333830` pins that a later-attached owner has no retroactive rights, and it
demonstrates that by retiring a subject and _then_ attaching `timeTravel`. Under
the phase model that sequence is illegal, so the guarantee becomes structural
rather than behavioural. The replacement is two tests:

```text
.with(timeTravel()) before finalization -> removals afterwards are restorable
tree used first, then .with(timeTravel()) -> throws
```

Same intent — history cannot appear retroactively — enforced by construction
instead of by runtime semantics around late attachment. Strictly stronger.

## Methodological note on how this was measured

Three attempts, two of them misleading:

```text
globalThis counter    worker-isolated; reported nothing
console.error count   captured by the runner; reported 2 against 467 sites
make the case THROW   11 tests, 6 files -- trustworthy
```

Using the suite as the instrument is the only version that produced a number
worth acting on. The same trap applies to any future instrumentation here.

## OUTCOME — what the 11 tests actually became

Recorded after the migration landed, because the measured count was the input to
the decision and the disposition is what makes it auditable. All eleven were
rewritten rather than deleted; every guarantee they encoded survives in a form
the phase model can express.

| Spec                                     | Rows | Disposition                                                                                                                       |
| ---------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------- |
| `enhancer-metadata-authority.spec.ts`    | 6→10 | rewritten against the declared set; two rows ADDED for properties the chain could not have — order-independence, aggregated errors |
| `enhancer-method-forwarding.spec.ts`     | 3    | "pre-enhancer reference" is taken by a probe enhancer declared first; one row added pinning declaration-order stability            |
| `enhancer-protocol-continuity.spec.ts`   | 2    | D is now unreachable-by-construction rather than guarded; E is total rather than incremental                                       |
| `entity-restoration-authority.spec.ts`   | 2    | the prospective rule became a STATIC one — see restoration-ownership-inventory.md, "AMENDMENT"                                     |
| `batching.behavior.spec.ts`              | 2    | raw-setter counter installed by a probe enhancer ahead of `batching`                                                               |
| `walker-conformance.spec.ts`             | 1    | same probe technique                                                                                                              |
| `derived.spec.ts`                        | 2    | "identity across chaining" became "merged once, into the `$` the enhancers saw"                                                    |
| `time-travel.spec.ts`                    | 2    | `.derived(...).with(...)` became `{ enhancers, derived }`                                                                          |

Two of these rewrites are weaker than what they replaced, and saying so is the
point of this table:

1. `enhancer-protocol-continuity` row D no longer guards anything an
   implementation could get wrong — duplicate detection moved out of reach of
   enhancer bodies entirely. It is kept as a statement of the claim.
2. The `$`-identity rows depend on independent enhancers applying in declaration
   order. If that ever changes they go vacuous rather than red, which is why
   `enhancer-method-forwarding.spec.ts` now pins declaration order directly —
   that row fails first.

### Costs the model did not predict

- **+0.47KB gzip on every bare bundle.** Declaring enhancers puts
  `resolveEnhancerOrder` and the configuration validator on the mandatory
  construction path, so a tree with no enhancers links both. A runtime
  short-circuit cannot recover it; tree-shaking is static. Full attribution is
  on `signaltree-bare` in `tools/check-bundle-budget.mjs`.
- **One public type gap surfaced.** `DevToolsMethods` never declared
  `exportDebugSession()`, which `devTools()` has always attached and
  `devtools.spec.ts` has always asserted. Reaching it required a cast, and
  removing `.with()` removed the cast. The `enabled: false` path did not
  implement it at all, so `devTools({ enabled: false }).exportDebugSession()`
  threw. Both fixed here.
