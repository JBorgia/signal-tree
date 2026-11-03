# Owned entity projection inventory before S1

Inspected checkpoint `de94a7ab277f4bf59dac3c568fba61db2ff104b1` (runtime
`19a5bd03`). D2 and P3 evidence remain unchanged. Public surface:
`packages/kernel/src/lib/types.ts:807` (`EntitySignalOf`), plus configured
computed slices in `markers/entity-map.ts:318` and entity node field carriers.

| Public read | Owned cache and dependencies | Invalidation/publication path |
| --- | --- | --- |
| `all` | versioned native derived; computes installed live entities, sorted when configured | collection version → native readonly computation |
| `count` | versioned native derived; installed active count, absent-aware | same version |
| `ids` | versioned native derived; unsorted structural-key snapshot identity retained; sorted chains through `all` | version, and sorted `all` dependency |
| `asMap` | versioned native derived; copies installed present entries | version |
| `has(key)` | new versioned native derived per call; installed membership, absent-aware | version |
| `where(predicate)` | WeakMap by predicate to versioned derived; direct entries, sorted path through `all` | version and optional `all` |
| `find(predicate)` | WeakMap by predicate to versioned derived; direct entries, sorted path through `all` | version and optional `all` |
| `empty` | lazy native derived over `count` | count → another native computed (P3 omission) |
| `activeId` | native writable location's cached readonly view | selection location, rekey/removal selection rules |
| `activeEntity` | lazy native derived over activeId and selected row's subject epoch | selection/selected lifetime; deliberately not collection-wide (P3 omission) |
| configured `.computed` slices | native derived over `all`, user-supplied projection installed/owned by SignalTree | `all` → another native computation |
| `byId`, `byIdOrFail` | lookup; present row observes subject epoch; absent lookup observes ids for later appearance | subject changes or ids when absent |
| numeric bracket alias | runtime proxy delegates numeric keys to `byId`; same dependency/lifetime behavior | same as byId |
| held row callable | subject-bound node reads physical backing with lifetime/absence checks; node cached by subject | subject epoch, collection membership visibility |
| top-level field carrier | derived read of subject-backed row; native writable projection where supported, neutral derived fallback | same subject epoch; framework carrier controls native cache |
| readonly field view | writable carrier's `asReadonly`; Vue creates another native computed over field read | field/subject dependencies → native readonly cache |

Core locations: `entity-signal.ts:407` versioned helper; `708–753` all/count/ids/
map and tap freshness; `1182` active location; `2193` updateSignals; `2300–2347`
field construction; `2666–2869` public getters and predicate caches. Public node
types describe recursive field shapes; runtime here constructs top-level fields
from `Object.keys`. This inventory does not reopen that separate distinction.

Physical installation precedes publication. `updateSignals` advances pending
subject epochs and the collection version in an invalidation group. Native
location realization forwards grouping to the framework adapter; Vue stages
published writable values, then currently drains separate token `triggerRef`s.
A scalar trigger may synchronously notify an observer before another token has
marked its owned computed chain dirty. Direct physical reads and cached owned
reads then disagree. P3 refreshes only the versioned-helper subset and misses
plain derived chains and module-level readonly carrier helpers.

Taps remain a distinct existing contract: reading projections through the
collection while a tap runs uses an uncached physical reader; a held projection
keeps its cached value until grouped work ends. Native application-created
`computed(() => rows.all...)` is not a SignalTree-owned projection. Neither this
inventory nor its matrix requires application native computed freshness inside
grouped callbacks. Native effect timing remains framework-owned.

## One candidate, shared boundary hypothesis

S1 uses the existing adapter grouping port, with no SDK change: a per-adapter
publication ref, and per-token computed selectors returning their own plain
revision after depending on that ref. Writes advance only affected revisions;
one publication trigger at group exit invalidates their dependency chains in
Vue's single native notification batch. Unchanged selectors return unchanged
revisions so native computed equality can suppress unrelated downstream work.
Directly depending every cell on one global nonce would break granularity and
is not this hypothesis. No projection-specific read fallback is added.

This relies on public Vue `computed`, `shallowRef`, and `triggerRef` only. It
must be falsified by the complete projection matrix, held/group timing, reentry,
first errors, selected-row dependency and unchanged memoization controls. A
shared root may increase internal selector polling; no performance or lifecycle
claim follows from functional survival. Native implementation details are
examined as evidence, not imported or mutated. Candidate acceptance remains
experimental, without API acceptance or runtime integration.

Vue facade field types expose `Ref` without an application `asReadonly()` method;
readonly-view checks use the existing adapter SDK carrier, not an unsupported
application cast. Its internal helper also realizes public `activeId`.

The full matrix additionally reveals missing-key dependency loss in activeEntity;
see the result record. Publication coverage is insufficient without dependency
coverage. P3 and D2 files remain byte-for-byte unchanged.
