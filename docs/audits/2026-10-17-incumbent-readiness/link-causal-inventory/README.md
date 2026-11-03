# Declared-Link causal inventory and bounded repair plan

October 20, 2026. Source checkpoint `abb35d324192ad1496cf06569f0108598c8b03fd`.
Production runtime remains `87f6831fa60cafe87508f0ace84b7638698ca3b0`.
Candidate remains rejected. This is source analysis and a preimplementation plan,
not a repaired implementation or a new API selection. B remains closed.

## Evidence and premises

The unchanged [qualification ledger](../link-declared-qualification/README.md)
contains executable failures, exact frozen inputs and replay commands. No tests
were rerun for this inventory. Its actual undefined payload must not be confused
with the JSON array encoding null. Its metadata counts are not heap measurements.
The independent source inventories below retain file/line anchors and distinguish
source facts, preserved execution evidence and design inference.

At this checkpoint the [approved experimental proposal](../link-api-proposal/PROPOSAL.md)
states: “A receipt observes one admission, not the connection's transport history.”
It also states: “Holding receipts must not retain whole trees/transaction handles after terminal compact state can replace them;
dropping a receipt does not cancel pending connection work.”
And: “If callback also throws, preserve its exact value including primitives/frozen objects.”
The owner-authorized adoption rule remains ordinary7, inspection99, explicit
transactional99 adopts ordinary99; rollback restores ordinary and physical7.
Publication declarations do not alter transaction ownership.

## Causal inventory

| Failure | Located loss | Required boundary; limits |
| --- | --- | --- |
| Entity field sends undefined | Helper keys facts by tree:firstPosition; loader omits subject/field and assigns raw receipt payload directly to eligible. Native Link instead validates subject, field footprint and participation, projects captured row, and ignores valueless pings. | Bind native source identity and projected payload together. Adding a key dimension alone or rereading inspection-visible state is insufficient. |
| Entity inspection adoption | Field setter calls updateOne, then existing-subject installation captures the physical backing row. Scalar inspection baseline patch does not cover entity storage or frame installation. | Ordinary-before facts at existing paired entity preparation/installation seams; cover fast and frame routes. This is native admission work, not a Link receipt fix. |
| Receipt terminality | status() consults any global active scope before its own started flag. | Receipt-local monotonic terminal observation; later scopes cannot reopen it. Existing witness changes diagnostics, not an already-started send. |
| Source validation | Loader adds declare to every connection; declaration validates owners/disposal, not supported source kind. | Unsupported aggregate declaration fails before callback; supported entity scalar retains lifetime-qualified identity. Stale-source behavior needs its own test; aggregate rejection does not establish it. |
| Secondary errors | catch invalidates frames then rethrows callbackError, discarding the contradiction; helper has no reporter binding. | Existing diagnostic reporting within the still-open validation horizon, preserving exact primary value and recovery information. Reporting listener safety was unexercised because it never ran. |
| Retention | sources, outcomes, records, latest and completed have no complete ownership/retirement transitions; dispose is empty. Strong Fact keys keep weak-map permission values reachable. | Explicit obligations and terminal compaction. Eight drained cycles add16 sources/records/completed entries,8 outcome maps; listeners return0. No live obligation was demonstrated for those drained records. Held-receipt GC is still unmeasured. |

These are not six manifestations of one proven bug. Two missing contracts in the
private helper—native projection identity and operation lifecycle—organize most
of them. Entity ordinary-truth adoption is an additional native installation
coverage gap. One universal raw-notification record cannot substitute for those
storage/projection semantics.

## Shared internal contract to test

Use existing native source identities and paired installation seams. No public
surface expansion, new settlement authority or permanent current-state mirror.

1. **Bound source:** connection plus native owner/location; entity sources also
   carry non-retargeting subject lifetime and field. Validate supported source
   before invoking work. Removal, same-lifetime restoration and new-lifetime
   replacement are separate events; never derive identity from business key.
2. **Projected revision:** native participation/footprint interpretation supplies
   an immutable payload plus source and responsibility revision. A ping can
   invalidate evidence but cannot become payload. Inspection alone cannot mint
   ordinary publication authority. Responsibility ABA refreshes without forcing
   value notifications. Existing aggregate Link behavior remains compatible.
3. **Admission operation:** owns only its revisions, immutable dependency identity,
   enclosing validation obligations and diagnostic outcome. Early publication waits
   for relevant enclosing validation and reporting reentry to finish. Hidden-input
   completeness remains application responsibility.
4. **Delivery obligation:** binds one exact eligible payload/revision at preflight.
   A superseded queued revision cannot start; started work may finish and require a
   serialized correction. A receipt reaching started stays started, independently
   of later delivery errors, retries or other declarations.
5. **Terminal observation:** detach compact receipt status from frame, payload,
   source closures and transaction handles when no longer required. No-write,
   superseded and disposed transitions need explicit tests as well as started.
6. **Native adoption:** physical displayed equality is not ordinary-before equality.
   Entity fast/frame installation must prepare ordinary-before responsibility before
   installation, retain field presence/lifetime distinctions, and leave preparation
   failures untouched. This must work without Link or declaration involvement.

## Ownership and retirement plan

| Record | Live obligation | Retirement trigger |
| --- | --- | --- |
| Source binding and subscriptions | Active connection or pending relevant operation | Last such obligation releases; do not equate tree.destroy with connection.dispose |
| Pending dependency identity/outcome | Held revision, enclosing validation, another connection or live authentic handle | Release operation leases on terminal disposition; live handle may retain compact terminal outcome without global strong registration |
| Projection revision/payload | Current connection projection, queued or started delivery, unfinished admission | Supersession/disposal/acknowledgment releases the corresponding lease; other consumers remain intact |
| Validation frame/permissions | Open enclosing horizon or unresolved admission | Finish reporting/validation, transfer required immutable proof, release frame graph |
| Receipt | Caller-readable admission result | Compact terminal snapshot; caller retaining it must not retain the tree |

These transitions are a proposed implementation contract, not proof that cleanup
already works. Do not delete all confirmed owners indiscriminately: terminal
handle reuse, foreign connections and in-flight requests remain real consumers.
The optional diagnostic history array is separate from correctness-store retention.

## Review clarifications incorporated

Open the conservative validation horizon before any user-controlled declaration
property access or owner iteration, and retain it through return-shape validation
and secondary reporting. Classify native sources using trusted metadata, not
arbitrary getters/methods. A reporting listener throw cannot skip invalidation or
cleanup, replace the primary error, or trigger recursive duplicate reporting.

Source category, lifetime availability and connection disposal are different facts.
Preserve native retired/dormant-source read/write behavior; no new blanket stale-source
throw is selected. Prove that a retired source never authorizes a replacement.
Tree destruction remains distinct from connection disposal. Stack pop is not frame
retirement: a returned child still depends on unfinished parent validation. After
that horizon closes, transfer required dependency leases into immutable proof before
releasing parent frames. The implementation must identify the exact lease owner.

Ordinary-before entity facts must be bounded by inspection divergence or live
capture/recovery obligations, not a permanent duplicate of every entity row.
Registered-tree scanning remains a separate unqualified cost; this inventory does
not establish indexed work or performance acceptance.

## Ordered implementation and acceptance gates

First implement/test source-qualified native projection and the common operation
lifecycle together in the disposable experiment. Entity adoption then uses its
native prepared-installation seam, with standalone tests before Link composition.
This is one bounded plan with independently falsifiable components, not six
special-case patches. Preserve every first failure and unchanged assertion.

- Typed field9 must actually send number9; rejection must send surviving truth.
  Same collection/different row and same row/different field cannot share authority.
  Rekey follows lifetime; stale held sources cannot authorize replacement rows.
- Existing native aggregate and restoration controls remain unchanged. Inspection
  alone produces no new publication; source guards prevent callbacks for aggregates
  without disabling ordinary aggregate Link or rejecting supported scalar fields.
- Entity inspection adoption/rollback across updateOne, replacement and frame paths;
  genuine equal no-op, field absence versus undefined, mixed scalar/entity failure,
  held references, preparation failure, reentry and useful recovery.
- Started receipt queried during unrelated/nested scopes remains terminal. Include
  supersession, disposal, multiple connections and terminal owner handle reuse.
- Frozen/primitive primary throws plus known contradiction report secondary error
  exactly through the existing path. Reporter reentry/throws cannot replace primary,
  lose recovery, recurse indefinitely or enable premature publication.
- Repeat drained cycles with multiple connections, cross-tree owners, retained and
  dropped receipts, queued/held/in-flight work and unfinished validation. Demonstrate
  both obligation-free reclamation and preservation of genuinely live dependencies;
  add held-terminal-receipt collectibility evidence, not just counters.
- Preserve original delivery, ABA, multiowner, inspection, scalar/four-framework
  adoption and authoritative-incoming controls. Hidden omission stays misuse.
  Historical32/34 semantics remain separately reconciled, never rewritten as passes.

Independent review must challenge omitted source categories, identity aliasing,
cleanup ownership and error precedence before broader qualification. Only surviving
focused gates justify full suites, installed-artifact/type checks and fresh costs.

## Stop conditions and disposition

Existing identities and preparation seams make this a plausible bounded correction;
source inspection does not establish its success. If adoption requires a second
canonical authority, settlement replacement, changed destruction semantics or a
new public token/API, stop with the concrete counterexample and architecture choice.
If the same mechanism recurs after its proposed general correction, stop rather than
adding exceptions. Production conservative hold, budgets and B closure remain intact.

No runtime patch, API acceptance, broad suite run or performance claim accompanies
this inventory. The next authorized work can test this finite plan; integration is
still rejected.

## Independent review records

- [Native identity and adoption trace](SOURCE-REVIEW.md).
- [Lifecycle ownership and error trace](LIFECYCLE-REVIEW.md).
- [Plan challenge and disposition](PLAN-REVIEW.md).

Root verified the native projection, entity preparation, helper status/error and
loader refresh/admission paths against these claims. No runtime tests were run
for this documentation-only inventory. Frozen executable evidence remains in the
linked qualification archive; no original falsifier was modified.
