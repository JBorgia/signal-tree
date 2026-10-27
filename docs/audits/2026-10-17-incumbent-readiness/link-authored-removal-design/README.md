# Authored removal responsibility: bounded design review

The review supports an **ordered authored-removal footprint** as a bounded mechanism to test. It does not accept another runtime candidate or lift entity integration's recurrence gate. Production remains `87f6831fa60cafe87508f0ace84b7638698ca3b0`; rejected `f7a0ffd9e2e34a23ceae85bff3cd8fa45ecaa82d`, its original failures and scalar predecessor `0135ef18567573fec627667fc58bc3e7819cc29e` remain preserved. B is closed.

## What the design resolves

An ordinary removal may have an empty **source ordinary delta** while still requiring a change to a connection that adopted the removed lifetime at creation. Neither source ordinary state nor a physical row snapshot describes that connection's authority.

[The design](DESIGN.md) preserves each native source step's authored footprint alongside its separate physical and ordinary effects. Publication consumes one ordered semantic stream. A removal targets collection/lifetime identity; it subtracts that lifetime from a recipient that contains it, leaves other recipients' payloads unchanged, and carries native publication obligations even when source O did not change. It never inserts an O undo contribution, copies inspected values, or turns selected physical relocation into authorship. Duplicate descriptions of one step may be represented once; distinct remove/re-add steps may not be erased by key or final-value comparison.

This clarifies A0's shorthand “apply its exact O delta” against A0's retained relationship-baseline and exact-authored-footprint requirements. The unchanged predecessor-passing counterexample supplies the concrete incompatibility; no new public semantic choice is needed for its ordinary lifetime removal. Frozen A0 and earlier assertions are not rewritten.

## Independent scrutiny and limits

[Premise review](PREMISE-REVIEW.md) independently establishes the existing behavior and available pre-install evidence. [Mechanism review](MECHANISM-REVIEW.md) challenges the first proposal against source and raw results without the premise reviewer's verdict. It finds the representation coherent for the two observed failures, but identifies two scope corrections:

- Native negative-evidence survival depends on obligation-aware handling of **both** lifetime retirement routes. It cannot be promised by admission changes alone. Current support may outlive native restoration; historical uncertainty cannot be erased to satisfy a zero-count assertion.
- No range of cases can be called qualified while selected-unit preparation, reentry, enrollment/disposal and support-only completion remain unexecuted or failing. Each capability needs its actual result.

Both are incorporated in the final design and [prewritten cases](CASES.md), then independently checked in [the correction check](CORRECTION-CHECK.md). [First proposal](DESIGN-FIRST.md) remains unchanged. [Central verification](ROOT-VERIFICATION.md) distinguishes verified source findings from execution and policy.

The recommended future scope is a **forward-removal and proof-preparation experiment** against the same unchanged assertions, using the shared source-step mechanism across ordinary producers and recipients. That is not authority to begin it. A complete native/entity claim additionally needs retirement survival, selected inverse atomicity, the newly approved unavailable-inspected-input owner hold, scalar/delivery composition and the remaining qualification ledger. Do not hide those dependencies in a projection-only pass count.

## Evidence and unchanged gates

[Prior rejection, first failures and exact replay](../link-entity-obligation-integration/README.md) remain authoritative execution evidence. This review ran **no models, tests, builds, benchmarks or runtime experiments**. Source/tree identities and unchanged-file hashes are in SOURCE.json; design/review hashes are in MANIFEST.json. No production hold, budget, public API or B disposition changed.

There is no new owner-policy question for the reproduced ordinary removal. New blanket deletion commands, broader setter domains, inferred hidden inputs or different lifetime restoration semantics are outside this design. If a successor needs them, it must present the concrete conflict rather than select them implicitly.
