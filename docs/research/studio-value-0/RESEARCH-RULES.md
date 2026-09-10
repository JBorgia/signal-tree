# Research rules for the Studio line

Rules earned by failures in this repository, not imported from a methodology.

## R1 — Every falsifier and invariant needs a positive control

> **A test must include a case demonstrating that it FAILS when its prohibited
> condition is deliberately introduced.**

Stronger than "be suspicious of an easy green", because it makes falsifiability
itself testable rather than a matter of vigilance.

```ts
it('control: the invariant trips when an unowned semantic frame is introduced', () => {
  expect(() => assertScopedEvidence(syntheticUnownedSemanticFrame())).toThrow();
});
```

### Why this rule exists — four failures of one shape

```text
1. harness captured nothing
   JOURNAL-LIVE-0's bare tree delivered zero frames, so the cross-tree
   falsifier passed VACUOUSLY.

2. assertion checked a marker the fixture never emitted
   OWNER-SCOPE-0's invariant compared against a '[HAS VALUE]' suffix the
   report did not produce. It could not have failed.

3. implementation packaging mistaken for semantic precondition
   The journal's onFlush buffering was nearly promoted into a Studio
   capability prerequisite. FLUSH-0 showed flush is packaging, and the real
   gate is leaf interception.

4. shape predicate mistaken for semantic discriminator
   `before/after === undefined` was used to prove "not evidence". `undefined`
   is a legitimate state value; OWNER-EVIDENCE-0 found no positive
   discriminator exists at all.
```

Three were caught by noticing a pass that arrived too easily. **The fourth was
caught by review, not by me** — which is precisely why vigilance is not a
sufficient control.

### R1a — a positive control alone is insufficient

A positive control proves the instrument can see the condition **present**. It
does not prove the instrument can see it **absent**.

`CAPTURE-DISPOSE-0` had a passing positive control (a deliberately held
reference stayed alive) while being completely blind to collection — an object
with no references also reported alive. It nearly recorded a phantom leak in the
capture lease.

> **Where a test can report "condition still holds", pair the positive control
> with a NEGATIVE control that must report the condition gone.**

### R1b — a gate must assert the EXPECTED value, not merely a non-zero one

`CAPTURE-MEMORY-0`'s gate checked `retained === 0` and sailed past a
`retained === 1` failure caused by same-value write suppression. The shape
benchmark's gate checked the expected count and caught it immediately.

## R2 — A superseded conclusion is invalidated at the top of its own document

Not appended beside. A future reader must not be able to find the old
conclusion first and act on it. State the supersession, the reason, and the
binding document before any of the original text.

## R3 — Preregister outcomes before running

Every experiment in this line (`SUPERSESSION-0`, `FLUSH-0`, `JOURNAL-LIVE-0`,
`OWNER-SCOPE-0`) froze its outcome definitions first. This is what makes a WEAK
or negative result reportable rather than negotiable.

## R4 — Separate the measurement from the conclusion

OWNER-SCOPE-0's measurement table remains correct; only its conclusion was
wrong. Recording them as distinct sections meant the correction cost one
paragraph rather than a re-run.

## R5 — Do not repair dead machinery to serve a consumer

`createDiagnosticJournal`'s `ownerId` defect is real, and remains tracked on its
own merits. It is not repaired *for Studio*, because FLUSH-0 removed Studio's
reason to adopt the journal.
