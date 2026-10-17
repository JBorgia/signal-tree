# B dependency-completeness audit

Audited runtime: `78bcbefc968e3d8e3bd32fc366d188f2ae96d0bb`.
This checkpoint adds tests and records only. B remains rejected. No repair,
activation, new API or change of architecture is selected. Existing cost evidence
in ../qualification/COST.md is unchanged and was not remeasured.

## Premises and scope

Current owner instruction: “rejecting transaction 1 should refuse atomically and
retain both transactions’ authority unless the implementation can preserve that
dependency through an already-defined settlement rule. It must not silently
rewrite transaction 2.” No such alternative successful preservation rule was found
for a pending explicit-order dependency. The older permissive experimental test
records possible outcomes; it does not define a transfer rule. New order-refusal
tests follow the current instruction, not a newly chosen implementation policy.

The existing retention contract, at this source revision in
`docs/architecture/retired-subject-churn.md:566`, says:

> **A restoration claim names the subjects whose backing must conservatively
> remain available while the record holding it is retained.**

Minimality is explicitly not required. A conservative backing claim therefore
cannot be treated as an exact semantic dependency requiring active existence.

The finite scope is entity field, membership/key, ordering and inverse-placement
facts entering B's native entity responsibility path. Scalar/member authority,
Link, inspection participation, dynamic registration, framework timing and the
other rejected qualification failures are not requalified here. Incidental reads,
held references and physical reclamation are included only as discriminators.

## Operation inventory

Paths and lines below refer to the audited runtime. `NE` means
`packages/kernel/src/lib/internals/native-entity-ownership-experiment.ts`;
`ES` means `packages/kernel/src/lib/entity-signal.ts`.

| Operation | What it authors | Existence/dependency question | What must not become authored | Current creation and disposition |
| --- | --- | --- | --- | --- |
| Changed field / existing-row replacement | Changed field values or field absence on a stable lifetime | A surviving field fact can require its target lifetime; its storage key may change independently | The observed key, other unchanged fields, collection order | ES:526,653,1349 emit nonstructural captures; NE:280–307 diffs fields. NE:378–391 checks newer surviving field winners before removing existence. Field records can outlive field confirmation while membership remains pending (NE:534–547). |
| Add / restore | Existence at a key, payload facts and insertion intent | Other operations may subsequently require this lifetime | Neighbors observed to reconstruct placement are not promises that those neighbors must stay active | ES:660–706 emits structural facts and placement. NE:280–281 stages membership; field capture is separate. Creator deletion checks field dependencies, but not other authors' ordering dependencies. |
| Explicit exact/front/back ordering | Ordering intent involving specified subjects, together with any separately authored membership/value changes | Referenced lifetimes needed by a surviving order cannot be silently deleted; latent pending order may reemerge | Every subject copied into a preparation snapshot is not necessarily independently authored by every operation | NE:195–234 retains a full order array. Preparation only reconciles order keys in the settling owner's `next` set (NE:434–473); creator settlement misses another owner's order. |
| Rekey | Key mapping/occupancy for the same lifetime; not payload id rewriting | Requires the lifetime; whether preserving it after creator rejection also preserves every unchanged creator field is unresolved | Observed field payload and observed speculative collection order | ES:710–723,1135–1144 transfers key only. NE:280–281 captures membership. But an existing order ledger plus any structural capture also stages observed order (NE:198–212), promoting incidental order into a newer base. |
| Removal | Absence of the selected lifetime | May supersede earlier existence-dependent facts; pending removal can be rejected and reveal earlier obligations again | Removal's restoration neighbors are not new ordering authorship | Membership fact becomes null; neighbor identities remain inverse data. The tested terminal replacement/removal and reversible removal cases are distinct; no universal supersession rule is inferred. |
| Snapshot, held reference, placement anchor | No mutation fact merely from being read or retained | A held reference preserves identity, not a promise of active membership. An anchor may be needed to reconstruct order without itself surviving | Snapshot contents and anchor presence must not be promoted to owned membership/order | ES:4317 reads physical placement; NE:479–499 resolves anchor chains. Claims include changed subjects, anchors and explicit ordering subjects (NE:310–329), a deliberate superset of semantic dependencies. |

`setAll` is composite, not a pure observation: ES:3876–3882 supplies explicit
exact ordering, while its frame separately captures adds/removes/replacements.
A later setAll excluding C both changes order and authors C's removal. It is not
an order-only witness for deleting an existence dependency. Similarly, a no-op
field update may produce no changed fact; this audit does not declare every call
an authored dependency irrespective of the existing no-op contract.

Ingress coverage from source: fast existing-value replacement (ES:1349), framed
mutations (ES:729), prepared point realization (ES:526), and prepared collection
target (`physical/prepare-entity-target.ts:173–224`) feed the responsibility hook.
The latter supplies exact order even when applying a target. This inventories the
translation points; it does not prove correct participation/provenance for all
restoration/inspection routes. Those known gaps remain separate.

## Lifecycle inventory

| Boundary | Current accounting | Required distinction / evidence |
| --- | --- | --- |
| Prepare/admit | Capture creates TerminalRecordPlan ledger/index/claim additions before native installation | Authored semantic facts, semantic dependencies and inverse-data retention need separate meanings. A common hook alone does not establish correct classification. |
| Same-author subsequent write | `pending.set(id,fact)` replaces that author's fact at a location | This differs from hiding an older author's still-pending fact. Same-author order replacement plus removal is tested separately. |
| Newer pending author | `winner()` chooses the highest sequence; older pending facts remain | “Superseded” inspection status is not dependency release. Rejecting the newer author can reveal the older order; tested intermediate assertion passes. |
| Newer committed author | Base may outrank older pending contributions | Tests cover a committed replacement that also removes C. Its rejected older order must not resurrect C. This does not settle every order-only supersession policy. |
| Reject | Only the rejecting owner's pending facts enter `next`; surviving winners are selected | Field dependencies are checked; other-owner explicit order is omitted. Five lifecycle tests reach this omission. |
| Confirm | Promote the fact when newer than base; terminal order ledger is deleted when no pending facts remain | A confirmed order can still require a lifetime whose creator is pending. Current order confirmation loses that requirement. Field-specific retention is not a general solution. |
| Pre-install preparation failure | Driver prepares scalar/entity targets before installation; refusal retains authority | The injection test verifies unchanged order and two pending owners, then fails the subsequent creator-refusal assertion. Final retry lines after that failure did not execute. |
| Post-install delivery failure | Installation and owner retirement precede invalidation/terminal consequences/publication; public wrapper distinguishes raw.pending() | Do not demand that an already terminal transaction retain pending dependencies just because delivery reports an error. This audit does not newly execute delivery-failure controls. |
| Claim retention/release | Prepared claims accumulate subjects/anchors per author; release occurs at terminality; destruction clears maps | Claim presence is not semantic protection. Conservative stale anchors can remain until terminal release without proving a leak; post-drain physical cleanup is tested. |

Relevant source: NE:343–355,534–577,635–645;
`native-ownership-driver-experiment.ts:248–297`;
`native-ownership-public-experiment.ts:186–196`;
`subject-restoration-claims.ts:214–235`. Prepared claim admission is additive per
author; the separate public `retain()` operation replaces a claim set. Neither
should be mistaken for a precise current-order dependency index.

## Executed discriminators

The new file is `packages/kernel/src/lib/b-dependency-lifecycle-audit.spec.ts`.
All assertions remain ordinary tests; no expected-failure conversion or skipping.
First ten cases: 3 passed / 7 failed. Adding the two distinct supersession cases
produced 5 passed / 7 failed. The original first source/log are preserved.

| Case | Observed result | Interpretation |
| --- | --- | --- |
| Pending order blocks creator rejection | Fails: no refusal | Known ordering-dependency omission. Later authority/retry assertions are not reached. |
| Reject order, then creator | Pass | Dependency release path performs useful settlement. |
| Confirm order, then reject creator | Fails: no refusal | Requirement disappears when ordering handle becomes terminal. |
| Failed order preparation, then reject creator | Fails at creator refusal | Fault refusal, unchanged order and both pending counts pass first; no claim that final retries executed. |
| Reject newer pending order | Older order correctly reemerges; creator refusal then fails | Latent facts survive, but their existence dependency is unenforced. |
| Remove and restore ordered lifetime | Same held lifetime/order restored; creator refusal then fails | Reversible absence must not erase the older dependency. |
| Reads, held reference and incidental append anchor | Pass | Creator can settle while independently appended D survives; no blanket dependency on everything observed. |
| Pending reorder, ordinary rekey, reject reorder | Fails: C,A2,B instead of A2,B,C | Proven incidental-order promotion; key authorship must not commit unrelated observed order. |
| Rekey pending-created lifetime | Key C2 and held identity survive; payload becomes {} | Payload assertion is an unresolved premise, not counted as an established contract violation. See below. |
| Post-capture-drain cleanup | Pass | Physical resource inventory no longer contains retired C; pending/ledger/candidate counts zero. Not a heap/dominator or universal reclamation proof. |
| Newer committed replacement/removal excludes C | Pass | Rejecting older order and creator preserves B,A, without resurrecting C. |
| Same ordering author overwrites order and removes C | Pass | Reject creator then ordering restores A,B with no C resurrection and terminal records cleared. |

Six of seven failing assertions test established/currently instructed obligations:
five related dependency-refusal failures and one incidental-order authorship error.
They are not six independent root causes. The seventh preserves a hypothesis:
independent rekey authors C2, but not unchanged creator fields id/n. No concrete
existing contract was found requiring those fields to survive creator rejection.
The key and identity assertions already pass. Whether to refuse, preserve a
complete payload through an existing rule, or permit a different disposition
needs a justified operation model before repair selection. The original payload
assertion remains red and explicitly annotated; it was not weakened to improve counts.

## Focused verification

Root independently ran the new twelve cases plus the existing eight authored-
topology and five dependency probes: **18 passed / 7 failed**, no skips or expected-
failure markers. New-file counts remain 5/7; all thirteen prior probes pass.
Kernel lint passes with zero errors and 15 existing warnings. Spec-types passes
its unchanged ratchet with six existing diagnostics; this is not clean spec
compilation. No warning or type allowance changed. Only this new test and audit
records are added; tracked runtime hashes still match the audited checkpoint.

## Review and disposition

Independent review challenged the initial refusal premise because an older
experiment allowed preservation or refusal. After checking the current owner
instruction, the reviewer found no defined successful-preservation rule and
withdrew that objection. Review separately caught the unsupported full-payload
premise; the record now distinguishes it from the six established failures.
Root verified cited source, final test assertions and raw execution evidence.

The inventory does not justify selecting a repair yet. B needs an account of what
authors require, including latent/confirmed obligations, without treating all
observed order, anchors or snapshots as authored truth. No new guard, dependency
index or canonical-state representation is chosen here. Pending-only ownership
is not falsified by this audit; current dependency accounting remains insufficient.

No full suites, framework qualification, builds, performance or bundle measurements.
No API acceptance, default activation, v15 changes, push, merge, tag or publication.
See replay.sh and EVIDENCE.md for commands, exact source seals and archived logs.
