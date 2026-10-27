# Combining publication obligations: scalar review specification

Pre-execution draft, 2026-10-27. Runtime remains rejected scalar checkpoint
`b9eef50de5cdded79792ac043ab99ce03d0144ee`. Test-only checkout deliberately
excludes the unused entity commit61689286. This stage reviews one rule and runs
discriminators; it does not implement another successor or lift integration gates.

## Governing premises

Latest owner instruction:

> Known write ownership cannot remove input dependencies or possible-owner obligations. Each obligation needs its own justified discharge.

> Qualified independent write in p; unrelated q pending | Progress after p confirms

> Include saved inputs and reversed settlement order, not only direct reactive copies.

Contract392fcf46, admission3:

> Unobserved undeclared authored facts capture currently pending instrumented owners at the native authorship boundary.

Contract392fcf46, admission5:

> A later unrelated owner q cannot enlarge revision r's window, including if q opens before r's first Link flush.

Same contract permits rejection to invalidate old proof and wake a new ordinary
evaluation; it does not confirm rejected proof, erase surviving ordinary writes,
publish an inspection overlay, or revive terminal receipts. Complete declarations
assert hidden-input completeness; only the application can make that assertion.
Transaction callbacks are not automatically complete declarations.

## Proposed rule, not a selected runtime representation

For each installed fact revision retain the reasons for its obligations:

- D: native destination authorship, supplied by the authentic write owner.
- I: dependencies in actual native supplied input and structural support.
- W: immutable possible-owner window for unobserved, undeclared inputs.
- V: relevant enclosing validation obligations, including synchronous reentry.
- R: recipient-specific unknown coverage, separate from the preceding categories.

These are logical distinctions; no five new stores are proposed. Existing native
source records and recipient ticket lifecycle are the implementation candidates.
They describe incumbent authority, not a new settlement engine or canonical store.

Combine native obligations by conjunction/union of reasons. Installing D(p)
neither clears I(q) nor skips W acquisition. A complete qualified declaration can
supply completeness for this write's otherwise unobserved inputs, so it avoids
a new speculative W for unrelated owners. It cannot remove inherited I/W,
untouched structural obligations, destination D or V. Unknown/invalid declarations
do not confer completeness. Recipient R cannot contaminate another connection.

At a native supplied-input boundary, a source revision's unsettled D becomes an
input requirement of the consumer. Thus excluding destination D from declaration
contradiction checks must not exclude D of a value actually consumed as input.
A literal independent write within p has D(p), no q input and no new W(q).
A native updater consuming q has I(q), whatever transaction owns its destination.

Declaration contradiction compares the asserted input set with the actual input
lower bound and inherited validation declarations, not destination authorship.
Do not move D into shared frame input owners or erase it from delivery gates.
Multiple native input dependencies and validation requirements retain the existing
nested-scope semantics. A new complete literal replacement may replace addressed
value input evidence; it cannot clear unrelated membership/support facts.

W is sampled after callback-capable preparation, before callback-free installation,
even when D is nonempty. Previously installed siblings retain their own W. Later
owners never join the old W. The same identity may occur for multiple reasons;
deduplicating reverse-wake registrations is permitted, but the reasons remain.
For receipt classification, duplicate possible-p must not manufacture an unknown
input category when p is already an actual required owner. This does not certify
hidden-input completeness or justify omitting a different possible q. Inherited
uncertainty is not erased merely because a new destination also has that identity.
Review must check this distinction against the existing held/unknown receipt tests.

An outcome discharges only obligations for that immutable owner identity:

| Event | Required consequence |
| --- | --- |
| p confirms; q in I/W still pending | Hold; p does not discharge q |
| q confirms; destination p pending | Hold |
| Both confirm, validation closed | Wake without setter; evaluate current ordinary truth and deliver |
| q rejects | Old q proof is not confirmed; wake fresh ordinary evaluation once remaining gates clear |
| p rejects | Native rollback decides surviving fact/topology; only a new ordinary ticket may publish that disposition |
| Owner disappears/abandons | Not successful settlement; preserve conservative unresolved status |
| Replacement | Supersede exact addressed revision; old wakes cannot revive it |
| Disposal | Remove recipient wakes; do not remove another source/recipient's obligations |

No payload is authorized solely by a terminal bit. Delivery still checks exact
support/revision, ordinary participation, validation and native local gates.
Queued/in-flight serialization and ordinary value-notification suppression are
unchanged. No retrospective window expansion or value-based dependency inference.

## Source mapping to review

At b9eef50d:

| Site | Current conflation | Required handoff |
| --- | --- | --- |
| private.ts nativeAuthorship | Returns known write owner under a generic owner label | D identity retained independently of input completeness |
| lifecycle.ts prepareNativeRequirement | known.length disables all W capture | Per-installation W eligibility comes from input completeness, not D presence |
| lifecycle.ts nativeProof | D, native inputs and frame owners merge into owners | Preserve reason identity through admission and completion |
| lifecycle.ts prepareNativeRequirement/prepareRevision | Generic known owners populate installedOwners and contradiction set | Validate I/V, retain D as delivery/consumption support |
| private.ts ready/projectionSupport | Facts reduced per projection | Combine distinct reasons without recipient enrollment changing native support |
| lifecycle.ts finish/projectRevision/decision | Single owner union drives receipt and eligibility | Same completed obligations through receipts, wake indexing and fresh fallback |
| lifecycle.ts retire/dispose | Reverse links attached to operations | Deduplicate identity fanout, release only obsolete obligations |

Both producer and consumer changes would be needed. Replacing only the
known.length predicate cannot meet the qualified-independent-in-p discriminator.
The scalar rule must survive before touching the entity draft. Existing source-only
P/O certificate concerns, entity producers and broader qualification remain open.

## Prewritten matrix

`publication-obligation-combination.spec.ts` has12 cases, no expected failures or
skips. Assertions are fixed before execution:

- Direct and saved copies, p-first/q-first confirmation:4 cases. Assert initial
  hold, one-confirm hold, useful one-send delivery after both, and late r pending.
- Direct and saved copies, q rejection before/after p confirmation:4. Inspection
  shows99 while ordinary destination7 survives; require outgoing7, never99, and
  continued late-r authority. No setter is used to wake delivery.
- Qualified independent literal/saved-literal inside p with unrelated q:2.
  Require no declaration error, hold until p, then useful declared delivery and
  terminal receipt stability while q/r settle later.
- Saved value authored after q already rejected:1. Approved surviving-write
  semantics must not become permanent origin taint.
- Native supplied q input claimed independent inside p:1. Preserve contradiction,
  retain writes conservatively, and useful ordinary fallback only after p and q.

Run against frozen rejected runtime first. Passing rows show only those controls;
earlier failing assertions leave later liveness assertions unexecuted. Preserve
all original tests, root010, the78 passing vector and their exact identities.

## Review and implementation boundary

Independent review must examine role promotion at input consumption, duplicate
identity versus distinct obligation reasons, declarations within native scopes,
pending/terminal outcomes, and receipt basis. A model/table alone does not prove
native installation atomicity or lifecycle. No architecture, API or semantic
expansion is approved by this document. No runtime patch, entity work, full suites
or cost campaign belongs to this stage. A concrete reviewed rule is the requested
prerequisite for a bounded scalar successor, not automatic integration acceptance.
