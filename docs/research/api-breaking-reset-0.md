# API-BREAKING-RESET-0

> **Owner disposition — 2026-09-22. BINDING.** A deliberate one-time public API
> reset, taken instead of the deprecation bridge previously planned for this
> cleanup.

## The decision

> SignalTree is still early enough that preserving known-wrong public API solely
> for compatibility would create permanent surface debt. Before the next
> release, the approved API cleanup lands as **one intentional breaking
> change**, every migration is documented, and the project continues from the
> corrected surface.
>
> This **supersedes the previously planned deprecation bridge** for this
> cleanup. It is a deliberate one-time reset, **not** a general exception to
> SemVer going forward. After this release, the corrected public surface is the
> compatibility baseline.

## Why this is recorded rather than just done

The published support policy promises deprecated APIs get a documented
migration path before removal, except for correctness or security defects. **A
naming cleanup does not qualify for that exception.**

So this is not the previous rule being followed — it is the owner choosing to
break, once, with the cost stated. Recording it that way matters more than the
break itself: a policy quietly bent is worse than a policy openly amended,
especially one adopted days earlier specifically to rebuild API-stability
trust. Release notes must carry the same statement.

## What changed

```text
transaction()  ->  transact()     BREAKING. Shipped in 15.2.1. Removed, not
                                  aliased. No compatibility spelling exists.
proposal()     ->  propose()      Never shipped; no migration owed.
```

Verbs, matching the handle operations they open (`confirm()`, `rollback()`,
`accept()`, `reject()`). `transaction()` and `proposal()` were nouns used as
methods.

## What deliberately did NOT change

Each was flagged by the grammar taxonomy and cleared by use-site inspection:

```text
empty                 KEEP. Not a method — a readonly reactive signal property,
                      in a block the source labels "Queries (readonly
                      properties returning signals)" beside all/count/ids/asMap,
                      with a documented v10.3 decision aligning bare-boolean
                      accessors across status/form/asyncSource. The first
                      grammar pass mistook it for a method sitting beside a
                      mutating clear().
settled()             KEEP. Every use site is `await x.settled()`.
tap()                 KEEP. Takes a bag of observers, returns an unsubscribe.
intercept()           KEEP. Really blocks/transforms, synchronously.
exportDebugSession()  KEEP. Accurate.
```

## The architecture this locks in

```text
tree.$.*      application state
tree.*        this tree's capabilities and lifecycle
handle.*      operations on that particular outstanding object
root import   construction and classification not owned by one tree
```

Settled by `CAPABILITY-SURFACE-0`: standalone extraction recovers ~179-222 B
gzip against an 18.8 KB enhancer, so there is no bundle reason to give up
`tree.` discoverability. Both architectures were viable; this one was chosen on
coherence, because `tree.$` already separates state from control.

## Migration

```ts
// before
const tx = tree.transaction(() => {
  tree.$.x(1);
});

// after
const tx = tree.transact(() => {
  tree.$.x(1);
});
```

Mechanical and total: there is no overload, no alias and no runtime shim, so a
missed call site is a compile error rather than a silent deprecation warning.
That is the point of breaking rather than bridging.

## Standing rule from here

This is the **last** time compatibility is waived casually. Get the surface
right now, then make the new baseline boringly stable.
