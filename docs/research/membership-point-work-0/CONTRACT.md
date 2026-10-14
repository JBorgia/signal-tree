# Point responsibility preparation without inventory scans

Preserve evidence 90738bbe8a77aaf4dacad988aa3274685fed27bf and the separate
publication OAP candidate. Exact runtime baseline is 19a5bd034d5ebef262f637c397bb41fe50a6a1e3.
The prior approval rejection and unexecuted broad suites remain historical
not-executed records, not test failures. Broader verification is gated on the
unchanged membership tests, prior focused controls and affected Nx suites.

The existing zero-scan contract applies to fixed point mutations while a
membership reader observes. D.patch currently snapshots active keys on every
commitEntityFrame solely to find the pre-install tail subject. Only a fresh
subject's structural responsibility record uses that initial tail; updates,
rekeys and removals do not. Removals already obtain neighbors from the indexed
neighborSubjectsForKey path; before values and subjects have existing indexes.

I1 hypothesis: if the frame contains a create-fresh-subject instruction, read the
existing lastActiveKey pointer and resolve its subject through the existing
key index before record cloning. Keep the existing per-frame tail advancement for later fresh
instructions. This preserves the exact pre-install tail fact, including empty
collections, mixed frames and reused keys, without allocating an inventory.
Do not change responsibility admission, order facts, capture/settlement policy,
publication or the zero-scan assertions. No new API, cache or owner index.

Measure four fixed point writes across increasing collection sizes. Attribute
snapshot calls to callers and distinguish cache hits from linked-list walks;
report keys visited, indexed queries and touched mutation instructions. Seed,
reader activation, validation and settlement are separately identified phases.
Capture-active and no-capture controls must both perform useful writes. These
are source-instrumented work counts, not package-size or timing measurements,
and do not prove absence of every possible collection-sized cost elsewhere.

Premise review before first execution refined the initial lazy-read sketch:
sample the indexed tail before any per-record deepClone, at the same boundary
as the original snapshot. The fresh-instruction check is proportional to the
frame, not collection size. Retain original pre-state anchors even if that tail
is removed earlier in the staged frame; do not substitute a surviving tail.
