# Server review-binding fixture

This separate in-memory server gate demonstrates the additional policy needed
when a product requires server-verifiable review consent. The existing dispatch
backend checks permission and versions; that alone does not enforce review.

`reviewAuthority` accepts a host authentication predicate and issues an opaque
random token bound to the exact immutable command. Application of a different
command, invented client approval fields, or an unauthenticated reviewer context
cannot use that grant. Application still passes through backend permissions,
version preconditions and idempotency. Retrying the same authorized command uses
its existing backend receipt.

The authentication predicate is a trusted fixture seam, not a production identity
system. Tokens, grants and command receipts are in memory. This is not durable,
cryptographic remote attestation, HTTP authentication middleware, human-presence
proof, a published SignalTree API, or a claim of production backend integration. Twelve standalone controls pass
independent security review. The browser reference now uses the same gate; its
independent integration review remains separate.

The approval table is explicitly capped and supports revocation/disposal. Revoking
a grant prevents subsequent use but cannot undo a command already applied. A lost
acknowledgment must retain its grant or use an application-authenticated status
query; do not destroy the grant merely to reduce retention while responsibility
remains. The backend fixture still owns separate idempotency receipts.

```sh
node --test tools/experiments/multi-actor-operations/authority/*.test.mjs
```
