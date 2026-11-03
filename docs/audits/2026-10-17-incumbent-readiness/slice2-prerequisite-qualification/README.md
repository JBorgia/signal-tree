# Slice 2 prerequisite qualification — bounded gate closes

October 25, 2026. Continues the [native Link address checkpoint](../link-native-address/README.md)
at `e1847393c1478b7a30b73986d04f8a648887e409`. Production remains
`87f6831fa60cafe87508f0ace84b7638698ca3b0`; B remains closed. Runtime changes below
exist only in isolated experiment overlays. No activation, public API/semantic
change, ceiling increase, merge, push, tag or release.

## Gate and preserved limits

The approved [plan](../semantic-transition-plan/README.md) requires W4–W8 structural
composition, useful inverses, selection, callbacks and staged preparation—not merely
a larger pass count. Independent inventory found E2 staged setAll, E4 selection/order,
E5 lifetime, E6 replay taps and E10 large-batch compatibility omitted from the prior
46-file vector. They now execute against the candidate. Both original 130,000-row
shards pass without changed inputs/assertions/timeouts. Source identity and reviews
support closing this bounded slice-2 gate and continuing the authorized slice-3 audit.
This is not combined integration, Link API acceptance, release or cost acceptance.

The one original replacement/no-op test remains red and unchanged: explicit full-row
replacement adopts inspected 99, followed by an identity updater; expecting no send
conflicts with approved adoption. Its c0f55f0d disposition remains a test-contract
mismatch. Identity-only controls pass. Neither this red nor earlier first failures
are deleted or converted into an expected pass. The scoped derive repair does not
retroactively restore the old blanket slice-1 acceptance.

## Four separately preserved corrections

1. **Marker retention.** Both unchanged retained/dropped-receipt witnesses first
   collect 18/20 objects. The first tree and current payload remain reachable through
   `MARKER_PROCESSORS → create closure → entityMap invocation context → combined →
   config → selectId → tree`. Strong-path extraction excludes weak/ephemeron edges.
   Moving the unchanged registration body into a private module-level helper, called
   at the same lazy first-use point, removes the instance context. Distinct config/
   computed-slice review passes; no first-config binding or import-time registration.
   Final witnesses collect 20/20 in both arms, retain the live positive control and
   deliver all four useful sends. This closes the measured lexical retention path,
   not universal GC qualification or a receipt-only leak claim.
2. **Prepared key lookup.** `EntityMutationFrame.preparePlacement` scanned staged
   rows for every supplied order key: N(N+1)/2 visits. One private map of final staged
   present keys reduces the measured visits to N. First-match and strict key behavior
   are preserved, including NaN exclusion and numeric/string distinction. The map is
   only allocated when a prefix/full order needs it; no live occupancy authority.
3. **Prepared ordinary-anchor lookup.** Fresh admission repeatedly walked future
   physical rows not yet ordinary. Measured placement reads were N²+13N−4. A lazy,
   transient index over connected prepared physical-patch runs answers against
   sequential ordinary visibility, updated after each occupancy edit. Excluded
   subjects remain hard stops; outside-patch and cyclic fallback preserve the old
   guarded walk. The same workload now reads 14N−3. Construction is O(patch); indexed
   updates/queries are logarithmic. This is not a global linear-settlement claim.
4. **Pending addition lookup.** E10 rollback still rebuilt the remaining-subject set
   every iteration. An occurrence-count map preserves pending membership until the
   last repeated subject is removed. Measured structural-add map entries fall from
   N+N(N+1)/2 to N. Anchor priority, readiness scans, array placement and refusal
   branches remain unchanged. Other indexOf/splice costs are not declared linear.

All indexes are private preparation scratch; no independently writable state,
transaction ownership or publication eligibility is added. Physical and ordinary
facts remain separate. Full-input operations may process their supplied rows;
no point-path full-store index is introduced. The prior prepend 4N versus 2N snapshot
tradeoff remains explicit and unaccepted as an overall cost conclusion.

## Exact evidence

| Final execution | Result |
| --- | --- |
| Focused 61-file vector | 695 passes / 1 preserved contract mismatch, 696 cases |
| Original entity-large-batches | 11 passes; 130,000-row membership and undo/redo included |
| Original v16 large-batch controls | 16 passes; 130,000-row notifier and rollback/key-reuse included |
| Retained/dropped receipts | One final run per arm; 20/20 collected each, useful sends/live control pass |
| Source types / spec-types | Pass; existing ratchet not modified |
| Lint | Final new target/spec:0errors/0warnings; cumulative changed paths retain 3 existing entity-signal warnings |

The 63 files contain 722 passing cases and the one preserved mismatch; overlapping
intermediate runs are not added. E10 durations 29.94s and 48.66s are test execution
observations, not matched CPU/heap benchmarks or performance acceptance.

First vector:115 passes in7 files;27 large cases incomplete after 376.54s, with two
worker-termination errors. A key-index-only large attempt remained incomplete.
Anchor-only E10v16 recorded 1 pass / 15 incomplete after task termination at 369.25s.
These were deliberate stops after deterministic work traces, not assertion failures.
New key-work controls first fail 6/7; anchor-work 4/4 and pending-work 4/4 fail before
their respective fixes. Original expectations remain intact. Initial new-test
iterator typings/lint diagnostics and exact first bodies are preserved separately.

Independent reviews cover marker lexical capture, strict key lookup, sequential
visibility, duplicate pending subjects and gate interpretation. Visibility reference
checks match 180,000 queries; the placement comparison matches 20,000 exact order/error
cases, including 17,101 duplicates. An incorrect early-delete mutant fails. Root
replayed the placement comparison and checked loaded identities. Synthetic private
cases support mechanism equivalence; they are not new public malformed-input promises.

## Source, archive and remaining work

Final 803-file TS/TSX manifest SHA256:
`67869b6525433a7ad5fceb88042cf25b50d2d90d045408a249b2f673aae3caf9`.
Frozen source: `/private/tmp/pending-set-candidate/candidate`.
Parent 798-file manifest:
`16d33224f969b9e284e61c8affbacd544d1ebfba6397ae69f9a3cb2030008935`.
Archive retains each cumulative marker/key-index/anchor/final overlay separately,
full manifests, diffs, source/loaded input hashes, first results, commands and reviews.
The final overlay changes five runtime files and adds four focused specs relative
to the frozen Link candidate; manifest/diff is authoritative.

[Evidence](evidence.tar.xz), [archive hash](ARCHIVE.sha256),
[member hashes](MEMBERS.sha256). COMMANDS.md inside the archive gives exact replay
vectors/toolchain. Raw process heap is retained locally with path/hash in
EXCLUDED-RAW-HEAP.json; only relevant extracted retaining paths are archived.

Slice 3 must still audit S3–S6/W9–W11 realization, hidden state and retirement; slice 4
must establish full composition/four-framework behavior and lifecycle; slice 5 needs
exact-source full verification, installed artifacts, demo and cost acceptance.
No broad suites, new package/demo measurements, ceiling changes or production sign-off
are inferred from this gate. Later runtime changes require their own qualification.
