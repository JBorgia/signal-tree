# Independent bounded diagnostic-reduction premise review

**Verdict: no blocker demonstrated to the narrow premise.** Diagnostic-only state and unreachable helper code can be excluded from compile-time production graphs while retaining development diagnostics. The identical-message environment selector can be replaced by one frozen message object. This is permission to investigate that implementation shape, not verification of an unseen successor, release sign-off, or a size claim. Deleting development diagnostics or the bracket-access proxy would not preserve the inspected contracts.

## Identity and scope

Reviewed frozen `/private/tmp/st-c28-r3-registration-lint-combined/candidate`, manifest SHA-256 `89058c7adf0bf680c3d8ef4778ff31d295ccc40d1911a31ac254484fa24a5c84`. Independently hashed MANIFEST.json and all 3,119 listed candidate files: no mismatches. Candidate has no `.git`; it is identified by that manifest, not the ambient checkout's HEAD. Ambient HEAD was `628d302dadb082a48c58528651c9088234d0a777`, branch `fix/d1-d2-forward-port`, with unrelated tracked and untracked work left untouched.

Inspected the supplied `runtime.patch` and base/candidate manifest comparison. Both target source files are unchanged against `base-MANIFEST.json`; the combined patch concerns registration/completion/lint work, not this proposed diagnostic reduction. No reduction implementation diff exists in this review. Available local history points to protective snapshot `d2218eb0`; the warning tests themselves preserve the relevant prior rate-policy reversal and GitHub #18 batching regression.

Started from actual source and emitted JS, without reading the inventory REVIEW.md or author REPORT.md. Read candidate and repository contributor/review contracts, candidate support policy, build-pipeline contract and error-code documentation. This is a bounded premise review, not release verification; the release controller and release gates were not used to grant sign-off.

## Raw graph evidence

All graph paths below are under `/private/tmp/st-c28-r3-artifact-reduction-inventory`. Inspected JS and metafile inputs, not just summary claims. `graph.mjs` builds browser ESM from existing built artifacts; production defines `ngDevMode: false`, development leaves it undefined. It does not establish that NODE_ENV alone suppresses diagnostics.

| Graph | SHA-256 | Observation |
| --- | --- | --- |
| bare-dev.js | `727b1bc94fb757d57cbfc2a0c647f9e5b58a90147d4da0147657f6277f584423` | Message environment reads present; entity diagnostics absent. |
| bare-prod.js | `f1ebfd3229bca0221d3ab93e3f7755c8093cc62670a2f202b871498ac2cbaaa0` | Same environment reads survive the false flag. |
| entities-dev.js | `1c0ee98ece8c49896538bdb0e54182bebed5cbc67972574539483ad746f0de47` | Churn helper and both calls survive; wrong-method warning and state survive. |
| entities-prod.js | `ecb0195c59ad8ac2a00be275a0fce037202a025c66fc9b34df98a9e12ea65c18` | Churn helper and allocations survive, calls do not; wrong-method table/read and unused Set survive, warning does not. |

In entities-prod, helper identifier `Xc` occurs only at its declaration. Adjacent `Mn=new Map,Di=new Set,ca=12,ua=2e3` belongs to that helper. Proxy tail is `let tu=new Set,wr=new Proxy(ee,{get:(i,a)=>typeof a=="string"&&!isNaN(Number(a))?ee.byId(Number(a)):(typeof a=="string"&&!(a in i)&&Hc[a],i[a])})`. Thus the warning body is unreachable, but the constructors and lookup are **executed**, not themselves unreachable. Removing those requires appropriate guarding; calling all surviving code dead would overstate the evidence. The table lookup can observe inherited getters under prototype modification; no supported contract requiring that diagnostic-only side effect was found.

## Conditions and concrete falsifiers

### 1. Preserve development warning policy and per-collection ownership

Evidence: `packages/kernel/src/lib/entity-signal.ts:1983–2024`, `4096–4103`, `4144–4151`; build contract requires foldable guards, not globally stripped console calls. Both warning sites treat absent ngDevMode as development. NODE_ENV production alone does not disable them. `docs/errors/README.md:11` summarizes true-only behavior less precisely than source; do not use that shorthand to erase the absent-flag path.

The windows and warned-source Set are local to each collection. where/find share them, but their WeakMap caches are separate. Cache hits and tap-depth paths bypass diagnostic counting. Preserve threshold 12, window reset only when elapsed time exceeds 2,000ms, once-per-source deduplication, performance.now/Date.now fallback, and the existing `size > 200` cutoff (which allows 201 entries and then stops processing). A module-global cache or a separate counter per method changes behavior. Predicate stringification is development work and may invoke user-defined conversion; do not move it before the production guard or cache-hit check. Keep query caches, results, reactivity and ownership separate from diagnostic state.

Cheapest falsifiers: existing `entity-predicate-churn.spec.ts` checks fast/slow rebuilds, once-only warning, separate collection counts, cache reuse silence and reactive results. Run through the kernel Nx target on the successor. Add deterministic threshold/window boundaries, mixed where/find source counts, and independent warning emission from two collections. Test absent/true/false flags, including NODE_ENV production with absent flag. If initialization becomes conditional, avoid creating state only at module import or construction while allowing later guarded calls to access missing state; lazy per-collection initialization avoids that mismatch.

**Status:** source and tests inspected; suite not run. These are implementation risks, not demonstrated defects in a successor.

### 2. Preserve the proxy's non-diagnostic access semantics

Evidence: `entity-signal.ts:112–130`, `5641–5670`. The Set is per collection and warns once per wrong name. Real properties, including custom properties named like wrong methods, bypass warnings through `prop in target`. Retain the numeric branch before diagnostics: Number-coercible string keys route to `byId(Number(prop))`, including whitespace, empty string, exponent strings and Infinity. Do not substitute a narrower numeric parser or add string-ID bracket lookup in this task. Symbols bypass Number conversion and diagnostic lookup. Ordinary reads use `target[prop]`; replacing this with `Reflect.get(target, prop, receiver)` changes accessor `this` from target to proxy. Keep API method identity and snapshot/publication binding to the returned proxy.

Cheapest falsifiers: existing `entity-wrong-method-guard.spec.ts`, including batching's internal update probe. Add two collections each warning once for the same name; unknown names; symbol reads; numeric coercion cases; own and inherited accessors; real custom slices named add/upsert; getter call count and receiver identity. Removing the entire proxy fails bracket lookup regardless of diagnostic reachability.

**Ran:** isolated extraction of the original table/proxy, TypeScript-transpiled using the candidate compiler, under Node 24.15.0. Numeric cases, symbol reads, an own upsert accessor with target receiver, unknown name, wrong-name deduplication and absent/true/false flags passed. This characterizes the original trap with a stub byId; it is not a full EntityMap or successor parity test. Full suite and inherited-accessor cases not run.

### 3. Collapse only the identical-message selector

Evidence: `constants.ts:26–68`. PROD_MESSAGES aliases DEV_MESSAGES. Preserve the three keys, exact strings/codes, readonly inferred type and Object.freeze. The environment selector has no effect on selected message identity or contents. It is independent of the entity warning policy and should not become a replacement global development flag.

Removing it intentionally removes reads of globalThis.process/env/NODE_ENV and ngDevMode. Accessors on those globals can observe the old reads or throw (for example null process passes the typeof-object check before the `in` operation). This is not equivalence under arbitrary instrumented globals; no supported API contract requiring those incidental reads was found. Avoid claiming universal side-effect equivalence.

Cheapest falsifier: compare keys, values and frozen status across absent/true/false flag and absent/development/production environment; run public declaration/type checks after implementation. Add throwing/counting environment accessors if the implementation claims import no longer consults environment.

**Ran:** isolated original-module evaluation across that 3-by-3 matrix; exact strings and frozen object passed in all nine contexts. Successor comparison, accessor globals and declaration checks not run.

## Verification limits and handoff

Executed independent hashes, source/diff/metafile inspection, identifier occurrence checks and the isolated probes. Reproduction: `/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node /private/tmp/st-c28-r3-diagnostic-reduction-premise/probe.cjs`; results are in `probe-results.json`. No candidate runtime files were edited. No build, package suite, production graph regeneration, performance workload, size measurement or release gate was run.

Main should verify the successor with focused kernel Nx tests (candidate pins pnpm 10.17.0), then freshly emit all four graphs: production diagnostic helper/state/table references should disappear, development warnings should remain, and message environment selection should disappear from both modes. Graph removal alone cannot establish runtime compatibility. No blocker to that bounded approach was demonstrated.
