# Membership evidence and fixed owner windows: bounded successor contract

Status: specification and prewritten tests only. Runtime implementation requires
separate owner authorization. Baseline is rejected
`2dacae7b9e9137018d05c4e00382ac9287bc76d4`; governing owner selection is recorded
at readiness `75c645eb71e4a03e5c84491ce8078debfe797e19`. Production stays
`87f6831fa60cafe87508f0ace84b7638698ca3b0`. B remains closed.

## Premises and boundary

Owner selection, AUTHORITY.md at readiness75c645eb:

> Approve bounded possible-owner hold

The question expressly approved a specification direction, not implementation.
The subsequent clarification requires:

> Capture the possible-owner set at authorship. Later unrelated transactions must not extend the hold.

> Owner settlement triggers fresh ordinary-state evaluation, even without a value notification. It must never release an old speculative payload.

Existing declaration SPEC.md (preserved in link-declaration-examples) permits a
new coherent ordinary-state evaluation after rejection. It does not require a
new setter, confirm a rejected proof, or revive a terminal receipt. Physical
inspection display is not ordinary publication authority. Complete declarations
assert all hidden application inputs; instrumentation cannot prove omissions.

The successor must replace the missing native-input domain and delivery-time
fallback decision, not add another value or settlement engine. Private metadata
describes incumbent facts and obligations. It cannot decide rollback ownership.
No new public API, automatic async context or arbitrary getter tracking is in scope.

## Distinct records

| Record | Authority and identity | May block |
| --- | --- | --- |
| Native fact requirement | Source identity, fact kind, immutable installed revision, view, lifetime/occupancy where relevant | Every projection containing or consuming that fact |
| Shared validation obligation | Synchronous declaration execution, including enclosing validation and return-value getters | Relevant nested publication across connections |
| Possible-owner window | Immutable owner identities pending at authorship of an unobserved undeclared revision | That revision and projections containing it; not evidence of actual consumption |
| Recipient permission/uncertainty | Connection and projection revision | That recipient only; passive enrollment cannot contaminate others |
| Delivery ticket | Exact projection/support revision, current ordinary payload evaluation, applicable obligations | One queued or started delivery; cannot authorize a replacement payload |

Owner identities must not alias across trees or lifetimes. Terminal outcomes are
immutable. A retired registry entry is not a successful terminal outcome.

## Admission and fixed-window lifecycle

1. Prepare the exact authored facts and source input descriptors privately using
   the existing native operation. Include membership changes when values are equal.
   A real ordinary no-op creates no authored value revision; support-only changes
   still install a private support revision without forcing public value events.
2. A complete valid declaration supplies application completeness for its authored
   facts. Native lower-bound dependencies and enclosing validation still apply.
   Native updater arguments alone do not certify other callback inputs.
3. Unobserved undeclared authored facts capture currently pending instrumented
   owners at the native authorship boundary. The snapshot must match the validated
   operation immediately before its callback-free installation. If preparation
   reentry changes owner/source epochs, use existing pre-install validation and
   reprepare metadata without replaying the user updater or inventing a new refusal.
   A conflict requiring different public semantics stops implementation.
4. Install fact metadata, immutable window and reverse owner wake links with the
   authored unit before any completion/delivery can observe it. Preparation failure
   installs none of them. A recoverable post-install error retains coherent state,
   responsibility and usable recovery. Process-level out-of-memory is not covered.
5. Delivery never samples a new global owner set. A later unrelated owner q cannot
   enlarge revision r's window, including if q opens before r's first Link flush.
   Existing local transaction gates, actual native/structural dependencies and
   incomplete validation remain separate blockers; this rule does not erase them.
6. Each captured owner's terminal transition wakes affected current tickets through
   indexed reverse links, without needing a value notification. With other captured
   owners pending, hold. Successful rejection invalidates prior proof; when all
   applicable gates clear, evaluate fresh ordinary truth under a new ticket.
   Confirmation also requires a current coherent evaluation, not permission to send
   the admission-time payload. Abandoned/unavailable authority stays conservative.
7. A replacement write creates its own input evidence/window. It retires current
   references to the overwritten facts, not other aggregate fields, active inverses
   or started sends. Old wake callbacks check exact identity/revision and cannot
   resurrect an obsolete ticket or terminal receipt.
8. Before endpoint invocation, validate payload, support and validation revisions
   after synchronous reentry. Started requests remain serialized; newer eligible
   truth follows an already-started obsolete request. No cancellation guarantee is
   introduced. Held work cannot strand later eligible work.
9. Connection disposal cancels its queued/wake registrations, completes waiters
   under the existing disposal contract and prevents later sends. It cannot retire
   source facts or shared obligations owned elsewhere. Tree destruction preserves
   the existing distinction from explicit connection disposal; disappearance cannot
   confirm dependencies. Retained terminal receipts retain their result only, not
   an accidental source/connection/historical-payload graph.

Literal writes, raw cross-tree copies and undeclared updaters with hidden reads all
use the unobserved class. Classifying the first as committed merely because no
instrumented getter ran would recreate the proven leakage. Qualified declarations
can provide useful immediate progress despite unrelated pending owners. Unknown
declarations deny declared permission; ordinary fallback obeys applicable native
evidence and the approved unobserved/recipient-uncertainty distinction.

## Native membership and supplied-input domain

The reviewed INPUT-MAPPING.md at readiness75c645eb is incorporated as the source
mapping. Its historical policy-pending text is superseded by the owner selection.
The native source owns positive and negative membership obligations independently
of Link registration. Visible Object.keys is not a sufficient evidence domain.

| Supplied/read fact | Required description |
| --- | --- |
| Value of present child | Value revision, containing presence/ancestor facts, view |
| Absent-key lookup / hasOwn / in on a native supplied snapshot | Parent domain and relevant negative occupancy; absence is observable input |
| Enumeration / spread / entries / updateAndReport | Exact supplied snapshot domain, including omitted members' live obligations and order |
| Collection get / membership / ids / all / count / empty | Collection incarnation, membership/lifetime and order facts actually supplied |
| Selection / activeEntity | Selection plus occupancy and selected lifetime |
| Held entity reference | Its acquired lifetime; never retarget by reused business key |
| Native sorted/filter input | Domain actually supplied to comparator/predicate; external inputs still need complete declaration |

These are requirements for native producers, not a claim that arbitrary JavaScript
property reads become tracked. Saved objects, booleans and values used later remain
hidden application inputs. Entity provenance is not qualified by scalar tests.

An addressed slot uses parent/key/occupancy identity. A source-owned domain index
retains relevant negative obligations through omission and sibling overwrites.
Superseding a negative fact retires only its current reference; historical inputs,
inverse/recovery and in-flight obligations keep their exact versions. There is no
record for every nonexistent spelling and no scan of all registered trees per write.

Snapshot value and descriptor must refer to the same supplied view/revision,
captured before invoking the updater. Preserve actual cached callback arguments
and framework timing. Do not replace unwrap with the capture-only reader merely
to obtain a newer argument. Support-only changes refresh certificate association
when the same current view is established; otherwise retain its correct historical
descriptor or unavailable coverage. Never silently combine stale physical input
with current ordinary proof. Dormant payloads are not inputs merely because their
slot survives. Inspection adoption retains the approved physical/ordinary split.

## Two separately accountable repairs

Registration: native membership preparation must compose with optional private
participants. Prepare every admitted record before installation, install the
composed unit, then complete it. Define deterministic participant order; disposing
an optional participant cannot unregister native evidence. Failure at either side
of native preparation changes neither membership nor responsibility. The original
three ordinary-member-publication-facts tests remain unchanged, with useful retry.

Mixed undo: source installation chronology must survive deferred point publication.
An older sibling notification arriving after callback-authored state cannot replace
newer ordinary projection evidence. Preserve unaffected parts and deliver their
completion even if another part is superseded or a callback throws. Do not reread
a whole physical row into ordinary truth, suppress the complete operation, or add
a flush. Original heterogeneous-reentry-publication and invalidation controls are
mandatory; reverse row order, disjoint-field reentry and queued/in-flight cases
must exercise the same revision/footprint mechanism.

These repairs have distinct causal evidence. Neither is credited to absence input
capture, and success on one does not waive the others.

## Finite implementation gates if authorized

| Gate | Required evidence before proceeding |
| --- | --- |
| Native evidence + authorship | Unchanged omission falsifier, new membership/window cases, atomic preparation/reentry, unchanged scalar membership controls |
| Admission/delivery composition | Corrected enrollment16 and original history retained; native provenance, nested validation, inspection, ABA, stale delivery, fixed late-owner progress |
| Separate compatibility repairs | All three registration cases and mixed undo useful-publication regression; fault and chronology siblings |
| Lifecycle / work | Indexed wake and retirement; repeated churn, retained receipts, multiple connections, live recovery; source and connection destruction separately |
| Combined qualification | Exact test/source manifest, types/spec-types, all bounded vectors together and four-framework composition; no unsupported observation relabeled success |

Prewritten executable tests and inherited paths are listed in TESTS.md. Baseline
red results are expected evidence, not qualification. Do not change old assertions.
New fixture mistakes may be corrected only with a recorded contract basis and the
original source/results retained. Review the concrete spec/tests before runtime work.

Measure source-install, descriptor-acquisition, owner-window acquisition, reverse
wake, fanout and retirement separately. Capturing k current owners may cost O(k);
it must not enumerate unrelated stores or settled history. Full native snapshots
may cost O(supplied domain + relevant negative facts); point work and cleanup must
not scan an unrelated collection. Test fixed local change at increasing collection
sizes, many settled owners, repeated negative membership and staggered recovery.
No production CPU/heap/size claim is made before equivalent capability qualifies.

Stop for recurrence in an already-covered mechanism, a new public semantic choice,
required API/architecture expansion, or a genuine verification blocker. Missing
coverage in an explicitly unmigrated producer is work to do, not a passing result.
Do not integrate caller-specific exceptions. Broad suites/artifact costs follow
only after focused combined qualification; their results cannot be inherited from
prior rejected sources. Existing budgets are unchanged.
