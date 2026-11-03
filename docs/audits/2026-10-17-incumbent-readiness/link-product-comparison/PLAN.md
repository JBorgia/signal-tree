# Preregistered comparison slice

Baseline d7b538610684eb6a4a356820fb9cdd08be71840d. Research only. No API selection.
Automatic projection/taint arm reuses preserved failures, not rerun for favorable counts.
Control current Link reuses exact-source pending-hold probe. New tests exercise
actual neutral kernel with application-owned in-memory publication and draft glue.
They are not candidate production APIs, durable outboxes, or four-framework qualification.

Expected before execution:
O1: direct explicit independent outbox entry sends during pending proposal; owned
multi-hop payload remains queued and is cancelled after successful rollback.
O2: entry needing two owners cannot send when only one confirms; both confirmation
allows one coherent object. Owner labels explicitly supplied by application.
O3: replacing queued intent with independent intent removes old responsibility;
unknown-origin entry remains held; deferred owned entry rejected before drain cancels.
O4: endpoint rejection retains entry for explicit retry; destroy abandons local
queue explicitly and disallows further admission. No durable delivery guarantee.
D1: isolated draft and draft-local multi-hop edits never enter live tree; unrelated
live write reaches ordinary Link during review. Discard leaves live fields unchanged.
D2: reviewed multi-field batch installs through actual transact/confirm; ordinary
root Link sends complete object, no partial pair. Application accepts one batch.
D3: deferred draft work with captured generation cannot apply after discard.
Untrusted application copying draft into live anyway can publish it: explicit
negative control shows isolation is a usage boundary, not information-flow security.

All cases must assert useful sends and/or queued/cancelled dispositions. Always
destroy trees. Failures preserved. No CPU/heap/byte ranking from this research code.
For eight common discriminators, mark missing production behavior unknown rather
than awarding an aggregate pass. Visibility differences are not failures by themselves.
