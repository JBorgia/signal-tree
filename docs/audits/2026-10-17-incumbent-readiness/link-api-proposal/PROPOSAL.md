# Bounded Link-local API proposal

Base6ceca15ddccd4e454c4009f44f5c66b729699109. Proposal for owner selection,
NOT an existing API, implementation authorization or production qualification.
The owner approved complete declarations with application responsibility for hidden
omissions. Public syntax still needs approval. Production hold remains unchanged.

## Existing deliberate surface

Current Link has retrieve(), settled(), dispose(). link.ts deliberately excludes
status/error/retry surfaces without demonstrated need; endpoint errors use onTreeError.
This proposal adds only declaration admission, with a per-operation observation
receipt earned by the new requirement to observe conservative fallback. It does not
add transport retry/status APIs or change settled() error behavior. Existing facades
and native write syntax stay intact. B stays closed.

## Three concrete alternatives

Illustrative code, same y target and existing pending handle p:

| Alternative | Independent | Dependent | Main consequence |
| --- | --- | --- | --- |
| Scoped declaration | c.declare({kind:'independent'}, () => y(7)) | c.declare({kind:'dependent',owners:[p]}, () => y(x())) | Preserves native mutations; scope validation includes reentry |
| Explicit snapshot publication | c.publish(7, {kind:'independent'}) | c.publish(x(), {kind:'dependent',owners:[p]}) | Duplicates snapshot capture/delivery; needs rules for supplied value differing from source |
| Connection-owned write | c.write(7, {kind:'independent'}) | c.write(x(), {kind:'dependent',owners:[p]}) | Duplicates facade setters; nested writes still need separate admission rules |

For review-before-save, ordinary live/draft workflows remain available unchanged.
For a shipment calculation, scoped declaration wraps existing native assignments;
a snapshot API separately constructs the exact outgoing value; a connection setter
moves writes into the synchronization object. None automatically discovers hidden
contributors. No runtime/DX timing ranking is claimed.

RECOMMENDED FOR APPROVAL: scoped declaration, initially scalar connections. One new
connection method plus a narrow result object. It matches the executable synchronous
contract without inventing a second way to write state or submit arbitrary snapshots.
The alternative names are not aliases to ship. No multi-connection coordinator is
proposed for this first surface.

## Proposed form and three responsibilities

```ts
const a = connection.declare({ kind: 'independent' }, () => y(7));
const b = connection.declare({ kind: 'dependent', owners: [p] }, () => y(x()));
const saved = x();
connection.declare({ kind: 'dependent', owners: [p] }, () => y(saved));
connection.declare({ kind: 'unknown' }, () => y(saved));
```

Independent explicitly asserts a complete empty dependency set. Dependent asserts
its list contains every possible pending contributor, including saved inputs and
trigger/control dependencies. Empty dependent list is equivalent to independent;
prefer the named independent case in documentation. Unknown provides no early
permission; it deliberately overrides a nested assumption of independence but cannot
erase inherited known owners. Ordinary undeclared writes keep existing behavior.

A false independent assertion over hidden saved speculative input is a MISUSE
DEMONSTRATION that can leak. It is never counted as a safety-pass test. Runtime
validation checks known contradictions, not hidden-input completeness.

## Binding and scope

- Covers only NEW authored revisions of this connection's scalar source produced
  during this synchronous operation. A scope with no relevant write returns no-write;
  it cannot bless an existing snapshot. Equal-value authored revisions still count
  as responsibility changes even when value notifications are suppressed.
- Repeated writes within one operation get its final validated evidence. The receipt
  describes the last relevant authored revision; intermediate revisions are coalesced,
  not a promise to deliver every value. A later out-of-scope write supersedes it.
- Other locations/trees can be written by the callback but receive no publication
  permission from this connection. Their state/transaction contracts are unchanged.
- Other connections, even on the same scalar, do not inherit the declaration. To
  cover two, explicitly nest their declarations around the same write. Both validations
  form one synchronous horizon; neither may publish before the entire nested operation
  unwinds. Known outer obligations cannot be erased by an inner empty declaration.
  An explicitly unknown outer declaration also forces nested work conservative; an
  inner independent declaration cannot launder that unknown invocation context.
  Any returned inner receipt reads validating until the shared outer horizon closes;
  outer validation failure keeps it conservative. Disposal affects only receipts of
  the disposed connection; another nested connection still awaits the shared horizon
  and its own result. No atomic multi-connection cancellation is implied.
- Read evidence and declared contributors are distinct from capture ownership. Passing
  p here never makes y part of p, calls p.confirm()/rollback(), or changes compensation.
- Initial additive overload would expose declare only for scalar owned locations.
  Existing branch/entity links retain the old Link surface. Aggregate extension needs
  complete final-projection evidence, including untouched members, ordering and lifetime
  facts. A scalar declaration cannot certify an aggregate. Exact scalar conditional
  typing/runtime recognition remains a native/type experiment obligation before API
  acceptance; the sketch below does not implement that overload.

Example for two destinations/connections (more ceremony, deliberately explicit):

```ts
let second;
const first = auditLink.declare({kind:'independent'}, () => {
  second = metricsLink.declare({kind:'independent'}, () => {
    audit.set(7); metrics.set(8);
  });
});
```

This is not atomic multi-endpoint delivery. A failure or disposal can prevent one send;
no backend transaction or exactly-once delivery is promised.

## Authentic dependency identity and terminal lifecycle

Use existing authentic PendingTransaction handles (including the original recovery
transaction object) as references, not as publication authority. Private enrollment
must map object identity to immutable source/owner identity and real irreversible
outcomes. Do not inspect changes, invoke methods, count lifecycle events or infer
confirmation from disappearance. A structural fake is rejected at runtime.

No new dependency-token export is proposed. The illustrative type accepts
PendingTransaction or NonNullable<SignalTreeRollbackError['recovery']>['transaction'];
this avoids requiring a new recovery-type export. Runtime must demonstrate authentic
recovery/no-op/terminal-handle enrollment before this choice is accepted. If it cannot,
return a concrete API issue rather than silently minting caller-controlled IDs.

Start the conservative validation horizon BEFORE reading kind/owners or iterating
the list: accessors, Proxies and iterators may execute user code. Until the declaration
is validated, reentrant writes cannot gain early permission. Copy and validate the
owners array before the callback; mutations afterward cannot
alter responsibility. Authentic cross-tree handles in the same supported runtime can
be declared. Another runtime instance or unknown handle is unavailable, not confirmed.
Known terminal confirmation permits early eligibility; rejection prevents the old
all-confirm proof. A newly submitted already-rejected/abandoned owner is an invalid
declaration; a new post-rejection ordinary write can assert surviving independence.

For a previously admitted receipt whose owner later rejects, reevaluate coherent
current surviving truth under the conservative boundary. Do not release its captured
payload or adopt inspection state. Other known pending owners remain blockers. The
native experiment must prove that projection seam; the standalone model supplied it.

## Observable outcomes and errors

Return a PublicationReceipt with a pure read() method returning a detached immutable
snapshot. It is not a signal/subscription and causes no publication. Proposed states:

| State | Meaning |
| --- | --- |
| validating | Shared synchronous horizon still open; no early permission yet |
| no-write | Operation authored no revision for this connection |
| held / pending-dependency | Valid declaration still waits for an owner |
| eligible / basis declared | Early eligibility; not endpoint acknowledgment |
| conservative / reason | Unknown, rejected-dependency, unavailable-owner or invalid-declaration; fallback still gated |
| eligible / basis surviving | Fresh surviving-projection evaluation passed conservative gate |
| started / basis declared or surviving | Endpoint invocation began; delivery may fail; not acknowledgment |
| superseded | Covered revision replaced before endpoint invocation |
| disposed | Connection stopped before endpoint invocation |

A receipt observes one admission, not the connection's transport history. started is
terminal for that receipt even if later correction/retry occurs. Existing settled()
and onTreeError retain delivery completion/error roles. Holding receipts must not
retain whole trees/transaction handles after terminal compact state can replace them;
dropping a receipt does not cancel pending connection work. Reclamation requires tests.

Malformed/unauthentic declarations throw BEFORE invoking the supplied callback.
Validation accessors may themselves have written; those effects remain conservative.
This is not a universal no-side-effects guarantee. Late contradictions
or Promise/thenable results throw AFTER retaining installed writes conservatively;
errors must state that writes may remain. Proposed exported error class:
SignalTreePublicationError, with code SIGNALTREE_PUBLICATION_DECLARATION_INVALID and a stage ('before-callback' or
'after-callback') and reason. Proposed reason values: malformed, unavailable-owner, contradiction, async-callback,
validation-threw, disposed, unsupported-source. A validation-thrown value is preserved
in cause without mutating it. This is a new proposed declaration error, not a rollback
error; its class and fields require the same owner API approval as declare().

If callback also throws, preserve its exact value including primitives/frozen objects.
Report the secondary declaration problem through existing onTreeError with operation
link:declare, never attach properties to the thrown value. No receipt is returned
from a throwing call; its installed writes take the documented conservative path.
The reporter is diagnostic, not a recovery authority. Its synchronous listeners can
reenter too: hold the validation horizon until they finish and validate new known
facts before permitting any early publication. Avoid recursive duplicate reports.

## Validation and async boundary

Validation includes return-shape inspection: accessing .then can run user code.
Keep the frame through all such inspection and synchronous reentry. A thrown then
getter fails declaration validation conservatively. Known dependencies accumulate;
late contradictions cannot be discovered after the send has started.

Only synchronous callbacks are admitted. The type sketch rejects ordinary Promise
returns, but any/unknown/thenable tricks still need runtime validation. Async code
already started cannot be cancelled. After await, no declaration propagates; writes
use ordinary conservative behavior unless a fresh explicit declaration is made.
Settlement/disposal during suspension cannot resurrect old authority. Calls on a
disposed connection fail before invoking the callback; they do not silently skip user
work or create a clean ticket. Callback return value is intentionally not forwarded;
the returned object is the admission receipt. No async receipt/then member is proposed.

## Examples and qualification boundary

Type-only examples cover independent/dependent/unknown, saved inputs, recovery handles,
ordinary async rejection and Angular/Solid .set, Vue .value, React/kernel callable
write shapes. These are illustrative callback signatures, NOT real four-framework
or installed-artifact qualification. TypeScript cannot enforce hidden-input completeness.
First compiler failure imported an unexported recovery type; it is preserved. Corrected
sketch derives the type from exported SignalTreeRollbackError and typechecks.

After owner approval, the first native experiment must combine actual scalar Link
with existing declaration cases, delivery controls, ABA, then-getter reentry,
disposal, callback-error precedence, authentic/recovery owner identity, multiple writes
and two connections. Include onTreeError listener reentry and no-write authorization
falsifiers. Also test declaration getters/Proxies/iterators, inner receipt reads while
validation is open, outer failure/disposal, and unknown-outer nesting. Keep hidden-omission misuse separate. No acceptance inherited from the
standalone model. Entities/order/restoration and full framework qualification follow
only after that slice survives. No production activation or budgets are approved.
