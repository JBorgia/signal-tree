# CAPABILITY-SURFACE-0

> **Disposition: OPEN — preregistered 2026-09-22. Non-shipping.** Blocks
> `PUBLIC-API-GRAMMAR-0` and the `proposal() -> propose()` rename, because a
> naming pass applied to methods that are about to move is a pass done twice.

## Question

> Should optional SignalTree capabilities enlarge the tree object's public
> method surface, or should enhancers install semantic machinery that
> standalone exported operations consume?

```ts
// A — CURRENT
const store = signalTree(state, { enhancers: [transactions()] });
const tx = store.transaction(() => store.$.x(1));
const p = store.proposal(() => store.$.x(2));

// B — CANDIDATE
const store = signalTree(state, { enhancers: [transactions()] });
const tx = transact(store, () => store.$.x(1));
const p = propose(store, () => store.$.x(2));
```

Same runtime, same turn authority, same semantics. **Only public reachability
changes.** This is not a redesign of transaction semantics and must not become
one.

## Null

> The method surface is not costing anything material. Standalone operations do
> not measurably improve tree-shaking, and cannot retain capability-presence
> typing as well as enhancer-contributed methods do.

## Why transactions is the arm

It is the cleanest A/B available: a fully implemented, fully tested method form
already exists as the control, and `proposal()` gives a second operation on the
same enhancer — so the experiment can ask whether ONE operation disappears
while its sibling is used.

## What gets measured

### 1. Bundle reachability — the question that triggered this

Four packed consumers, each installing the built tarballs, measured minified
and gzipped:

```text
C1  transactions() configured, NEITHER operation used
C2  transactions() configured + transact used, propose NOT imported
C3  transactions() configured + propose used, transact NOT imported
C4  transactions() configured + both used
```

The decisive comparison is **C2 vs C4**:

> Does the Proposal classifier and review facade actually disappear from a
> consumer that configures transactions but never imports `propose`?

Measured on the BUILT package consumer, not on source-code reachability.
Bundler intuition does not count.

### 2. Capability typing — equally decisive

The standalone form must not degrade into runtime discovery:

```ts
transact(treeWithTransactions, fn); // must COMPILE
transact(treeWithoutTransactions, fn); // must be a COMPILE ERROR
```

Same for `propose`. If TypeScript cannot retain capability presence cleanly in
the standalone form, that is real evidence for keeping methods, and it
outranks a bundle win.

### 3. Semantic equivalence

Candidate B must reach byte-identical state to A across the existing matrices.
Any behavioural difference disqualifies B outright — the whole premise is that
only reachability changes.

### 4. Framework neutrality

Whatever wins must work the same on all four adapters. A standalone operation
that needs per-adapter re-export is not standalone.

### 5. Runtime failure

Calling `transact`/`propose` on a tree without the enhancer must fail
explicitly, not silently no-op.

## Outcomes

```text
KEEP METHODS      no material bundle difference, OR typing degrades
                  -> close; apply PUBLIC-API-GRAMMAR-0 to the method surface

GO STANDALONE     meaningful reachability win AND typing holds AND semantics
                  identical
                  -> disposition ownership, THEN name it once

SPLIT             transactions/proposal go standalone, other enhancers judged
                  separately on their own evidence
```

## Explicitly out of scope

- no change to transaction, restoration or batching SEMANTICS
- no rewrite of restoration/batching/devtools surfaces in this pass; they are
  audited only if transactions establishes the pattern
- these stay on their natural owners regardless of the outcome:

```text
store.$...                   state
entity.addOne/updateOne      collection behaviour
proposal.inspect/accept      handle behaviour
tx.confirm/rollback          handle behaviour
link.retrieve/dispose        Link behaviour
```

## Versioning constraint, carried in deliberately

The published support policy promises deprecated APIs get a documented
migration path before removal, except for correctness or security defects. A
placement or naming cleanup is neither. So if this concludes that shipped names
should be removed, the honest path is a bridge release that deprecates with a
documented replacement, then one coherent major — not a silent rewrite of a
policy adopted days earlier to rebuild API-stability trust.

## Gating flaw this must also fix

The grammar inventory found that public methods added to an ALREADY-EXPORTED
interface can evade an export-oriented API baseline: `proposal()` was added to
`TransactionMethods` and `api-baseline` recorded only the five new types. Any
surface gate that comes out of this work must inventory **callables**, not
exports.
