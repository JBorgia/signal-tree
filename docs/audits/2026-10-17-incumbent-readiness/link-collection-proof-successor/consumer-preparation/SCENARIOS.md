# Finite order-workflow acceptance specification — preparation only

Frozen inspection source: 75416029be1e0c1d9735ed3bdc0f4e8e6c02f775 at
/private/tmp/link-authored-removal-successor. Runtime recurrence remains active.
No scenario here lifts that stop. The HTTP endpoint alone has executable tests.
The Angular consumer has no installed candidate artifacts and is not qualified.

Target demo: one order PO-42, W1 Inspect scale / W2 Schedule truck; list, detail,
selected id, transaction inspection, request log and server state. Follow existing
Angular demo factory + ops/facade pattern; use native leaves with `.set` and
component DestroyRef calling `destroy`. No private diagnostics or Studio UI.
Public inspect changes describe contribution status; visible values are separate
ordinary reads. The fixture keeps selected business key; removing/rekeying it
makes selection undefined until user chooses a current row. A reused id must not
reanimate a retained old entity reference; that remains an explicit assertion.

Gate before consumer execution: install exact candidate Angular/kernel tarballs,
record their SHA256 and package contents, use ordinary compiler/bundler settings,
then run this finite table. Stop on the first unexpected runtime result and retain
request trace/source identity. Missing capability is BLOCKED, never PASS. A rendered
Angular mount/unmount is still required later; this is not browser qualification.

| ID | Actions and required observation | Current disposition |
| --- | --- | --- |
| W0 | Start fresh endpoint and workflow. Select W1. Check two rows and no implicit initial write. | Not executed; installed package gate missing |
| W1 | Propose W1 title=Reviewed under owner A. Ordinary UI sees proposal; no HTTP payload containing title while A pending. Inspect actual A handle. Confirm A; without new edit one complete current items payload arrives and is acknowledged. | Not executed |
| W2 | Propose W1 title=Discarded, reject. Live title restores and endpoint never receives Discarded. A thrown rollback remains a refusal with same pending handle available; never display it as rejected. | Not executed |
| W3 | A pending W1 title; explicitly declare independent W2 status=scheduled on the same relevant Link/owner tree. W2 progresses only when aggregate prerequisites permit; W1 remains held. | BLOCKED: public Link lacks declare |
| W4 | Required A and later unrelated B pending; settle final required A. Correct ordinary payload arrives without another edit while B remains pending. Execute both owner orders. | BLOCKED: declaration capability and runtime stop |
| W5 | Add W3, remove W1, recreate W1, change W2 key to W20, reorder via setAll. Assert complete values/membership/order and stale held-reference lifetime. Confirm/reject in separate resets, not a combinatorial suite. | Source actions prepared; not executed |
| W6 | Arm hold; confirm update R1 and observe actual held request. Author/confirm R2 while R1 held. Release R1, require corrective R2 delivery. Separately fail next request before apply, show failure even though Link.settled resolves; retry must follow reviewed supported policy and server trace. | HTTP controls tested; Link delivery and retry unqualified. retryFailed throws BLOCKED |
| W7 | Destroy with one held request and pending transaction. Abort is client cancellation, not server rollback. Release held request or observe disconnect; no app status mutation after destroy. Remount new workflow. | Endpoint shutdown tested; consumer lifecycle not executed |

No polling timeout can establish a negative publication claim alone: install
controlled endpoint observation and library-defined scheduling boundaries before
checking absence; every scenario also requires a useful positive delivery. A
request observed in the endpoint log is received, not acknowledged/applied until
its outcome says applied. Server fixture fails before apply only; lost-ack-after-
apply and durable reconciliation remain untested. Server replacement snapshots
follow release order and do not implement CAS or deduplication. This deliberately
exposes stale correction obligations rather than claiming to solve them.

Retry policy is not silently invented: the frozen public Link interface has no
retry operation. A direct replay from the application could bypass current
eligibility or replay stale data. Do not add it merely to make W6 green. A later
integration must demonstrate the supported retry trigger or approve and test an
explicit safe reconciliation policy. No automatic effect-scope/async provenance
promise is added.
