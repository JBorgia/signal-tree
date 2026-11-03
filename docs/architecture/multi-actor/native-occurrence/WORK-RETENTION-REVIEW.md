Read-only inspection complete; no tests rerun or files changed. These are source findings and proposed probes, not measured integration results.

**Cheapest discriminators**

| Probe | Counts and correctness controls |
|---|---|
| Point write, zero recipients; N=16/128/1024 | Reset after setup. Count complete captures, adjacency visits, row captures and support enumeration separately. Expect zero complete-output captures; compare existing `preparedFieldEdits`/`inputFactVisits` deltas across N. Assert write and rollback values. |
| Same write with leaf, collection, then root-only recipient | Leaf demand must not imply full collection output. Collection/root output may require N-row rendering. Count source materializations separately from recipient renders; root-only demand must reach nested collections. Verify delivered values and support provenance before interpreting counts. |
| One source frontier, two recipients | Count capture reuse and recipient-specific rendering separately. Preserve different ingress permissions; equal delivered arrays alone do not prove permission correctness. |
| Repeated held outputs, then terminal/supersession/disposal | Record live selection records, payload rows, support references and readiness subscriptions at each phase. Keep receipts/old handles alive. Multiple live units may legitimately retain multiple outputs; after release, growth must not follow historical write count. |
| Remove/readd while an old requirement remains pending | Check old completion cannot wake or alter the new occurrence. Preserve negative evidence needed by pending structural inverse; disposal alone must not erase it. |

**Existing hooks and limitations**

- [`getEntityPublicationBinding(node).source.inspect()`](/private/tmp/st-occurrence-successor/packages/kernel/src/lib/entity-publication-work-lifetime.spec.ts:8) exposes field-edit/input-visit counters and retained source-map counts. Its `inspect()` itself enumerates maps: sample outside measured work.
- [`RecipientOccurrences.inspect()`](/private/tmp/st-occurrence-successor/packages/kernel/src/lib/experimental-publication/recipient-occurrence.ts:87) exposes propagation, finalization, subscriptions, groups and slots. Existing sibling-count test compares 4 versus 128 enrolled siblings.
- [`diagnostics()`](/private/tmp/st-occurrence-successor/packages/kernel/src/lib/experimental-publication/private.ts:409) exposes operations, owners, connections and bindings. **It does not establish payload retirement:** [`projectionCounts()`](/private/tmp/st-occurrence-successor/packages/kernel/src/lib/experimental-publication/projection.ts:14) returns literal zero for several projection counters, including payloads.
- [`ownerTransition()`](/private/tmp/st-occurrence-successor/packages/kernel/src/lib/experimental-publication/lifecycle.ts:16) retires terminal owner-map entries in a microtask. Measure immediately and after draining notifications/microtasks; registry removal does not prove all retained proof references disappeared.
- Source-demand capture/render counters are missing. Small test-local counters at the actual builder/render loops would distinguish work better than timings or heap totals.

**Concrete work locations**

- [`member-membership.ts:953`](/private/tmp/st-occurrence-successor/packages/kernel/src/lib/internals/member-membership.ts:953): snapshot construction depends on globally registered preparer plus registry/address, not actual recipient demand.
- [`entity-egress-projection.ts:217`](/private/tmp/st-occurrence-successor/packages/kernel/src/lib/internals/entity-egress-projection.ts:217): point preparation touches selected rows but renders complete output with `order.map`. Structural preparation separately copies state.
- [`link.ts:604`](/private/tmp/st-occurrence-successor/packages/kernel/src/lib/link.ts:604): nested output can additionally request the projection’s before-value. Count this separately; a new source certificate must not conceal an additional full pass.
- Existing retirement checks omit some storage: source evidence also has key-mapping maps; occurrence groups persist until disposal. Current diagnostics cannot alone certify all new certificate/support retention.

**Existing focused commands** — proposed, not executed. Run from the identified integration copy with Node24.15.0/pnpm10.17.0:

```sh
export NX_DAEMON=false NX_ISOLATE_PLUGINS=false
corepack pnpm nx test kernel --skip-nx-cache --testFile=src/lib/entity-publication-work-lifetime.spec.ts
corepack pnpm nx test kernel --skip-nx-cache --testFile=src/lib/entity-negative-publication-retirement.spec.ts
corepack pnpm nx test kernel --skip-nx-cache --testFile=src/lib/occurrence-successor.spec.ts
corepack pnpm nx test kernel --skip-nx-cache --testFile=src/lib/publication-evidence-scope-controls.spec.ts
```

Before comparing work, retain the reviewed correctness discriminators: same-tree versus foreign equal admission, inverse restoration of predecessor obligations, completed U retaining its original payload/support after later writes, reentry frontier validation, and recipient permission isolation. No blanket benchmark is warranted before those are equivalent.
