# CAPABILITY-SURFACE-0

> **Disposition: METHODS KEPT — reported 2026-09-22.** The measurement settled
> only the bundle question; the architecture was settled separately, below. Blocks
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

---

# RESULT — KEEP METHODS

Arm B was built and measured in full. It **passed every criterion except the
one that motivated it**.

## The tree-shaking rationale is refuted, quantitatively

```text
consumer                                  gzip        over bare
bare signalTree                          12583 B          —
transactions() configured, NEVER used    31380 B     +18797 B
all enhancers configured, never used     47017 B     +34434 B
```

**Configuring `transactions()` costs 18.8 KB gzip even if you never call it.**

Arm B's standalone extraction works — the propose module genuinely disappears
when unimported, verified by a marker string unique to that module, not by
bundler intuition:

```text
arm   scenario                            gzip     propose module present
A     configured, neither used           31613 B   yes
A     transaction used, proposal not     31627 B   yes
A     both used                          31650 B   yes
B     configured, neither used           31391 B   NO
B     transact used, propose NOT         31448 B   NO
B     both used                          31700 B   yes
```

Arm A never drops anything: all four scenarios sit within 37 B. Arm B drops
cleanly. But the recovered amount is **179–222 B gzip — about 1.2% of the
18.8 KB the enhancer costs**, and ~0.6% of the bundle.

The weight is in the **enhancer machinery** — causal runtime, turn authority,
rollback planning — not in the public operation wrappers. Moving a name off the
tree object cannot reach it, because the enhancer is what installs the
machinery and the consumer configured it deliberately.

> If the goal is to reduce what a transactions-configured app pays, the lever
> is the enhancer's machinery. It is not whether the call is
> `store.proposal(fn)` or `propose(store, fn)`.

## Everything else about arm B held

```text
typing         HOLDS. A phantom `TransactionsCapability` marker contributed by
               the enhancer makes transact(treeWithoutTransactions, fn) a
               COMPILE ERROR, not runtime discovery. Both @ts-expect-error
               probes were consumed.
semantics      IDENTICAL. 20/20 ported assertions, including byte-identical
               state against raw transaction()/confirm()/rollback().
neutrality     PASSES. Adapters re-export with `export *`, so a standalone
               operation needs no per-adapter work.
runtime        EXPLICIT. Missing capability throws, never silently no-ops.
```

So arm B is **technically viable**. It simply does not earn adoption on the
measurement that prompted it.

## What this decides, and what it does not

**Decided:** the bundle argument contributes nothing to the placement question.
It should not be cited again in either direction.

**Not decided by measurement:** whether optional operations _should_ live on the
tree object is now purely an API-design judgement — surface size, grammar,
discoverability, how much a state object should carry. That is a legitimate
question, but it is the owner's call and no longer has a measurement behind it.

Recorded outcome per the preregistered rule: _"KEEP METHODS — no material
bundle difference."_ 179 B gzip is not material.

## Consequence for the release sequence

`PUBLIC-API-GRAMMAR-0` is **unblocked**. Names apply to the method surface:

```text
transaction()  ->  transact()
proposal()     ->  propose()
```

The rename preserved on `grammar-rename-unapproved` targets the surface that is
being kept, so it is no longer at risk of being a pass done twice.

## Preserved

```text
capability-surface-0-arm-b   full arm B implementation + typing, runtime and
                             equivalence proofs
```
