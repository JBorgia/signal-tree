# Closed continuation cleanup — bounded acceptance

Exact successor manifest: `d3b6da2906ae9cef72e5623b35eb6de3dee73d64b12f5c9bd408352aa627e73b`.
[Independent review](independent-review/REVIEW.md) accepts this narrow cleanup.
The source, behavioral/GC evidence, first harness/type failures and limitations
are in [the author report](RESULTS.md).

Forwarding references are cleared on closure while a separate dispatch receipt
preserves caught preparation failures. The unchanged139 and nine new behavioral
controls pass. Independent review reran the nine and six matched Nx GC processes.

Callback-only retention disappears for the sampled receiver objects in success,
skip and caught-failure cases; explicitly held rows/values retain their ownership.
This is not a universal heap or native-framework reclamation claim.

This improvement is based on c47b. Broader verification has identified a hidden
collection rollback regression in that underlying integration. Cleanup acceptance
does not waive it or authorize activation. Both source identities remain frozen;
no runtime package in the production checkout changed.
