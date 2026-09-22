# Contributing to SignalTree

Start with [`AGENTS.md`](AGENTS.md), which is the full instruction set for this
repository. This file covers the one path that most needs written rules rather
than tacit knowledge: **adding or maintaining a framework adapter.**

## Adding or maintaining a framework adapter

These rules exist so an adapter can be added or repaired from the written
contract plus the executable gates, without the original architecture author in
the room.

### 1. Kernel semantics may not change for framework convenience

The kernel holds one definition of what state means: entity lifetime, what
counts as your write versus an external update, what a transaction and a
rollback do, what restoration revives. An adapter that needs those rules bent
to fit its framework is not finished.

If you believe a semantic genuinely is wrong, change it for every framework at
once, with the reasoning recorded — not inside one adapter.

### 2. Use the cheapest correct native primitive

The binding rule, and the one most likely to be got backwards:

> Do not ask "how do we make framework X use SignalTree's reactive mechanism?"
> Ask "what is the cheapest correct native primitive framework X gives us for
> realizing SignalTree semantics?"

Angular realizes leaves as `signal()`. Vue uses `shallowRef` with a reader.
Solid uses `createSignal`. React integrates through an external store, because
that is React's own model. None of them wrap a shared carrier.

"Cheapest" is subordinate to "correct". A primitive that is smaller but cannot
express the semantics is not a candidate.

### 3. Pass the shared semantic conformance suite

A framework earns support by passing the same conformance suite the existing
adapters pass — not by a subjective judgement that it works. This is what the
word "supported" means in
[`docs/support-policy.md`](docs/support-policy.md), and it is what keeps that
table honest.

### 4. Add a mutation proof that publication is necessary

A test that passes whether or not your publication path works is worse than no
test, because it reports coverage you do not have.

For every publication path the adapter ships, prove the suite **fails** when
that path is broken. Register it in `tools/verify-gates.mjs` with a `mutation`
block, then run:

```bash
npm run gates:self-test
```

A gate reported as `BLIND: passed while broken` is a release blocker. This is
not hypothetical: in 15.2 a new fast path silently left an older publication
path uncovered, and only the self-test caught it.

Note that `npm run gates:self-test` and `npm run gates -- --release` are
different suites. CI runs both on the tagged commit. Run both locally.

### 5. Prove a packed external consumer

Working inside this monorepo is not evidence that the package is shippable.
Path aliases, workspace links and the repo's own tsconfig hide exactly the
failures that reach users: a missing `exports` condition, a type absent from
the barrel, an undeclared peer dependency.

Add a `tools/verify-<framework>-consumer.mjs` that packs the real tarballs,
installs them into a project that has never heard of this repository, and both
**type-checks and runs** a consumer written against public entrypoints only.

Make the runtime half assert that the framework's reactivity ran *at all*
before asserting anything about SignalTree. `tools/verify-solid-consumer.mjs`
launches Node with explicit client export conditions for precisely this reason:
under the default conditions Solid resolves its SSR build, where effects never
run and every assertion below would pass vacuously.

### 6. Document framework-specific limitations

If something the other adapters do cannot be done in yours, say so in that
package's README, in the everyday vocabulary of
[`docs/glossary.md`](docs/glossary.md). A limitation discovered by a user at
runtime costs more than one written down.

### 7. Do not claim performance until it is measured

No number reaches a README, the website or the CHANGELOG without a named
generator that produces it — `tools/check-numeric-claims.mjs` enforces this.

If a cost has not been characterized, say that. `@signal-tree/solid` shipped
with "memory not yet characterized" rather than a number invented to fill a
column, and that is the expected behaviour, not an omission to fix by guessing.

When a change makes something worse, publish that in the same breath as what it
buys. The 15.2.0 entry records a kernel size regression next to the memory
reductions it paid for.

## Documentation language

SignalTree has three vocabularies, and
[`docs/glossary.md`](docs/glossary.md) defines them. The binding rule:

> Users learn the behaviour first. Names for the machinery come later. Internal
> implementation vocabulary never appears in introductory material unless the
> user must interact with it.

In practice: introductory material uses the everyday terms; advanced terms are
introduced by describing the behaviour before naming it; and architecture terms
(`SubjectId`, `EpochHandle`, `StructuralStore`, realization carrier) stay in
architecture and adapter documentation.

Say **entity lifetime** in public documentation rather than *subject*. The
internal name is accurate, but RxJS has already claimed that word for Angular
developers.

## Before you open a pull request

```bash
npm run gates -- --release
npm run gates:self-test
```

Both must pass. Commit messages say *why*, not just *what*, and link the issue.
