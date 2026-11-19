# Remaining point gate: exact-source operation attribution

**No new runtime reduction recommended from the available local ideas. They do not justify closing the unchanged <2,000 gate.** The prior highest-value idea is already the accepted point-result-demand delta. Fresh attribution reproduces **14,200 visits** at both population sizes. The remaining proposals concern small portions of that work and include unresolved evidence/aliasing obligations; this packet does not promote another one-Map change or a counter-evading loop rewrite.

This is a bounded negative result about the inspected local scopes, not proof that no other implementation could meet the threshold. No budget change, new authority model or broader architectural alternative is proposed.

## Exact input and execution

Source: `/private/tmp/st-point-demand-c8a/candidate`, manifest SHA-256 `ffba656df9413c59d334884064b0690281cc9a29c3170a8775a1cc32c845dc0d`. Verified all 3,033 source entries and copied them into this task's candidate. Runtime and original tests remain byte-identical. Only a diagnostic spec was added. The original source directory, root repository and other workers' scratch were not changed.

Ran through Nx, Node 24.15.0 / pnpm 10.17.0:

- `corepack pnpm nx test kernel --skip-nx-cache point-residual-attribution.spec.ts --maxWorkers=1`: three tests pass (two population sizes and independent calibration).
- `corepack pnpm nx test kernel --skip-nx-cache entity-granular-reactivity.spec.ts --testNamePattern="a single-entity update does not rebuild" --maxWorkers=1`: original gate fails at 14,200 versus <2,000; nine other tests deliberately filtered.
- `node tools/check-spec-types.mjs`: passes; no ratchet edit.

Commands/environment, first logs, before-source hashes and unchanged-source receipts are in `runs/`. Dependencies were locally clone-copied from the frozen candidate dependency tree; copied pnpm fallback paths were rewritten only in this scratch. Nx caches/data/temp remain local. Other agents were active; elapsed times carry no CPU claim.

## Attribution method and limits

The diagnostic copies the original `countIteratedElements` function verbatim, and runs it on an independent tree before running the stack-attributed counterpart. Both execute the same 200 actual point writes after seeding 2,000 or 20,000 `{id,v}` rows. Every updated row and an untouched sentinel are asserted afterward; stores are destroyed.

The attributed counterpart retains the same intercepted operators and amounts, recording the runtime stack at each counted event. Its bookkeeping is excluded with a guard so stack parsing and histogram construction do not inflate counts. Tests require original total = traced total = sum of attributed visits, plus nonzero independent calibration parity. Both totals are 14,200, and **the complete site/operator histograms match between 2,000 and 20,000 rows**, not merely their sums. Raw events retain up to five runtime frames; aggregation below charges each event to its first kernel frame, avoiding double-counting callers.

These are the gate's defined visits, not machine instructions, bytes, total allocations or callback counts. Array iterator/destructuring visits count separately; zero-length operations contribute zero even when they allocate. `flatMap` is not among the gate's patched array methods. No instrumentation or threshold was weakened, and no source loops were rewritten to hide operations.

## Complete accounting

Paths relative to `packages/kernel/src/`; detailed source line/operator stacks are in ATTRIBUTION-SUMMARY.json and the two raw rows JSON files.

| First responsible module | Visits per 200 writes |
| --- | ---: |
| lib/experimental-publication/entity.ts | 5,000 |
| lib/internals/entity-publication.ts | 2,800 |
| lib/entity-signal.ts | 2,600 |
| lib/internals/intrinsic-mutation.ts | 1,200 |
| lib/experimental-publication/private.ts | 1,000 |
| lib/internals/utilities/deep-equal.ts | 800 |
| lib/internals/location-runtime.ts | 600 |
| lib/physical/entity-value-store.ts | 200 |
| **Total** | **14,200** |

Operator totals: array iteration 6,200; Map iteration 2,000; Array.map 1,600; Object.keys 1,200; Array.push 1,200; Array.filter 1,200; Set iteration 400; Array.slice 200; Array.find 200. Lifecycle calls also appear with zero counted visits; that does not mean zero actual work.

## Prior ideas checked against current source

**Unused rich indexes:** already removed for point demand. Current entity-signal.ts:1061–1359 retains ordinary simulation/completed changes while selecting rich indexes only for the rich caller. Recommending this again would double-count an accepted saving.

**Duplicate point descriptor views:** still present at entity-signal.ts:2563–2564, with 200 mapped elements each. Admission at internals/entity-publication.ts:64,76,85,89 contributes field-metadata copies, membership walks and step preparation. The idea may avoid some shells and repeated admission work, but distinct descriptor identity, forEdit mapping and borrowed metadata must remain correct. It does not remove native support, source revision checks, dispatch or installation. Not promoted here as the next optimization.

**Unconsumed transient evidence:** still present at experimental-publication/entity.ts:103–104,119,153–161. The two per-edit physical snapshot copies account for 400 + 400 visits; the associated field-rewrite loop accounts for 200. That visible evidence-only slice is **1,000 visits**, not the entire 5,000 charged to the module. Remaining rowFields/rowViews copies, ordinary/physical support preparation and terminal records are not dispensable recipient envelopes. Current internals/entity-publication.ts:229–240 still allows recipient preparation and checks recipient/source revisions afterward. Any evidence-demand omission would have to handle enrollment during native preparation before dispatching a participant with missing facts. No safe omission patch is authorized or supplied by this attribution.

**Capture envelopes/terminal assembly:** topology-envelope construction at entity-signal.ts:2550–2560 has no separate charged site in this workload; deleting pure envelopes cannot be booked as thousands of saved visits. combineTerminalRecords at intrinsic-mutation.ts:20 contributes 1,200 filter visits across calls. A loop substitution alone would exploit the proxy rather than eliminate the required prepared work; it is not a recommended permanent reduction.

These are disposition checks of prior ideas, not a ranked new optimization list.

## Why those scopes cannot justify the threshold

Passing a strict integer ceiling of <2,000 from 14,200 requires removing at least **12,201 counted visits** on this unchanged workload.

Give the remaining prior ideas an intentionally impossible advantage: attribute to them **every visit in entity-signal.ts, entity-publication.ts, experimental-publication/entity.ts and intrinsic-mutation.ts**, including all essential work that could never safely disappear. Their combined contribution is only **11,600**. Deleting that entire charged contribution would still leave **2,600**, above the unchanged ceiling. The actual proposed local removals are strict subsets and save less. Arithmetic and module set are frozen in LOCAL-SCOPE-BOUND.json.

This is a generous bound on the direct charged work in the inspected scopes, not a lower bound for every conceivable implementation. It assumes the remaining required input capture, comparison, notification and value-transition work is preserved, as these local proposals require. It does not license deleting whole modules, bypassing responsibility or callbacks, or demanding a new target. Potential cross-cutting redesigns are outside this task and unproved here.

## Action for Main and falsifiers

Keep the accepted point-demand delta as a measured permanent reduction, but **do not treat stacking the remaining prior local ideas as a supported path to this gate**. There is no additional implementation recommendation or runtime patch in this packet. Leave the original red gate visible while parent/order correctness proceeds.

Executed falsifiers: exact original counter parity, identical full attribution at both populations, useful-write assertions, calibration, unchanged original gate replay, and spec types. Not run: any proposed optimized successor, callback/evidence-demand omission experiments, CPU/heap/broad suites. No claim about the safety or savings of an unimplemented mechanism is inferred from the histogram. A future concrete mechanism must show which actual work disappears, preserve the remaining contracts, and rerun the unchanged gate; this report supplies the baseline attribution for that decision.
