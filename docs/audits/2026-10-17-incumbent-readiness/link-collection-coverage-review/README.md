# Collection coverage adjudication: covered recurrence

2026-10-27. Read-only assessment against runtime `75416029be1e0c1d9735ed3bdc0f4e8e6c02f775`, parent `f7a0ffd9e2e34a23ceae85bff3cd8fa45ecaa82d`, reviewed design archive `3c8bbaff0d9663d7e8a0962e881c2f570161d60b` and previous disposition `92ada3b6364689ae5f6a5ed951f3d75857459a35`. No runtime/test changes, new tests, broad suites, builds or performance measurements.

**Collections were inside the reviewed mechanism. The destination-first publication violates that covered rule; the recurrence stop remains active.** The passing forward-removal repair remains separately preserved at75416029. Runtime `supported:false` means missing implementation support, not an approved exception from safety or an absence of owner authority.

## Governing evidence

The [aggregate authority](../link-a1-successor-design/AUTHORITY.md), present verbatim at3c8bbaff, records the owner's approved experiment:

> The isolated experimental connection.declare surface may cover branch/root and entity collection sources. Completeness covers all inputs to newly authored facts. Untouched contributing facts retain their own support: a declaration can be valid while the resulting projection and its receipt remain held.

It explicitly preserves transaction authorship, consumed inputs, enclosing validation and rollback ownership. The approval is experimental, not public release acceptance. Enabling the promised experimental surface is not a new policy choice by itself; recurrence still gates the means of implementing it.

The [removal design](../link-authored-removal-design/DESIGN.md) at3c8bbaff says:

> Point row/field recipients use the same lifetime removal and become absent; collection/root/nested projections reduce that same stream, not separate per-connection removal rules.

> The outgoing removal revision must carry D/I/W/V when applicable, even if O had no value/membership delta.

Its prewritten [R11/R12 cases](../link-authored-removal-design/CASES.md) require holding through destination p confirmation while input q remains unresolved, useful delivery after discharge, and useful qualified independence. They are not scalar-only exclusions. The prior entity integration scope also names D/I/W/V, membership/order and useful delivery. Scalar0135ef18 was only a scoped scalar checkpoint; that qualification boundary did not narrow the later entity/aggregate contract.

## What the preserved failure establishes

In `authored-removal-obligations.spec.ts`, an undeclared removal in destination p has a foreign owner q pending at authorship. Under the approved missing-input rule, q belongs to the possible-owner window; this fixture does not establish an actual observed read of q. After p confirms, the collection sends[A] while q remains pending. That is the covered D/W failure. It is not proof that every ordinary removal actually consumes q, nor proof of where native capture first lost evidence.

The recorded parent result was silence and failed eventual progress. The successor repaired forward removal and then exposed premature delivery. Reversed settlement order passes through the remaining p gate. The declaration case separately rejects before its callback, so it establishes missing authorized capability, not tested publication behavior. The original tests/logs remain in the [runtime evidence](../link-authored-removal-successor/README.md); no replay was needed to restate them.

## Two defects, distinct evidence

1. **Enforcement bypass — source-verified, sufficient causal explanation of the send.** Link's source classification excludes collections. Private allowed/admit bypass experimental evidence for those sources and delegate to the old tree-local scheduler. p confirmation releases that scheduler; q's foreign obligation is not enforced there.
2. **Aggregate proof omission — independently source-verified.** Whole collection receipt completion stores its revision in completedValueFact, while aggregate projectionSupport reduces field summary, baseline structure and ancestor presence, omitting that own value fact. Nested fields follow a different path. Turning on the gate alone would not establish complete proof composition. The current failure does not experimentally isolate a gate-enabled variant; none was implemented.

These are implementation violations/gaps within the approved contract. Calling a source unsupported cannot discharge its known or possible input obligations. Likewise, admitting a declaration cannot certify untouched members, lifetimes, values or order.

## Finite correction boundary

Before any further runtime successor, a reviewed projection-binding contract must demonstrate all of the following together:

- Declaration admission capability is distinct from mandatory eligibility enforcement. No capability flag may bypass a carried obligation or silently substitute a weaker scheduler.
- One installed projection revision binds the exact participating ordinary payload to all contributing value, membership, lifetime and ordering proofs. Native proof transport and recipient-baseline composition are mapped for each source form; no collection-only guard or whole-source proof overwrite is sufficient.
- Replacing one authored fact replaces only its proof. Untouched and structural prerequisites remain; destination D cannot erase input I, possible W or validation V, even when owner identities overlap.
- Settlement triggers fresh ordinary evaluation and delivery without a public value event. Inspection display is excluded; old tickets/terminal receipts cannot regain permission. Queued and in-flight correction semantics remain distinct.
- Retirement and selected-inverse admission are supplied by qualified mechanisms, not assumed infrastructure. The current failures remain gates, including unavailable inspected inputs, whole selected installation and live-versus-obsolete negative records.

This is an acceptance boundary, **not a selected runtime representation or authority to bypass the stop**. The [prewritten collection matrix](ACCEPTANCE-MATRIX.md) preserves exact existing assertions and defines the remaining outcomes without executing an incomplete implementation. A smaller sub-check may establish a mechanism, but cannot qualify the complete collection path by excluding these obligations. No product-scope concession or new API is requested to explain this failure.

## Independent scrutiny and disposition

[Premise review](PREMISE-REVIEW.md) adjudicates approved coverage against exact records and failure artifacts. [Interpretation review](INTERPRETATION-REVIEW.md) separately checks the complete-path obligations and technical limits without receiving the new premise verdict. Root verifies claims against source and original logs; SOURCE.json records unchanged identities.

Retain the forward-removal work and reject integration. No runtime successor was started in this assessment. Production87f6831f, conservative hold, budgets and B closure remain unchanged. The previous report's phrase “unsupported source” describes implementation state only; it must not be read as contractual exclusion or as a need for repeated aggregate-API approval.
