# Membership observation and fallback: reviewed design, policy selected

Read-only investigation completed against rejected runtime
`2dacae7b9e9137018d05c4e00382ac9287bc76d4`, from readiness
`6ebe0901323020e629819b1f753a2e1be27dfbef`. No runtime, assertion, API or budget changed;
no tests or benchmarks were rerun. Production87f6831f, conservative Link and closed
B remain unchanged. The recurrence stop remains active; no successor is selected.

## Findings

The [source inventory](SOURCE-READ-INVENTORY.md) covers ordinary key lookup,
existence/reflection, enumeration, scalar/branch/root/updateAndReport input,
collection membership/order/selection, same-key new lifetimes, cached snapshots,
framework carriers and retained/asynchronous values. It distinguishes currently
observable native-supplied inputs from arbitrary application consumption.

The snapshot builder already observes dormant children for reactive invalidation
while omitting their values. The rejected provenance walker separately enumerates
only visible children. Input certification therefore needs the membership domain,
including negative facts, not another visible-value walk. Conversely, importing
all dormant payloads would overstate what the input contains.

A native argument certificate does not certify every callback input. Undeclared
`target(old => source.x())` still consumes an unobserved foreign value just like
`target(source.x())`. Updater syntax alone cannot make fallback safe. Complete
application declarations cover hidden inputs under their approved responsibility;
recipient coverage remains a separate concern.

The proposed [input mapping](INPUT-MAPPING.md) assigns slot occupancy and negative
membership-domain obligations to source owners, with certificate revisions paired
with installation and cached input views. It preserves separate physical/ordinary
facts, lifetime identity, exact historical descriptors and reference-based retirement.
No public lookup, wrapper or new snapshot API is introduced. Collection input
ports and native qualification remain implementation obligations, not covered passes.

Cache certification must not change the callback's existing argument. Native branch
updaters use materialized snapshots; the capture-only fresh reader cannot replace
those arguments merely to obtain simpler proof. Equal support changes need private
certificate revision updates without forced public value events. Framework computed
and effect timing remains framework-owned.

## Fallback and delivery

The exact previously executed comparison remains:

| Version | Before confirmation | After confirmation |
| --- | --- | --- |
| Predecessor82127362 | Holds the pending foreign copy | Fails to deliver |
| Rejected successor2dacae7b | Publishes prematurely | Later assertion not reached |

Source trace explains the two boundaries. Predecessor project() records possible
blockers without connecting that projected revision to ownerWake's dependent index.
Successor project() drops blockers and reaches the empty local gate. Removing a wait
is not the same as safely waking it. [Separate failures](SEPARATE-FAILURES.md) also
account for the exclusive membership-registration collisions and old prepared-row
delivery after reentry; neither is repaired by absence certification.

The [design](DESIGN.md) separates certified native input, recipient uncertainty,
known foreign support and unobserved origin. The [policy decision](POLICY-DECISION.md)
now records the owner-selected option: a fixed possible-owner hold for unobserved undeclared
writes, with exact-revision wake/retirement. It is not proof of actual dependency.
It would delay some unrelated literal writes while foreign owners are pending.
Qualified complete declarations retain conditional progress; unrelated recipient
uncertainty does not become a global hold. No per-write scan of registered trees is
proposed. Possible-owner index/capture cost still requires measurement.

**Owner selection is recorded in [AUTHORITY.md](AUTHORITY.md):** approve the bounded
possible-owner hold. This qualifies tree-local liveness for unobserved undeclared
origins; the additional tracked-execution alternative is not selected. Approval
covers specification only, not runtime implementation, API acceptance or activation.
The reviewed design and first review files remain unchanged historical records;
the authority record supersedes their pending-selection wording.

## Rejection does not need another policy decision

Root checked the exact approved A0 rejection rule and declaration examples.
After actual gates clear, completed rejection permits a new evaluation of coherent
current ordinary truth, including the same surviving numeric value. The old
speculative ticket never gains confirmation. Fresh authored replacement is a
permitted recovery route, not a prerequisite after every successful rejection.
Unavailable/abandoned evidence or registry disappearance remains distinct from
successful terminal settlement.

Both independent reviewers initially treated this conditional rejection case as
another policy question. Reading the explicit prior examples corrected that
interpretation. Their original reports remain in the FIRST files; the final
[policy premise review](FALLBACK-PREMISES.md) and [design review](DESIGN-REVIEW.md)
state the correction. Original test expectations and prior outcomes did not change.

## Review and remaining gates

Independent source inventory, independent fallback-premise review and independent
design/correctness review addressed distinct questions. The design reviewer did
not read the new fallback verdict. Root independently checked the snapshot/cache,
Angular carrier, physical membership path, lifetime resolution, exclusive port,
mixed-undo publisher, wake index and governing rejection records. Review claims
are source-derived; no new runtime trace is represented as an executed finding.

Review found the corrected input mapping coherent for bounded implementation
planning, with explicit unknown entity coverage and costs. The owner has now
selected fallback admission, but specification-only approval does not authorize
a runtime successor or clear the recurrence stop. A future successor must preserve
all unchanged falsifiers and cover enrollment, native membership inputs, lifecycle,
cache support changes, inspection, queued/in-flight sends and useful wake together.
The collision and mixed-undo gates remain separate. No stronger performance,
collectibility, full-suite or release claim follows.

[Original source, failures and exact replay](../link-evidence-scope-successor/README.md)
remain in the previous archive. Source identity and first/final design/review files
are preserved here; SHA256SUMS covers this packet. Unrelated guidance and measurement
edits in the readiness checkout are preserved.
