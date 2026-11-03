# Experimental projection freshness argument (P3)

Owner authorized an experiment after `447013c0`; API acceptance is not granted.

`createReadonlyCell<T>(compute: () => T, isCurrent?: () => boolean)` accepts an
optional kernel-owned predicate. It answers whether the last successfully
computed projection reflects the collection's current published version. False
also covers an uninitialized projection. It is a read-only query, not an
invalidation, scheduler, notification, or permission to publish. The kernel
supplies it only to versioned collection projections, using the same version
and initialized state as their existing compute cache. Successful compute brings
that cache current; throwing compute must not mark it current.

A realization may consult the predicate on an owned cell read while delivering
queued invalidations, after its grouped callback has exited. If native evaluation
already made the projection current, preserve its result and identity. If the
predicate says stale, evaluate the supplied compute and retain that successful
result until native computation catches up. Do not refresh merely because an
unrelated invalidation is being delivered. No background sweep or eager callback
is introduced. Predicate/compute exceptions propagate through the existing read
and first-failure delivery rules; successful siblings still receive invalidation.

Reentry: delivery can enter a nested grouped callback. During that callback the
adapter does not invoke the predicate or force compute; a held projection retains
the previously visible cached value under the existing group contract. Once the
nested body exits, its delivery may consult freshness again. Delivery depth must
be restored even if read, predicate, computation or notification throws. No
freshness guarantee is added to application-owned native computed values.

Omitted argument: exactly the existing native readonly realization and its native
memoization/dependency semantics. Existing one-argument implementations remain
assignable and callable; implementations whose publication is already coherent
may ignore the optional predicate. Neutral runtime keeps its existing synchronous
dependency invalidation. Angular, React and Solid preserve existing realizations
unless an unchanged acceptance test falsifies them. The port carries a kernel
projection-cache fact; framework scheduling remains framework-owned.

Acceptance requires unchanged publication, P/P2 killer controls, four-framework
coherence, neutral/fake and legacy-adapter compatibility, type tests, D2's thirteen
controls, then independent review before broader verification. This document
specifies the experiment before implementation; it does not claim survival.
